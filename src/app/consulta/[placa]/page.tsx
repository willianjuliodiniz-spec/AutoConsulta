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

      // 2. Busca dados básicos/parciais do veículo no Supabase (ou fallback realista para teste)
      const { data: dbVehicle } = await supabase
        .from('vehicles')
        .select('plate, brand, model, year, raw_data')
        .eq('plate', placa)
        .maybeSingle()

      if (savedData) {
        setVehicle(fromSavedVehicleData(placa, savedData))
        setIsUnlocked(true)
        setFromHistory(true)
      } else if (dbVehicle) {
        setVehicle({
          plate: dbVehicle.plate,
          brand: dbVehicle.brand || 'Veículo',
          model: dbVehicle.model || 'Identificado',
          year: dbVehicle.year || '2022/2023',
          fipeValue: 'R$ 68.450,00',
          city: 'Natal / RN',
          color: 'Prata',
        })
      } else {
        // Preview simulado enquanto a API externa não é conectada
        setVehicle({
          plate: placa,
          brand: 'VOLKSWAGEN',
          model: 'T-CROSS 200 TSI FLEX AUT.',
          year: '2022/2023',
          fipeValue: 'R$ 104.890,00',
          city: 'Natal / RN',
          color: 'Cinza Platinum',
        })
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
    setUnlocking(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const newBalance = credits - 1
        const { error: creditError } = await supabase
          .from('profiles')
          .update({ credits: newBalance })
          .eq('id', session.user.id)

        if (creditError) {
          console.error('Erro ao descontar crédito:', creditError)
          alert('Não foi possível descontar o crédito. Tente novamente.')
          return
        }

        setCredits(newBalance)
        setIsUnlocked(true)

        // Salva a consulta no histórico do usuário
        const { error: insertError } = await supabase.from('consultations').insert({
          user_id: session.user.id,
          plate: placa.toUpperCase(),
          vehicle_data: toSavedVehicleData(vehicle),
        })

        if (insertError) {
          console.error('Erro ao salvar consulta no histórico:', insertError)
        }
      }
    } finally {
      setUnlocking(false)
    }
  }

  // Redireciona para o fluxo de checkout do plano escolhido
  const handleSelectPlan = async (plan: '1-credito' | '3-creditos') => {
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
                <i className="fa-solid fa-triangle-exclamation"></i> 4 Registros Ocultos
              </span>
            </div>
            <div className="bg-[#0B0F19] border border-gray-800/80 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 mb-1">Chassi / Renavam</span>
              <span className="text-sm font-mono font-bold text-gray-500 flex items-center gap-1.5">
                <i className="fa-solid fa-lock text-xs"></i> 9BW***********
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

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Passagem por Leilão</div>
                <div className="text-sm font-bold text-emerald-400">Nada Consta (Sem registro)</div>
              </div>
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Indício de Sinistro / PT</div>
                <div className="text-sm font-bold text-emerald-400">Nada Consta</div>
              </div>
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Roubo e Furto</div>
                <div className="text-sm font-bold text-emerald-400">Veículo sem restrição</div>
              </div>
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Gravame / Financiamento</div>
                <div className="text-sm font-bold text-white">Livre de alienação</div>
              </div>
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Débitos e Multas</div>
                <div className="text-sm font-bold text-amber-400">R$ 293,47 em aberto (2 multas)</div>
              </div>
              <div className="bg-[#0B0F19] border border-gray-800 p-4 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Histórico de KM</div>
                <div className="text-sm font-bold text-white">48.200 km (Coerente)</div>
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