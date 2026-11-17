import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { INVALID_PLATE_MESSAGE, isValidPlate, normalizePlate } from '@/lib/plate';

const DAILY_FREE_LIMIT = 3;

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

    // 2. Trava Anti-Curioso (Rate Limit por IP apenas para consultas gratuitas)
    let remainingFreeQueries = DAILY_FREE_LIMIT;

    if (!isPaidUnlock) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
      const today = new Date().toISOString().split('T')[0];

      const { data: limitData } = await supabase
        .from('daily_rate_limits')
        .select('id, query_count')
        .eq('ip_address', ip)
        .eq('query_date', today)
        .single();

      if (limitData && limitData.query_count >= DAILY_FREE_LIMIT) {
        return NextResponse.json(
          {
            error: 'LIMIT_REACHED',
            remainingFreeQueries: 0,
            message: 'Você atingiu o limite de 3 consultas gratuitas hoje. Desbloqueie o laudo completo para continuar.',
          },
          { status: 429 }
        );
      }

      const newCount = limitData ? limitData.query_count + 1 : 1;
      remainingFreeQueries = Math.max(0, DAILY_FREE_LIMIT - newCount);

      if (limitData) {
        await supabase
          .from('daily_rate_limits')
          .update({ query_count: newCount })
          .eq('id', limitData.id);
      } else {
        await supabase
          .from('daily_rate_limits')
          .insert({ ip_address: ip, query_date: today, query_count: 1 });
      }
    }

    // 3. Busca no Cache Inteligente (Tabela 'vehicles')
    const { data: cachedVehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate', plate)
      .single();

    let vehicleRecord = cachedVehicle;

    // 4. Se não estiver no cache, busca na API (ou gera Mock realista enquanto USE_MOCK=true)
    if (!vehicleRecord) {
      const useMock = process.env.USE_MOCK !== 'false';
      let fullData: Record<string, unknown>;

      if (useMock) {
        fullData = {
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
      } else {
        throw new Error('API externa ainda não configurada. Mantenha USE_MOCK=true no .env.local');
      }

      const { data: inserted, error: insertError } = await supabase
        .from('vehicles')
        .insert({
          plate,
          brand: fullData.brand,
          model: fullData.model,
          year: fullData.year,
          raw_data: fullData,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      vehicleRecord = inserted;
    }

    // 5. Filtra a resposta conforme o status de pagamento
    const raw = vehicleRecord.raw_data;

    if (!isPaidUnlock) {
      return NextResponse.json({
        source: cachedVehicle ? 'cache' : 'api_mock',
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
      source: cachedVehicle ? 'cache' : 'api_mock',
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