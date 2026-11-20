import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 3

// Campos permitidos em consultations.vehicle_data (mesmo formato lido por /historico)
const VEHICLE_FIELDS = ['placa', 'marca', 'modelo', 'ano', 'cor', 'cidade', 'fipe'] as const

function sanitizeVehicleData(input: unknown, plate: string): Record<string, string> {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const result: Record<string, string> = {}

  for (const field of VEHICLE_FIELDS) {
    const value = source[field]
    if (typeof value === 'string' || typeof value === 'number') {
      result[field] = String(value).slice(0, 200)
    }
  }

  result.placa = plate
  return result
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request) {
  const admin = getAdminClient()
  if (!admin) {
    console.error('[desbloquear] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente')
    return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 })
  }

  // 1. Valida a sessão do usuário pelo access token enviado
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Sessão não informada.' }, { status: 401 })
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }
  const userId = userData.user.id

  // 2. Valida o corpo da requisição
  let body: { plate?: unknown; vehicleData?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const plate = typeof body.plate === 'string' ? body.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
  if (plate.length !== 7) {
    return NextResponse.json({ error: 'Placa inválida.' }, { status: 400 })
  }

  // 3. Se o usuário já consultou esta placa, não cobra novamente
  const { data: existingRows, error: existingError } = await admin
    .from('consultations')
    .select('id, vehicle_data')
    .eq('user_id', userId)
    .eq('plate', plate)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingError) {
    console.error('[desbloquear] Erro ao verificar histórico:', existingError)
    return NextResponse.json({ error: 'Erro ao verificar histórico.' }, { status: 500 })
  }

  if (existingRows && existingRows.length > 0) {
    const { data: profile } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      charged: false,
      credits: typeof profile?.credits === 'number' ? profile.credits : 0,
      consultationId: existingRows[0].id,
    })
  }

  // 4. Desconta 1 crédito de forma atômica (update condicional ao saldo lido)
  let newBalance: number | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile || typeof profile.credits !== 'number') {
      console.error('[desbloquear] Erro ao buscar perfil:', profileError)
      return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
    }

    if (profile.credits <= 0) {
      return NextResponse.json({ error: 'Saldo de créditos insuficiente.' }, { status: 402 })
    }

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', userId)
      .eq('credits', profile.credits)
      .select('credits')

    if (updateError) {
      console.error('[desbloquear] Erro ao descontar crédito:', updateError)
      return NextResponse.json({ error: 'Não foi possível descontar o crédito.' }, { status: 500 })
    }

    if (updated && updated.length > 0) {
      newBalance = updated[0].credits as number
      break
    }
    // Saldo mudou entre a leitura e a escrita: tenta novamente
  }

  if (newBalance === null) {
    return NextResponse.json(
      { error: 'Conflito ao atualizar o saldo. Tente novamente.' },
      { status: 409 }
    )
  }

  // 5. Salva no histórico; se falhar, estorna o crédito
  const { data: inserted, error: insertError } = await admin
    .from('consultations')
    .insert({
      user_id: userId,
      plate,
      vehicle_data: sanitizeVehicleData(body.vehicleData, plate),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[desbloquear] Erro ao salvar consulta, estornando crédito:', insertError)

    const { data: current } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()

    if (current && typeof current.credits === 'number') {
      const { error: refundError } = await admin
        .from('profiles')
        .update({ credits: current.credits + 1 })
        .eq('id', userId)
        .eq('credits', current.credits)

      if (refundError) {
        console.error('[desbloquear] Falha ao estornar crédito:', refundError)
      }
    }

    return NextResponse.json({ error: 'Não foi possível salvar a consulta.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    charged: true,
    credits: newBalance,
    consultationId: inserted?.id ?? null,
  })
}
