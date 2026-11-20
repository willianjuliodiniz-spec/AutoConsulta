import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { INVALID_PLATE_MESSAGE, isValidPlate, normalizePlate } from '@/lib/plate';

const DAILY_FREE_LIMIT = 3;

// Mock só é permitido fora de produção E com USE_MOCK=true explícito.
// Em produção, USE_MOCK é ignorado: nunca devolvemos dados fictícios como reais.
function isMockEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.USE_MOCK === 'true';
}

// Identifica registros fictícios. A flag explícita tem prioridade (isMock: false = dado real vindo do provedor);
// a assinatura do mock legado só vale para registros antigos, gravados no cache sem flag.
function isMockRecord(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const data = raw as Record<string, unknown>;
  if (data.isMock === true) return true;
  if (data.isMock === false) return false;
  const fipe = data.fipe as Record<string, unknown> | undefined;
  return (
    data.brand === 'VOLKSWAGEN' &&
    data.model === 'NIVUS HIGHLINE 200 TSI 1.0 FLEX AUT.' &&
    fipe?.code === '005526-3'
  );
}

// ---------------------------------------------------------------------------
// Integração com o provedor real de consulta de placa (somente servidor).
//
// Variáveis de ambiente (nunca use o prefixo NEXT_PUBLIC_):
//   PLATE_API_URL          URL do provedor. Use {plate} como marcador; sem marcador, a placa é anexada ao final do caminho.
//   PLATE_API_KEY          Chave/token de acesso.
//   PLATE_API_AUTH_HEADER  (opcional) Nome do header de autenticação. Padrão: Authorization.
//   PLATE_API_AUTH_SCHEME  (opcional) Prefixo do valor (ex.: Bearer). Padrão: Bearer. Vazio envia a chave pura (ex.: x-api-key).
// ---------------------------------------------------------------------------
const PROVIDER_TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;

type ProviderResult =
  | { kind: 'ok'; data: JsonRecord }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
}

function unwrapPayload(body: unknown): JsonRecord | null {
  if (!isRecord(body)) return null;
  let current: JsonRecord = body;
  for (const key of ['data', 'result', 'resultado', 'dados', 'veiculo', 'vehicle']) {
    const next = current[key];
    if (isRecord(next)) current = next;
  }
  return current;
}

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeFipe(payload: JsonRecord): JsonRecord | undefined {
  const source = payload.fipe;
  let code: string | undefined;
  let value: string | undefined;
  let reference: string | undefined;

  if (isRecord(source)) {
    code = pickString(source, ['codigo', 'code', 'codigo_fipe']);
    reference = pickString(source, ['referencia', 'reference', 'mes_referencia']);
    const rawValue = source.valor ?? source.value ?? source.preco;
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) value = formatBrl(rawValue);
    else if (typeof rawValue === 'string' && rawValue.trim() !== '') value = rawValue.trim();
  } else if (typeof source === 'string' && source.trim() !== '') {
    value = source.trim();
  } else if (typeof source === 'number' && Number.isFinite(source)) {
    value = formatBrl(source);
  }

  if (!code && !value && !reference) return undefined;
  return { code, value, reference };
}

function normalizeRecordInfo(source: unknown): JsonRecord | undefined {
  if (!isRecord(source) || typeof source.hasRecord !== 'boolean') return undefined;
  return {
    hasRecord: source.hasRecord,
    details: typeof source.details === 'string' ? source.details : undefined,
  };
}

// Só repassa o laudo quando o provedor entrega dados no formato esperado. Nunca preenche "nada consta" por conta própria.
function normalizeSecurity(payload: JsonRecord): JsonRecord | undefined {
  const source = payload.security;
  if (!isRecord(source)) return undefined;

  const security: JsonRecord = {
    auction: normalizeRecordInfo(source.auction),
    sinistro: normalizeRecordInfo(source.sinistro),
    theftAlert: normalizeRecordInfo(source.theftAlert),
    renajud: normalizeRecordInfo(source.renajud),
  };

  if (isRecord(source.debts)) {
    security.debts = {
      total: pickString(source.debts, ['total']),
      ipva: pickString(source.debts, ['ipva']),
      licensing: pickString(source.debts, ['licensing']),
    };
  }

  return Object.values(security).some((v) => v !== undefined) ? security : undefined;
}

// Valida e normaliza a resposta do provedor. Retorna null se não houver um veículo identificável (marca e modelo).
function normalizeProviderPayload(plate: string, body: unknown): JsonRecord | null {
  const payload = unwrapPayload(body);
  if (!payload) return null;

  const brand = pickString(payload, ['brand', 'marca', 'MARCA']);
  const model = pickString(payload, ['model', 'modelo', 'MODELO']);
  if (!brand || !model) return null;

  const year = parseYear(pickString(payload, ['year', 'ano', 'anoFabricacao', 'ano_fabricacao']));
  const modelYear = parseYear(pickString(payload, ['modelYear', 'anoModelo', 'ano_modelo']));

  return {
    isMock: false, // marca explícita: dado real retornado pelo provedor
    plate,
    brand,
    model,
    year: year ?? modelYear ?? null,
    modelYear: modelYear ?? year ?? null,
    color: pickString(payload, ['color', 'cor']),
    fuel: pickString(payload, ['fuel', 'combustivel']),
    city: pickString(payload, ['city', 'cidade', 'municipio']),
    state: pickString(payload, ['state', 'uf', 'estado']),
    fipe: normalizeFipe(payload),
    security: normalizeSecurity(payload),
  };
}

// Configuração do provedor (somente servidor). Retorna null se ainda não contratado/configurado.
function getProviderConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.PLATE_API_URL?.trim();
  const apiKey = process.env.PLATE_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

async function fetchFromProvider(plate: string): Promise<ProviderResult> {
  const config = getProviderConfig();
  if (!config) return { kind: 'unavailable' };
  const { baseUrl, apiKey } = config;

  // Em produção, a chave só trafega por HTTPS
  if (process.env.NODE_ENV === 'production' && !/^https:\/\//i.test(baseUrl)) {
    console.error('PLATE_API_URL deve usar HTTPS em produção. Consulta ao provedor bloqueada.');
    return { kind: 'unavailable' };
  }

  const encodedPlate = encodeURIComponent(plate);
  const url = baseUrl.includes('{plate}')
    ? baseUrl.replace('{plate}', encodedPlate)
    : `${baseUrl.replace(/\/+$/, '')}/${encodedPlate}`;

  const authHeader = process.env.PLATE_API_AUTH_HEADER?.trim() || 'Authorization';
  const authScheme = (process.env.PLATE_API_AUTH_SCHEME ?? 'Bearer').trim();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        [authHeader]: authScheme ? `${authScheme} ${apiKey}` : apiKey,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (response.status === 404) return { kind: 'not_found' };

    if (!response.ok) {
      // Não loga URL nem headers para não vazar a chave
      console.error(`Provedor de placas respondeu com status ${response.status}.`);
      return { kind: 'unavailable' };
    }

    const body: unknown = await response.json().catch(() => null);
    if (body === null) {
      console.error('Provedor de placas retornou um corpo inválido (não-JSON).');
      return { kind: 'unavailable' };
    }

    const data = normalizeProviderPayload(plate, body);
    return data ? { kind: 'ok', data } : { kind: 'not_found' };
  } catch (err) {
    console.error('Falha ao chamar o provedor de placas:', err instanceof Error ? err.name : 'erro desconhecido');
    return { kind: 'unavailable' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const body = await req.json();
    const isPaidUnlock = Boolean(body.unlocked);

    // 1. Limpa e valida formato da placa (Antiga ABC1234 ou Mercosul ABC1D23)
    const plate = normalizePlate(String(body.plate ?? ''));

    if (!isValidPlate(plate)) {
      return NextResponse.json({ error: INVALID_PLATE_MESSAGE }, { status: 400 });
    }

    // 1.1 Laudo completo: exige usuário autenticado que já desbloqueou (consumiu crédito) esta placa.
    //     O campo `unlocked` vindo do cliente NÃO é confiável por si só.
    if (isPaidUnlock) {
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

      if (!token) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
      }

      const { data: unlockedRows } = await supabase
        .from('consultations')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('plate', plate)
        .limit(1);

      if (!unlockedRows || unlockedRows.length === 0) {
        return NextResponse.json({ error: 'Laudo não desbloqueado para esta placa.' }, { status: 403 });
      }
    }

    // 2. Trava Anti-Curioso (Rate Limit por IP apenas para consultas gratuitas).
    //    Aqui só verifica; o contador só é incrementado após uma consulta válida (ver passo 5).
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const today = new Date().toISOString().split('T')[0];
    let remainingFreeQueries = DAILY_FREE_LIMIT;
    let currentLimit: { id: string | number; query_count: number } | null = null;

    if (!isPaidUnlock) {
      const { data: limitData } = await supabase
        .from('daily_rate_limits')
        .select('id, query_count')
        .eq('ip_address', ip)
        .eq('query_date', today)
        .maybeSingle();

      currentLimit = limitData ?? null;

      if (currentLimit && currentLimit.query_count >= DAILY_FREE_LIMIT) {
        return NextResponse.json(
          {
            error: 'LIMIT_REACHED',
            remainingFreeQueries: 0,
            message: 'Você atingiu o limite de 3 consultas gratuitas hoje. Desbloqueie o laudo completo para continuar.',
          },
          { status: 429 }
        );
      }
    }

    // 3. Busca no Cache Inteligente (Tabela 'vehicles')
    const { data: cachedVehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate', plate)
      .maybeSingle();

    const mockEnabled = isMockEnabled();

    // Registro fictício em cache só é aproveitado quando o mock está explicitamente habilitado (dev/teste)
    const cacheIsUsable = Boolean(cachedVehicle) && (mockEnabled || !isMockRecord(cachedVehicle?.raw_data));
    let vehicleRecord = cacheIsUsable ? cachedVehicle : null;
    let isMockResult = Boolean(vehicleRecord) && isMockRecord(vehicleRecord?.raw_data);

    // 4. Se não estiver no cache, consulta o provedor real. O mock só entra em dev/teste com USE_MOCK=true
    //    e apenas quando o provedor real não está configurado.
    if (!vehicleRecord) {
      let fullData: Record<string, unknown>;
      const providerConfigured = getProviderConfig() !== null;

      if (providerConfigured) {
        const result = await fetchFromProvider(plate);

        if (result.kind === 'not_found') {
          // Placa sem dados válidos: não consome consulta gratuita e não grava nada
          return NextResponse.json(
            { error: 'PLATE_NOT_FOUND', message: 'Não encontramos dados para esta placa.' },
            { status: 404 }
          );
        }

        if (result.kind === 'unavailable') {
          return NextResponse.json(
            {
              error: 'PROVIDER_UNAVAILABLE',
              message: 'Serviço de consulta veicular temporariamente indisponível. Tente novamente mais tarde.',
            },
            { status: 503 }
          );
        }

        fullData = result.data;

        // Grava no cache apenas dados reais e válidos retornados pelo provedor
        const { data: inserted, error: insertError } = await supabase
          .from('vehicles')
          .upsert(
            {
              plate,
              brand: fullData.brand,
              model: fullData.model,
              year: fullData.year,
              raw_data: fullData,
            },
            { onConflict: 'plate' }
          )
          .select()
          .single();

        if (insertError) {
          // Falha de cache não invalida a consulta: o dado real já foi obtido
          console.error('Falha ao gravar cache de veículo:', insertError.message);
          vehicleRecord = { raw_data: fullData };
        } else {
          vehicleRecord = inserted;
        }
      } else if (mockEnabled) {
        isMockResult = true;
        fullData = {
          isMock: true,
          plate,
          brand: 'VOLKSWAGEN',
          model: 'NIVUS HIGHLINE 200 TSI 1.0 FLEX AUT.',
          year: 2023,
          modelYear: 2023,
          color: 'CINZA MOONSTONE',
          fuel: 'ÁLCOOL / GASOLINA',
          city: 'NATAL',
          state: 'RN',
          fipe: {
            code: '005526-3',
            value: 'R$ 114.890,00',
            reference: 'Novembro/2026',
          },
          security: {
            chassi: '9BWCH6CH0P4******',
            renavam: '0134892****',
            engineNumber: 'DHS492***',
            auction: { hasRecord: false, details: 'Nenhum registro de passagem por leilão encontrado.' },
            sinistro: { hasRecord: false, details: 'Sem indício de sinistro ou perda total.' },
            theftAlert: { hasRecord: false, details: 'Veículo sem alerta de roubo ou furto ativo.' },
            renajud: { hasRecord: false, details: 'Nada consta de restrição judicial (Renajud).' },
            debts: { total: 'R$ 0,00', ipva: 'Quitado', licensing: '2026 Regular' },
          },
        };

        // Dados fictícios nunca são gravados no cache (vehicles), para não contaminar consultas reais
        vehicleRecord = { raw_data: fullData };
      } else {
        // Sem provedor configurado e sem mock habilitado: não inventamos dados.
        console.error('Consulta indisponível: PLATE_API_URL/PLATE_API_KEY não configurados e mock desabilitado.');
        return NextResponse.json(
          {
            error: 'PROVIDER_UNAVAILABLE',
            message: 'Serviço de consulta veicular temporariamente indisponível. Tente novamente mais tarde.',
          },
          { status: 503 }
        );
      }
    }

    if (!vehicleRecord) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 });
    }

    // 4.0 Barreira final: fora do modo mock explícito, nenhum registro fictício pode seguir adiante.
    if (!mockEnabled && (isMockResult || isMockRecord(vehicleRecord.raw_data))) {
      console.error('Registro fictício bloqueado: dado simulado não pode ser retornado como real.');
      return NextResponse.json(
        {
          error: 'PROVIDER_UNAVAILABLE',
          message: 'Serviço de consulta veicular temporariamente indisponível. Tente novamente mais tarde.',
        },
        { status: 503 }
      );
    }

    // 4.1 Consulta real e válida: só agora contabiliza a consulta gratuita.
    //     Falhas do provedor, placa inexistente e dados simulados (mock) nunca consomem cota.
    if (!isPaidUnlock && !isMockResult) {
      const newCount = (currentLimit ? currentLimit.query_count : 0) + 1;
      remainingFreeQueries = Math.max(0, DAILY_FREE_LIMIT - newCount);

      if (currentLimit) {
        await supabase.from('daily_rate_limits').update({ query_count: newCount }).eq('id', currentLimit.id);
      } else {
        await supabase.from('daily_rate_limits').insert({ ip_address: ip, query_date: today, query_count: 1 });
      }
    }

    // 5. Filtra a resposta conforme o status de pagamento
    const raw = vehicleRecord.raw_data;
    const source = isMockResult ? 'mock' : cacheIsUsable ? 'cache' : 'api';

    if (!isPaidUnlock) {
      return NextResponse.json({
        source,
        mock: isMockResult,
        unlocked: false,
        remainingFreeQueries,
        vehicle: {
          plate: raw.plate,
          brand: raw.brand,
          model: raw.model,
          year: raw.year,
          color: raw.color,
          city: raw.city,
          state: raw.state,
          fipe: raw.fipe,
        },
      });
    }

    return NextResponse.json({
      source,
      mock: isMockResult,
      unlocked: true,
      vehicle: raw,
    });
  } catch (err) {
    console.error('Erro na rota /api/consultar:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar consulta veicular.' },
      { status: 500 }
    );
  }
}