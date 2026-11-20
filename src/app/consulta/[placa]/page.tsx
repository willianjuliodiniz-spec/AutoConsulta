'use client'

import React, { useEffect, useState, use, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'

interface PageProps {
  params: Promise<{ placa: string }>
}

interface VehiclePreview {
  plate: string
  brand: string
  model: string
  year: string
  fipeValue: string
  city: string
  color: string
}

// Formato salvo em consultations.vehicle_data (mesmas chaves lidas pela página /historico)
interface SavedVehicleData {
  placa?: string
  marca?: string
  modelo?: string
  ano?: string | number
  cor?: string
  cidade?: string
  fipe?: string
}

function toSavedVehicleData(v: VehiclePreview): SavedVehicleData {
  return {
    placa: v.plate,
    marca: v.brand,
    modelo: v.model,
    ano: v.year,
    cor: v.color,
    cidade: v.city,
    fipe: v.fipeValue,
  }
}

function fromSavedVehicleData(plate: string, d: SavedVehicleData): VehiclePreview {
  return {
    plate,
    brand: d.marca || 'Veículo',
    model: d.modelo || 'Consultado',
    year: d.ano !== undefined ? String(d.ano) : '-',
    fipeValue: d.fipe || '-',
    city: d.cidade || '-',
    color: d.cor || '-',
  }
}

// Formato de vehicles.raw_data (mesmo shape gravado/consumido por /api/consultar)
interface RecordInfo {
  hasRecord?: boolean
  details?: string
}

interface VehicleReport {
  auction?: RecordInfo
  sinistro?: RecordInfo
  theftAlert?: RecordInfo
  renajud?: RecordInfo
  debts?: { total?: string; ipva?: string; licensing?: string }
}

interface RawVehicleData {
  isMock?: boolean
  brand?: string
  model?: string
  year?: string | number
  modelYear?: string | number
  color?: string
  city?: string
  state?: string
  fipe?: { code?: string; value?: string; reference?: string }
  security?: VehicleReport
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Detecta registros fictícios. A flag explícita tem prioridade (isMock: false = dado real do provedor);
// a assinatura do mock legado só vale para registros antigos gravados no cache sem flag.
function isMockRaw(raw: RawVehicleData | null | undefined): boolean {
  if (!raw) return false
  if (raw.isMock === true) return true
  if (raw.isMock === false) return false
  return (
    raw.brand === 'VOLKSWAGEN' &&
    raw.model === 'NIVUS HIGHLINE 200 TSI 1.0 FLEX AUT.' &&
    raw.fipe?.code === '005526-3'
  )
}

function formatRecord(info: RecordInfo | undefined): { text: string; tone: string } {
  if (!info || typeof info.hasRecord !== 'boolean') {
    return { text: 'Informação não disponível', tone: 'text-gray-400' }
  }
  if (info.hasRecord) {
    return { text: info.details || 'Registro encontrado', tone: 'text-amber-400' }
  }
  return { text: info.details || 'Nada consta', tone: 'text-emerald-400' }
}

type ConsultaFailure = 'limit' | 'not_found' | 'unavailable'

interface PreviewResult {
  vehicle?: VehiclePreview
  mock: boolean
  failure?: ConsultaFailure
  message?: string
}

function previewFromRaw(plate: string, raw: RawVehicleData): VehiclePreview {
  const cityState = [raw.city, raw.state].filter(Boolean).join(' / ')
  const rawYear = raw.year ?? raw.modelYear
  return {
    plate,
    brand: raw.brand || '-',
    model: raw.model || '-',
    year: rawYear !== undefined && rawYear !== null ? String(rawYear) : '-',
    fipeValue: raw.fipe?.value || '-',
    city: cityState || '-',
    color: raw.color || '-',
  }
}

// Consulta real (servidor) para a prévia gratuita. A chave do provedor nunca chega ao navegador.
async function fetchPreview(plate: string): Promise<PreviewResult> {
  try {
    const response = await fetch('/api/consultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.status === 429) return { mock: false, failure: 'limit', message: data.message }
    if (response.status === 404) return { mock: false, failure: 'not_found', message: data.message }
    if (!response.ok || !data.vehicle) return { mock: false, failure: 'unavailable', message: data.message }

    const isMock = data.mock === true
    // Em produção, qualquer dado marcado como fictício é descartado
    if (isMock && IS_PRODUCTION) return { mock: false, failure: 'unavailable' }

    return { vehicle: previewFromRaw(plate, data.vehicle as RawVehicleData), mock: isMock }
  } catch (err) {
    console.error('Erro ao consultar /api/consultar:', err)
    return { mock: false, failure: 'unavailable' }
  }
}

// Laudo completo: o servidor valida o token e se a placa já foi desbloqueada pelo usuário
async function fetchFullReport(
  plate: string,
  accessToken: string
): Promise<{ report: VehicleReport | null; mock: boolean } | null> {
  try {
    const response = await fetch('/api/consultar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ plate, unlocked: true }),
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    if (!data?.vehicle) return null

    const mock = data.mock === true
    if (mock && IS_PRODUCTION) return null

    return { report: (data.vehicle as RawVehicleData).security ?? null, mock }
  } catch (err) {
    console.error('Erro ao buscar laudo completo:', err)
    return null
  }
}

function failureMessage(failure: ConsultaFailure | null, message?: string): string {
  if (message) return message
  if (failure === 'limit') return 'Você atingiu o limite de consultas gratuitas de hoje. Tente novamente amanhã.'
  if (failure === 'not_found') return 'Não encontramos dados para esta placa.'
  return 'Não foi possível obter informações reais deste veículo no momento. Tente novamente mais tarde.'
}

// 1. Componente interno que contém toda a lógica da página e os hooks
function ConsultaContent({ params }: PageProps) {
  const resolvedParams = use(params)
  const placa = resolvedParams.placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const router = useRouter()
  const searchParams = useSearchParams() // Seguro aqui dentro do Suspense

  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState<number>(0)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [unlocking, setUnlocking] = useState<boolean>(false)
  const [fromHistory, setFromHistory] = useState<boolean>(false)
  const [vehicle, setVehicle] = useState<VehiclePreview | null>(null)
  const [report, setReport] = useState<VehicleReport | null>(null)
  const [isMockData, setIsMockData] = useState<boolean>(false)
  const [failure, setFailure] = useState<ConsultaFailure | null>(null)
  const [failureText, setFailureText] = useState<string | undefined>(undefined)
  const historicoId = searchParams.get('historicoId')

  useEffect(() => {
    async function initConsulta() {
      // 1. Verifica se o usuário está autenticado (Barreira de Login)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace(`/login?placa=${placa}`)
        return
      }

      // 1.1 Se o usuário já consultou esta placa (ou veio do histórico), libera sem cobrar novo crédito
      let savedQuery = supabase
        .from('consultations')
        .select('id, vehicle_data')
        .eq('user_id', session.user.id)
        .eq('plate', placa)
      if (historicoId) {
        savedQuery = savedQuery.eq('id', historicoId)
      }
      const { data: savedRows } = await savedQuery
        .order('created_at', { ascending: false })
        .limit(1)
      const savedData = (savedRows?.[0]?.vehicle_data ?? null) as SavedVehicleData | null

      // 2. Busca dados do veículo no Supabase. Nunca inventamos dados: se não houver registro, mostramos indisponibilidade.
      const { data: dbVehicle } = await supabase
        .from('vehicles')
        .select('plate, brand, model, year, raw_data')
        .eq('plate', placa)
        .maybeSingle()

      const dbRaw = (dbVehicle?.raw_data ?? null) as RawVehicleData | null
      const dbIsMock = isMockRaw(dbRaw)
      // Em produção, registros fictícios ou sem raw_data verificável são descartados (a consulta cai no servidor);
      // em dev/teste os fictícios são exibidos com aviso explícito.
      const dbUsable = Boolean(dbVehicle) && !(IS_PRODUCTION && (dbIsMock || !dbRaw))

      if (savedData) {
        setVehicle(fromSavedVehicleData(placa, savedData))
        setIsUnlocked(true)
        setFromHistory(true)
        // Laudo completo vem do servidor (valida token e desbloqueio prévio)
        const full = await fetchFullReport(placa, session.access_token)
        if (full) {
          setReport(full.report)
          setIsMockData(full.mock)
        } else if (dbVehicle && dbUsable) {
          setReport(dbRaw?.security ?? null)
          setIsMockData(dbIsMock)
        }
      } else if (dbVehicle && dbUsable) {
        const cityState = [dbRaw?.city, dbRaw?.state].filter(Boolean).join(' / ')
        const rawYear = dbVehicle.year ?? dbRaw?.year
        setVehicle({
          plate: dbVehicle.plate,
          brand: dbVehicle.brand || dbRaw?.brand || '-',
          model: dbVehicle.model || dbRaw?.model || '-',
          year: rawYear !== undefined && rawYear !== null ? String(rawYear) : '-',
          fipeValue: dbRaw?.fipe?.value || '-',
          city: cityState || '-',
          color: dbRaw?.color || '-',
        })
        setReport(dbRaw?.security ?? null)
        setIsMockData(dbIsMock)
      } else {
        // Sem cache: consulta o provedor real via servidor. Sem dados reais, não exibe prévia fictícia.
        const preview = await fetchPreview(placa)
        if (preview.vehicle) {
          setVehicle(preview.vehicle)
          setIsMockData(preview.mock)
        } else {
          setVehicle(null)
          setFailure(preview.failure ?? 'unavailable')
          setFailureText(preview.message)
        }
      }

      // 3. Busca saldo de créditos do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile && typeof profile.credits === 'number') {
        setCredits(profile.credits)
      }

      setLoading(false)
    }

    initConsulta()
  }, [placa, router, historicoId])

  // Consome 1 crédito caso o usuário já tenha saldo
  const handleUseCredit = async () => {
    if (credits <= 0 || !vehicle) return
    // Crédito e histórico só valem para consultas reais e válidas
    if (isMockData) {
      alert('Dados fictícios (mock) não podem ser desbloqueados com crédito.')
      return
    }
    if (vehicle.brand === '-' || vehicle.model === '-') {
      alert('Não há dados válidos deste veículo. Nenhum crédito foi descontado.')
      return
    }
    setUnlocking(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?placa=${placa}`)
        return
      }

      // O desconto do crédito e o salvamento no histórico acontecem no servidor
      const response = await fetch('/api/consulta/desbloquear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plate: placa,
          vehicleData: toSavedVehicleData(vehicle),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        console.error('Erro ao desbloquear consulta:', data)
        if (response.status === 401) {
          router.push(`/login?placa=${placa}`)
          return
        }
        alert(data.error || 'Não foi possível descontar o crédito. Tente novamente.')
        return
      }

      if (typeof data.credits === 'number') {
        setCredits(data.credits)
      }
      setIsUnlocked(true)

      // Após o desbloqueio, busca o laudo completo no servidor
      const full = await fetchFullReport(placa, session.access_token)
      if (full) {
        setReport(full.report)
        setIsMockData(full.mock)
      }
    } catch (err) {
      console.error('Erro ao chamar rota de desbloqueio:', err)
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setUnlocking(false)
    }
  }

  // Redireciona para o fluxo de checkout do plano escolhido
  const handleSelectPlan = async (plan: '1-credito' | '3-creditos') => {
    // Não cobra por consulta sem dados reais e válidos
    if (!vehicle || isMockData || vehicle.brand === '-' || vehicle.model === '-') {
      alert('Não há dados reais e válidos para esta placa. Nenhuma cobrança foi realizada.')
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?placa=${placa}`)
        return
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          userId: session.user.id,
          plate: placa,
        }),
      })

      const data = await response.json()

      if (data.init_point) {
        window.location.href = data.init_point
      } else {
        console.error('Resposta da API:', data)
        alert('Erro ao gerar link de pagamento. Veja o console.')
      }
    } catch (err) {
      console.error('Erro ao chamar checkout:', err)
      alert('Erro de conexão ao processar pagamento.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col items-center justify-center">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-4xl mb-4"></i>
        <p className="text-sm text-gray-400 font-medium">Consultando bases nacionais para <span className="text-white font-mono font-bold">{placa}</span>...</p>
      </div>
    )
  }

  // Sem dados reais do veículo: não exibimos prévia fictícia nem oferecemos desbloqueio/pagamento
  if (!vehicle) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 font-sans antialiased pb-20">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <Navbar creditsRefreshKey={credits}>
          <Link
            href="/"
            className="text-gray-300 hover:text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl bg-[#111827] border border-gray-800 hover:border-gray-700 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-magnifying-glass text-emerald-400"></i>
            <span>Nova Placa</span>
          </Link>
        </Navbar>
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 text-center">
          <div className="bg-[#111827] border border-amber-500/30 rounded-2xl p-8 shadow-2xl">
            <i className="fa-solid fa-triangle-exclamation text-amber-400 text-3xl mb-4"></i>
            <h1 className="text-xl font-extrabold text-white mb-2">
              Dados indisponíveis para a placa <span className="font-mono text-emerald-400">{placa}</span>
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {failureMessage(failure, failureText)} Nenhum crédito foi descontado e nenhuma cobrança foi realizada.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B0F19] font-extrabold text-sm transition-colors"
            >
              Consultar outra placa
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 font-sans antialiased selection:bg-emerald-500 selection:text-white pb-20">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      {/* HEADER PADRÃO DO SISTEMA (componente compartilhado) */}
      <Navbar creditsRefreshKey={credits}>
        <Link
          href="/"
          className="text-gray-300 hover:text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl bg-[#111827] border border-gray-800 hover:border-gray-700 transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-magnifying-glass text-emerald-400"></i>
          <span>Nova Placa</span>
        </Link>
      </Navbar>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">

        {/* AVISO EXPLÍCITO: dados fictícios (apenas dev/teste) */}
        {isMockData && !IS_PRODUCTION && (
          <div className="mb-6 rounded-xl border-2 border-amber-500 bg-amber-950/40 px-4 py-3 text-sm font-bold text-amber-300 flex items-center gap-2">
            <i className="fa-solid fa-flask"></i>
            DADOS FICTÍCIOS (MOCK) — ambiente de desenvolvimento/teste. Estas informações NÃO são reais.
          </div>
        )}

        {/* CARD PRINCIPAL DO VEÍCULO ENCONTRADO (DADOS PARCIAIS GRATUITOS) */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-800 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Veículo Identificado nas Bases Nacionais
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {vehicle?.brand} {vehicle?.model}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Ano Modelo: <strong className="text-gray-200">{vehicle?.year}</strong> • Cor: <strong className="text-gray-200">{vehicle?.color}</strong> • UF: <strong className="text-gray-200">{vehicle?.city}</strong>
              </p>
            </div>

            {/* Placa estilo Mercosul */}
            <div className="bg-white text-gray-900 rounded-xl border-2 border-gray-300 w-44 overflow-hidden shadow-lg shrink-0">
              <div className="bg-[#003399] text-white text-[10px] font-bold px-2.5 py-0.5 flex justify-between items-center">
                <span>BRASIL</span>
                <span>MERCOSUL</span>
              </div>
              <div className="text-center py-2 font-mono font-black text-2xl tracking-widest">
                {placa}
              </div>
            </div>
          </div>

          {/* DADOS PARCIAIS LIBERADOS (ISCA DE CURIOSIDADE) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            <div className="bg-[#0B0F19] border border-gray-800/80 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 mb-1">Tabela FIPE Atual</span>
              <span className="text-base sm:text-lg font-extrabold text-emerald-400">{vehicle?.fipeValue}</span>
            </div>
            <div className="bg-[#0B0F19] border border-gray-800/80 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 mb-1">Situação Cadastral</span>
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-400"></i> Localizado
              </span>
            </div>
            <div className="bg-[#0B0F19] border border-amber-500/30 p-4 rounded-xl">
              <span className="block text-xs text-amber-400/80 mb-1">Alertas de Risco</span>
              <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-triangle-exclamation"></i> Disponíveis no laudo
              </span>
            </div>
            <div className="bg-[#0B0F19] border border-gray-800/80 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 mb-1">Chassi / Renavam</span>
              <span className="text-sm font-mono font-bold text-gray-500 flex items-center gap-1.5">
                <i className="fa-solid fa-lock text-xs"></i> Oculto
              </span>
            </div>
          </div>
        </div>

        {/* SE JÁ DESBLOQUEOU COM CRÉDITO, MOSTRA O RELATÓRIO COMPLETO */}
        {isUnlocked ? (
          <div className="bg-[#111827] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                <i className="fa-solid fa-file-shield text-emerald-400"></i>
                Laudo Veicular Completo Liberado
              </h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                {fromHistory ? 'Consulta do Histórico (sem custo)' : '1 Crédito Utilizado'}
              </span>
            </div>

            {!report && (
              <p className="text-sm text-amber-400">
                Os detalhes do laudo não estão disponíveis para esta placa no momento.
              </p>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Passagem por Leilão', info: report?.auction },
                { title: 'Indício de Sinistro / PT', info: report?.sinistro },
                { title: 'Roubo e Furto', info: report?.theftAlert },
                { title: 'Restrição Judicial (Renajud)', info: report?.renajud },
              ].map((item) => {
                const status = formatRecord(item.info)
                return (
                  <div key={item.title} className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                    <div className="text-xs text-gray-400 mb-1">{item.title}</div>
                    <div className={`text-sm font-bold ${status.tone}`}>{status.text}</div>
                  </div>
                )
              })}
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Débitos e Multas</div>
                {report?.debts ? (
                  <div className="text-sm font-bold text-white space-y-0.5">
                    <div>Total: {report.debts.total ?? 'Informação não disponível'}</div>
                    <div className="text-xs font-semibold text-gray-300">IPVA: {report.debts.ipva ?? 'Informação não disponível'}</div>
                    <div className="text-xs font-semibold text-gray-300">Licenciamento: {report.debts.licensing ?? 'Informação não disponível'}</div>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-gray-400">Informação não disponível</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* BARREIRA DE CONVERSÃO (DADOS OCULTOS + PREÇO ÂNCORA) */
          <div className="space-y-8">
            
            {/* PRÉVIA BORRADA DOS DADOS CRÍTICOS (GATILHO DE CURIOSIDADE) */}
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-lock text-amber-400"></i>
                  Informações Críticas Bloqueadas
                </h2>
                <span className="text-xs text-amber-400 font-semibold">
                  Libere agora para evitar prejuízos
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 select-none">
                {[
                  { title: 'Passagem por Leilão', desc: 'Verificação em bases de seguradoras e pátios' },
                  { title: 'Histórico de Sinistro / PT', desc: 'Colisões graves e indenização integral' },
                  { title: 'Roubo e Furto Ativo', desc: 'Consulta direta na base policial nacional' },
                  { title: 'Multas, IPVA e Restrições', desc: 'Valores detalhados e bloqueios judiciais' },
                  { title: 'Gravame Financeiro', desc: 'Alienação fiduciária e financiamento ativo' },
                  { title: 'Histórico de Quilometragem', desc: 'Detecção de adulteração de odômetro' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-gray-200">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      <div className="mt-2 inline-block px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-[11px] font-mono blur-[3px]">
                        STATUS OCULTO
                      </div>
                    </div>
                    <i className="fa-solid fa-lock text-gray-600 text-sm mt-1"></i>
                  </div>
                ))}
              </div>
            </div>

            {/* SE O USUÁRIO JÁ TIVER CRÉDITOS DISPONÍVEIS */}
            {credits > 0 ? (
              <div className="bg-emerald-950/30 border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 text-center">
                <h3 className="text-xl font-extrabold text-white mb-2">
                  Você possui {credits} {credits === 1 ? 'crédito disponível' : 'créditos disponíveis'}!
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  Use 1 crédito agora para revelar o dossiê completo da placa <strong className="font-mono text-emerald-400">{placa}</strong>.
                </p>
                <button
                  onClick={handleUseCredit}
                  disabled={unlocking}
                  type="button"
                  className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B0F19] font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {unlocking ? 'Liberando Laudo...' : 'Usar 1 Crédito e Liberar Agora'}
                </button>
              </div>
            ) : (
              /* OFERTA DE PREÇO ÂNCORA (1 CRÉDITO VS PACOTE DE 3 CRÉDITOS) */
              <div id="desbloquear" className="pt-2">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    Escolha como deseja desbloquear a placa <span className="text-emerald-400 font-mono">{placa}</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-2">
                    Liberação imediata após a confirmação do pagamento.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {/* OPÇÃO 1: UNITÁRIO CARO (ANCORAGEM) */}
                  <div className="bg-[#111827] border border-gray-800 p-7 rounded-3xl flex flex-col justify-between">
                    <div>
                      <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Consulta Avulsa</div>
                      <h3 className="text-xl font-bold text-white mb-3">1 Crédito (Apenas este carro)</h3>
                      <div className="text-3xl sm:text-4xl font-extrabold text-white mb-5">
                        R$ 29,90 <span className="text-xs font-normal text-gray-400">/ pagamento único</span>
                      </div>
                      <ul className="space-y-3 text-gray-300 text-sm mb-7">
                        <li className="flex items-center gap-2.5">
                          <i className="fa-solid fa-check text-emerald-400"></i> Libera o laudo completo da placa <strong>{placa}</strong>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <i className="fa-solid fa-check text-emerald-400"></i> Leilão, sinistro, multas e gravame
                        </li>
                        <li className="flex items-center gap-2.5 text-gray-500">
                          <i className="fa-solid fa-xmark"></i> Sem créditos extras para outros veículos
                        </li>
                      </ul>
                    </div>
                    <button
                      onClick={() => handleSelectPlan('1-credito')}
                      type="button"
                      className="w-full py-3.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-colors cursor-pointer"
                    >
                      Desbloquear Apenas Esta Placa
                    </button>
                  </div>

                  {/* OPÇÃO 2: PACOTE 3 CRÉDITOS (ESCOLHA INDUZIDA) */}
                  <div className="bg-gradient-to-b from-emerald-950/40 to-[#111827] border-2 border-emerald-500 p-7 rounded-3xl flex flex-col justify-between relative shadow-2xl shadow-emerald-950/40">
                    <div className="absolute -top-3.5 right-6 bg-emerald-500 text-[#0B0F19] text-xs font-black uppercase px-3 py-1 rounded-full shadow-lg">
                      Recomendado • Leve 3 por quase o preço de 1
                    </div>
                    <div>
                      <div className="text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-1">Pacote Inteligente</div>
                      <h3 className="text-xl font-bold text-white mb-3">3 Créditos Completos</h3>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white">R$ 39,90</span>
                        <span className="text-xs text-gray-400 line-through">R$ 89,70</span>
                      </div>
                      <p className="text-xs text-emerald-400 font-semibold mb-5">
                        Sai a apenas R$ 13,30 por consulta (Economia de R$ 49,80)
                      </p>
                      <ul className="space-y-3 text-gray-200 text-sm mb-7">
                        <li className="flex items-center gap-2.5">
                          <i className="fa-solid fa-check text-emerald-400"></i> Libera a placa <strong>{placa}</strong> agora mesmo
                        </li>
                        <li className="flex items-center gap-2.5">
                          <i className="fa-solid fa-check text-emerald-400"></i> <strong>+ 2 créditos extras</strong> ficam na sua conta
                        </li>
                        <li className="flex items-center gap-2.5">
                          <i className="fa-solid fa-check text-emerald-400"></i> Créditos não expiram (use quando quiser)
                        </li>
                      </ul>
                    </div>
                    <button
                      onClick={() => handleSelectPlan('3-creditos')}
                      type="button"
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B0F19] font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Garantir 3 Consultas por R$ 39,90</span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// 2. Componente principal exportado que envolve o conteúdo em <Suspense>
export default function ConsultaPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-emerald-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    }>
      <ConsultaContent params={params} />
    </Suspense>
  )
}