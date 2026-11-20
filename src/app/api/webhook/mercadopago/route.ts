import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'

/*
 * Pré-requisitos (configurar fora deste arquivo):
 *
 * 1) Variável de ambiente MP_WEBHOOK_SECRET: "Assinatura secreta" exibida em
 *    Mercado Pago > Suas integrações > Webhooks.
 *
 * 2) Tabela de idempotência no Supabase (a chave primária garante que um mesmo
 *    payment_id seja processado apenas uma vez, mesmo com chamadas concorrentes):
 *
 *    create table if not exists public.mp_processed_payments (
 *      payment_id text primary key,
 *      user_id    uuid not null,
 *      credits    integer not null,
 *      created_at timestamptz not null default now()
 *    );
 *    alter table public.mp_processed_payments enable row level security;
 *    -- sem policies: apenas a service role (que ignora RLS) acessa a tabela.
 */

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ''
})

const MAX_CREDITS_PER_PAYMENT = 1000
const MAX_UPDATE_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'

// Valida o header x-signature conforme a documentação do Mercado Pago:
// manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" assinado com HMAC-SHA256.
function isValidSignature(request: Request, dataId: string, secret: string): boolean {
  const signatureHeader = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  if (!signatureHeader || !requestId) return false

  let ts = ''
  let v1 = ''
  for (const part of signatureHeader.split(',')) {
    const [key, ...rest] = part.split('=')
    const value = rest.join('=').trim()
    if (key?.trim() === 'ts') ts = value
    else if (key?.trim() === 'v1') v1 = value
  }
  if (!ts || !v1) return false

  // O Mercado Pago exige o data.id em minúsculas quando alfanumérico
  const normalizedId = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(v1, 'hex')

  return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf)
}

interface PaymentReference {
  userId: string
  creditsToAdd: number
}

function parseExternalReference(raw: string): PaymentReference | null {
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; creditsToAdd?: unknown }
    const { userId, creditsToAdd } = parsed

    if (typeof userId !== 'string' || userId.length === 0) return null
    if (
      typeof creditsToAdd !== 'number' ||
      !Number.isInteger(creditsToAdd) ||
      creditsToAdd <= 0 ||
      creditsToAdd > MAX_CREDITS_PER_PAYMENT
    ) {
      return null
    }

    return { userId, creditsToAdd }
  } catch {
    return null
  }
}

// Soma créditos com update condicional ao saldo lido (evita perder atualizações concorrentes)
async function addCredits(
  supabaseAdmin: SupabaseClient,
  userId: string,
  creditsToAdd: number
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('Webhook MP: perfil não encontrado para o usuário', userId, profileError)
      return false
    }

    const currentRaw = profile.credits as number | null
    const current = currentRaw ?? 0

    let query = supabaseAdmin
      .from('profiles')
      .update({ credits: current + creditsToAdd })
      .eq('id', userId)
    query = currentRaw === null ? query.is('credits', null) : query.eq('credits', currentRaw)

    const { data: updated, error: updateError } = await query.select('id')

    if (updateError) {
      console.error('Webhook MP: erro ao atualizar créditos:', updateError)
      return false
    }

    if (updated && updated.length > 0) return true
    // O saldo mudou entre a leitura e a escrita: tenta novamente
  }

  return false
}

export async function POST(request: Request) {
  try {
    // Criado dentro do handler: se a chave de serviço faltar, o erro é logado de forma clara
    // em vez de derrubar o carregamento do módulo.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Webhook MP: SUPABASE_SERVICE_ROLE_KEY não definida — os créditos não podem ser adicionados.')
      return NextResponse.json({ error: 'Configuração ausente' }, { status: 500 })
    }

    const webhookSecret = process.env.MP_WEBHOOK_SECRET
    if (!webhookSecret) {
      // Falha fechada: sem segredo não há como provar a autenticidade da notificação
      console.error('Webhook MP: MP_WEBHOOK_SECRET não definida — notificação rejeitada.')
      return NextResponse.json({ error: 'Configuração ausente' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const url = new URL(request.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('data.id') || url.searchParams.get('id')

    // 1. Autenticidade: assinatura HMAC enviada pelo Mercado Pago
    if (!id || !isValidSignature(request, id, webhookSecret)) {
      console.warn('Webhook MP: assinatura inválida ou ausente — notificação rejeitada.')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    if (topic !== 'payment') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // 2. Consulta o pagamento direto na API do Mercado Pago (nunca confia no corpo recebido)
    const payment = new Payment(client)
    const paymentInfo = await payment.get({ id: Number(id) })

    if (!paymentInfo || String(paymentInfo.id) !== String(id)) {
      console.error('Webhook MP: pagamento retornado não corresponde ao id notificado:', id)
      return NextResponse.json({ error: 'Pagamento inconsistente' }, { status: 400 })
    }

    if (paymentInfo.status !== 'approved' || !paymentInfo.external_reference) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const reference = parseExternalReference(paymentInfo.external_reference)
    if (!reference) {
      // Resposta 200: reenviar a mesma notificação não corrigiria uma referência inválida
      console.error('Webhook MP: external_reference inválida no pagamento', id)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const { userId, creditsToAdd } = reference
    const paymentId = String(paymentInfo.id)

    // 3. Idempotência: reserva o payment_id. A chave primária impede reserva duplicada,
    //    inclusive com notificações simultâneas do mesmo pagamento.
    const { error: claimError } = await supabaseAdmin
      .from('mp_processed_payments')
      .insert({ payment_id: paymentId, user_id: userId, credits: creditsToAdd })

    if (claimError) {
      if (claimError.code === UNIQUE_VIOLATION) {
        console.log('Webhook MP: pagamento já processado, ignorando:', paymentId)
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }

      console.error('Webhook MP: erro ao registrar idempotência:', claimError)
      return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
    }

    // 4. Credita o usuário; se falhar, libera a reserva para o Mercado Pago poder reenviar
    const credited = await addCredits(supabaseAdmin, userId, creditsToAdd)

    if (!credited) {
      const { error: releaseError } = await supabaseAdmin
        .from('mp_processed_payments')
        .delete()
        .eq('payment_id', paymentId)

      if (releaseError) {
        console.error('Webhook MP: falha ao liberar reserva do pagamento', paymentId, releaseError)
      }

      return NextResponse.json({ error: 'Falha ao creditar usuário' }, { status: 500 })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Erro no webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}