'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { Logo } from '@/components/Logo'

const LANDING_LINKS = [
  { href: '#recursos', label: 'O que revela' },
  { href: '#publico', label: 'Para quem é' },
  { href: '#planos', label: 'Planos' },
  { href: '#depoimentos', label: 'Depoimentos' },
  { href: '#faq', label: 'FAQ' },
]

type PlanId = '1-credito' | '3-creditos'

const isPlanId = (value: string | null): value is PlanId =>
  value === '1-credito' || value === '3-creditos'

export default function LandingPage() {
  const [placa, setPlaca] = useState('')
  const [loading, setLoading] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [buyingPlan, setBuyingPlan] = useState<PlanId | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [creditsRefreshKey, setCreditsRefreshKey] = useState(0)
  
  const plateInputRef = useRef<HTMLInputElement>(null)
  const autoCheckoutStarted = useRef(false)
  const router = useRouter()

  // Inicia o pagamento no Mercado Pago. Sem sessão, envia para o login e volta aqui depois.
  const startCheckout = useCallback(async (plan: PlanId) => {
    setBuyingPlan(plan)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push(`/login?plano=${plan}`)
        return
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: session.user.id }),
      })
      const data = await response.json()

      if (data.init_point) {
        // Mantém o botão em "carregando" enquanto o navegador redireciona
        window.location.href = data.init_point
        return
      }

      console.error('Resposta da API:', data)
      alert('Erro ao gerar link de pagamento. Tente novamente.')
    } catch (err) {
      console.error('Erro ao chamar checkout:', err)
      alert('Erro de conexão ao processar pagamento.')
    }

    setBuyingPlan(null)
  }, [router])

  // Garante que o botão destrava se o usuário voltar para a página (BFCache do navegador)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setLoading(false)
        setBuyingPlan(null)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      setLoading(false) // Reseta ao desmontar/montar
    }
  }, [])

  // Trata os parâmetros de URL:
  //  - ?comprar=<plano>: usuário voltou do login com intenção de compra -> segue direto para o pagamento
  //  - ?status=<...>: retorno do Mercado Pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const planToBuy = params.get('comprar')
    const status = params.get('status')

    if (isPlanId(planToBuy)) {
      if (autoCheckoutStarted.current) return
      autoCheckoutStarted.current = true
      // Limpa a URL para que voltar do Mercado Pago não reinicie a compra
      window.history.replaceState(null, '', window.location.pathname)
      startCheckout(planToBuy)
      return
    }

    if (status) {
      // Adiado para fora do corpo síncrono do efeito (evita renderizações em cascata).
      // A URL só é limpa dentro do timer para sobreviver à dupla execução do Strict Mode.
      const timer = setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname)
        setPaymentStatus(status)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [startCheckout])

  // Após pagamento aprovado, o webhook credita de forma assíncrona: atualiza o saldo por alguns instantes
  useEffect(() => {
    if (paymentStatus !== 'success') return

    let attempts = 0
    const interval = setInterval(() => {
      attempts += 1
      setCreditsRefreshKey((key) => key + 1)
      if (attempts >= 10) clearInterval(interval)
    }, 3000)

    return () => clearInterval(interval)
  }, [paymentStatus])

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPlate = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!cleanPlate) return

    if (cleanPlate.length < 7) {
      alert('Digite uma placa válida (ex: ABC1D23)')
      return
    }

    setLoading(true)

    // Verifica se o usuário já tem sessão ativa no Supabase
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      router.push(`/consulta/${cleanPlate}`)
    } else {
      router.push(`/login?placa=${cleanPlate}`)
    }
  }

  const handleConsultarAgoraClick = async (e: React.MouseEvent) => {
    e.preventDefault()

    const cleanPlate = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    if (cleanPlate) {
      if (cleanPlate.length < 7) {
        alert('Digite uma placa válida (ex: ABC1D23)')
        return
      }
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push(`/consulta/${cleanPlate}`)
      } else {
        router.push(`/login?placa=${cleanPlate}`)
      }
      return
    }

    // Se estiver vazio, rola até o box e foca no input
    const box = document.getElementById('consulta-box')
    if (box) {
      box.scrollIntoView({ behavior: 'smooth' })
    }
    setTimeout(() => {
      plateInputRef.current?.focus()
    }, 300)
  }

  const handleGoToLogin = (params?: string) => {
    localStorage.removeItem('autoconsulta_pending_plate')
    sessionStorage.clear()
    router.push(params ? `/login?${params}` : '/login')
  }

  const toggleFaq = (id: number) => {
    setOpenFaq(openFaq === id ? null : id)
  }

  return (
    <div className="bg-[#0B0F19] text-gray-100 font-sans antialiased selection:bg-emerald-500 selection:text-white min-h-screen">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      {/* Header (componente compartilhado) */}
      <Navbar position="fixed" links={LANDING_LINKS} creditsRefreshKey={creditsRefreshKey}>
        <button
          onClick={handleConsultarAgoraClick}
          type="button"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F19] font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          Consultar Agora
        </button>
      </Navbar>

      {/* Aviso de retorno do pagamento */}
      {paymentStatus && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl">
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md ${
              paymentStatus === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : paymentStatus === 'pending'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
                : 'bg-red-950/90 border-red-500/50 text-red-100'
            }`}
          >
            <span className="flex-1">
              {paymentStatus === 'success'
                ? 'Pagamento aprovado! Seus créditos serão adicionados ao saldo em instantes.'
                : paymentStatus === 'pending'
                ? 'Pagamento pendente. Assim que for confirmado, seus créditos serão adicionados.'
                : 'O pagamento não foi concluído. Você pode tentar novamente quando quiser.'}
            </span>
            <button
              type="button"
              onClick={() => setPaymentStatus(null)}
              aria-label="Fechar aviso"
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="consulta-box" className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111827] border border-gray-800 text-emerald-400 text-xs font-semibold mb-6 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Tecnologia Avançada de Consulta Veicular em Tempo Real
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Evite Golpes e Descubra o Passado de Qualquer Veículo em <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Segundos</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Histórico completo, roubo e furto, restrições financeiras, leilão, gravame e quilometragem real direto das bases oficiais do Brasil.
            </p>

            {/* Barra Interativa de Input de Placa */}
            <div className="bg-[#111827]/90 border border-gray-800 p-3 sm:p-4 rounded-2xl shadow-2xl max-w-2xl mx-auto backdrop-blur-xl">
              <form onSubmit={handleConsult} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <i className="fa-solid fa-car-side text-lg"></i>
                  </div>
                  <input 
                    ref={plateInputRef}
                    type="text" 
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                    placeholder="Digite a placa (Ex: ABC1D23)" 
                    maxLength={7}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-[#0B0F19] border border-gray-700 rounded-xl text-white font-mono uppercase tracking-widest text-lg placeholder:text-gray-500 placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !placa.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-[#0B0F19] font-extrabold rounded-xl shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <span>Consultar Grátis</span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </>
                  )}
                </button>
              </form>
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5"><i className="fa-solid fa-lock text-emerald-400"></i> Dados 100% Seguros</span>
                <span className="flex items-center gap-1.5"><i className="fa-solid fa-bolt text-emerald-400"></i> Resultado em 5s</span>
                <span className="flex items-center gap-1.5"><i className="fa-solid fa-shield-halved text-emerald-400"></i> Fontes Oficiais</span>
              </div>
            </div>

            {/* Selos de Confiança */}
            <div className="mt-16 pt-8 border-t border-gray-800">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-6">Utilizado por mais de 45.000 motoristas, lojistas e peritos</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all">
                <div className="flex items-center gap-2 text-gray-300 font-bold text-lg"><i className="fa-solid fa-shield text-emerald-400"></i> SEGURANÇA TOTAL</div>
                <div className="flex items-center gap-2 text-gray-300 font-bold text-lg"><i className="fa-solid fa-database text-emerald-400"></i> BASES NACIONAIS</div>
                <div className="flex items-center gap-2 text-gray-300 font-bold text-lg"><i className="fa-solid fa-star text-yellow-400"></i> 4.9/5 AVALIAÇÕES</div>
                <div className="flex items-center gap-2 text-gray-300 font-bold text-lg"><i className="fa-solid fa-bolt text-blue-400"></i> API EM TEMPO REAL</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção O que o relatório revela */}
      <section id="recursos" className="py-24 bg-[#111827]/50 relative border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3">Relatório Completo & Confiável</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              O que o relatório do AutoConsulta revela?
            </h3>
            <p className="text-gray-400 text-base sm:text-lg">
              Não compre "gato por lebre". Tenha em mãos todas as informações técnicas e legais antes de fechar negócio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-gauge-high"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Histórico de Quilometragem</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Identifique indícios de adulteração de odômetro comparando registros passados de revisões, vistoria e inspeções.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Passado de Leilão e Sinistro</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Descubra se o veículo passou por leilão de seguradora, teve perda total (PT) ou registros de colisões graves estruturais.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-car-burst"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Roubo e Furto</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Verifique imediatamente se há restrições policiais ativas, boletins de ocorrência ou histórico de recuperação de roubo.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-file-invoice-dollar"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Restrições e Gravame</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Cheque financiamentos ativos (gravame), alienação fiduciária, multas pendentes, IPVA atrasado e bloqueios judiciais.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-users"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Histórico de Proprietários</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Saiba quantas mãos o veículo passou (particular, frota, locadora) e a média de tempo de permanência com cada dono.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl transition-all duration-300 group hover:border-emerald-500/40">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-magnifying-glass-chart"></i>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Preço de Mercado FIPE</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Analise a valorização ou desvalorização do modelo na tabela oficial para garantir que você está pagando o preço justo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Para quem é */}
      <section id="publico" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3">Público-Alvo</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Para quem é o AutoConsulta?
            </h3>
            <p className="text-gray-400 text-base sm:text-lg">
              Nossa plataforma foi desenvolvida para atender com excelência todos os perfis do mercado automotivo brasileiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-b from-[#111827] to-[#0B0F19] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500 text-[#0B0F19] font-black flex items-center justify-center text-xl mb-6 shadow-md shadow-emerald-500/20">
                  <i className="fa-solid fa-user-check"></i>
                </div>
                <h4 className="text-2xl font-bold text-white mb-4">Compradores</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Vai comprar um carro usado ou seminovo? Não arrisque suas economias. Valide o veículo antes de fechar negócio e descubra se ele possui histórico de leilão ou quilometragem adulterada.
                </p>
              </div>
              <ul className="space-y-3 border-t border-gray-800 pt-6 text-sm text-gray-300">
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Segurança na compra particular</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Poder de negociação com base técnica</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Tranquilidade para a família</li>
              </ul>
            </div>

            <div className="bg-gradient-to-b from-[#111827] to-[#0B0F19] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500 text-[#0B0F19] font-black flex items-center justify-center text-xl mb-6 shadow-md shadow-emerald-500/20">
                  <i className="fa-solid fa-handshake"></i>
                </div>
                <h4 className="text-2xl font-bold text-white mb-4">Vendedores</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Quer vender seu carro mais rápido e por um preço justo? Apresente o laudo limpo do AutoConsulta e gere 100% de confiança imediata no comprador.
                </p>
              </div>
              <ul className="space-y-3 border-t border-gray-800 pt-6 text-sm text-gray-300">
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Venda até 3x mais rápido</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Transparência que valoriza o veículo</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Destaque nos classificados</li>
              </ul>
            </div>

            <div className="bg-gradient-to-b from-[#111827] to-[#0B0F19] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500 text-[#0B0F19] font-black flex items-center justify-center text-xl mb-6 shadow-md shadow-emerald-500/20">
                  <i className="fa-solid fa-store"></i>
                </div>
                <h4 className="text-2xl font-bold text-white mb-4">Lojistas e Revendedores</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Faça avaliações rigorosas de estoque (trade-in), evite aceitar carros de leilão ou com passivos ocultos e garanta a reputação da sua loja.
                </p>
              </div>
              <ul className="space-y-3 border-t border-gray-800 pt-6 text-sm text-gray-300">
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Avaliação segura na troca</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Proteção jurídica para o lojista</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-400"></i> Emissão de laudos em lote</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Planos e Preços */}
      <section id="planos" className="py-24 border-t border-gray-800 bg-[#111827]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3">Planos e Pacotes</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Escolha seu plano e economize
            </h3>
            <p className="text-gray-400 text-base sm:text-lg">
              Compre créditos para usar quando precisar. O pacote promocional oferece o menor custo por consulta.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-[#111827] border border-gray-800 p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="text-emerald-400 font-semibold text-sm uppercase tracking-wider mb-2">Consulta Única</div>
                <h3 className="text-2xl font-bold text-white mb-4">1 Crédito</h3>
                <div className="text-4xl font-extrabold text-white mb-6">R$ 29,90 <span className="text-sm font-normal text-gray-400">/ un</span></div>
                <ul className="space-y-4 text-gray-300 text-sm mb-8">
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> 1 Laudo Completo Detalhado</li>
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> Histórico de Leilão e Sinistro</li>
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> Débitos e Restrições</li>
                  <li className="flex items-center text-gray-500"><i className="fa-solid fa-xmark mr-3"></i> Desconto por volume</li>
                </ul>
              </div>
              <button 
                onClick={() => startCheckout('1-credito')}
                disabled={buyingPlan !== null}
                type="button"
                className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-center transition-colors cursor-pointer"
              >
                {buyingPlan === '1-credito' ? 'Aguarde...' : 'Selecionar 1 Crédito'}
              </button>
            </div>

            <div className="bg-gradient-to-b from-emerald-950/40 to-[#111827]/60 border-2 border-emerald-500/50 p-8 rounded-3xl flex flex-col justify-between relative shadow-2xl shadow-emerald-950/30">
              <div className="absolute -top-3.5 right-8 bg-emerald-500 text-[#0B0F19] text-xs font-black uppercase px-3 py-1 rounded-full shadow-lg">
                Mais Vendido (Economia de 55%)
              </div>
              <div>
                <div className="text-emerald-400 font-semibold text-sm uppercase tracking-wider mb-2">Pacote Profissional</div>
                <h3 className="text-2xl font-bold text-white mb-4">3 Créditos</h3>
                <div className="text-4xl font-extrabold text-white mb-6">R$ 39,90 <span className="text-sm font-normal text-gray-400">/ total</span></div>
                <ul className="space-y-4 text-gray-300 text-sm mb-8">
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> 3 Laudos Completos Detalhados</li>
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> Apenas R$ 13,30 por consulta</li>
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> Créditos não expiram</li>
                  <li className="flex items-center"><i className="fa-solid fa-check text-emerald-400 mr-3"></i> Ideal para quem está comparando carros</li>
                </ul>
              </div>
              <button 
                onClick={() => startCheckout('3-creditos')}
                disabled={buyingPlan !== null}
                type="button"
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-[#0B0F19] font-bold py-3.5 rounded-xl text-center transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {buyingPlan === '3-creditos' ? 'Aguarde...' : 'Comprar Pacote com Desconto'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Depoimentos */}
      <section id="depoimentos" className="py-24 bg-[#111827]/50 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3">Histórias Reais</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Quem usou, evitou grandes prejuízos
            </h3>
            <p className="text-gray-400 text-base sm:text-lg">
              Veja como o AutoConsulta salvou nossos clientes de ciladas no mercado de usados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex text-yellow-400 gap-1 text-sm mb-4">
                  <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">
                  "Quase comprei um SUV anunciado como único dono. Na consulta do AutoConsulta descobri que o carro era de leilão de seguradora com PT. Me livrei de um prejuízo de mais de R$ 30 mil!"
                </p>
              </div>
              <div className="flex items-center gap-4 border-t border-gray-800 pt-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                  RS
                </div>
                <div>
                  <h5 className="text-white font-semibold text-sm">Rodrigo Silva</h5>
                  <p className="text-gray-500 text-xs">São Paulo - SP</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex text-yellow-400 gap-1 text-sm mb-4">
                  <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">
                  "Sou lojista de seminovos e usamos o AutoConsulta diariamente para avaliar os carros que entram na troca. Rapidez incrível e dados muito precisos que nos dão segurança total."
                </p>
              </div>
              <div className="flex items-center gap-4 border-t border-gray-800 pt-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                  CM
                </div>
                <div>
                  <h5 className="text-white font-semibold text-sm">Carlos Mendes</h5>
                  <p className="text-gray-500 text-xs">Curitiba - PR</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex text-yellow-400 gap-1 text-sm mb-4">
                  <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">
                  "O odômetro do carro que eu ia comprar marcava 45 mil km. No relatório vi que na última inspeção ele estava com 120 mil! Denunciei o vendedor e agradeço muito à plataforma."
                </p>
              </div>
              <div className="flex items-center gap-4 border-t border-gray-800 pt-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                  AP
                </div>
                <div>
                  <h5 className="text-white font-semibold text-sm">Ana Paula</h5>
                  <p className="text-gray-500 text-xs">Belo Horizonte - MG</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção FAQ */}
      <section id="faq" className="py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3">Dúvidas Frequentes</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Tudo o que você precisa saber
            </h3>
            <p className="text-gray-400 text-base">
              Respostas claras para as principais dúvidas sobre o AutoConsulta.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden transition-all">
              <button onClick={() => toggleFaq(1)} className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 font-semibold text-white focus:outline-none cursor-pointer">
                <span>Como é feita a consulta da placa?</span>
                <i className={`fa-solid fa-chevron-down text-emerald-400 transition-transform duration-200 ${openFaq === 1 ? 'rotate-180' : ''}`}></i>
              </button>
              {openFaq === 1 && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-4">
                  Nossa tecnologia cruza instantaneamente os dados informados com as principais bases de dados oficiais e cadastros integrados do setor automotivo no Brasil, retornando o laudo em segundos.
                </div>
              )}
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden transition-all">
              <button onClick={() => toggleFaq(2)} className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 font-semibold text-white focus:outline-none cursor-pointer">
                <span>O relatório mostra dados pessoais do antigo dono?</span>
                <i className={`fa-solid fa-chevron-down text-emerald-400 transition-transform duration-200 ${openFaq === 2 ? 'rotate-180' : ''}`}></i>
              </button>
              {openFaq === 2 && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-4">
                  Não. Em conformidade com a LGPD (Lei Geral de Proteção de Dados), dados pessoais sensíveis do proprietário anterior são protegidos e ocultados. O foco do relatório é estritamente o histórico técnico, legal e financeiro do veículo.
                </div>
              )}
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden transition-all">
              <button onClick={() => toggleFaq(3)} className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 font-semibold text-white focus:outline-none cursor-pointer">
                <span>Quais informações vêm no relatório completo?</span>
                <i className={`fa-solid fa-chevron-down text-emerald-400 transition-transform duration-200 ${openFaq === 3 ? 'rotate-180' : ''}`}></i>
              </button>
              {openFaq === 3 && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-4">
                  O relatório completo inclui: histórico de leilão, gravame financeiro, roubo e furto, restrições judiciais, média de quilometragem, histórico de proprietários, chamadas de recall pendentes e tabela FIPE atualizada.
                </div>
              )}
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden transition-all">
              <button onClick={() => toggleFaq(4)} className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 font-semibold text-white focus:outline-none cursor-pointer">
                <span>Posso consultar placas de qualquer estado do Brasil?</span>
                <i className={`fa-solid fa-chevron-down text-emerald-400 transition-transform duration-200 ${openFaq === 4 ? 'rotate-180' : ''}`}></i>
              </button>
              {openFaq === 4 && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-4">
                  Sim! O AutoConsulta cobre veículos emplacados em todos os 26 estados do Brasil e no Distrito Federal, tanto no padrão antigo quanto no padrão Mercosul.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-[#0B0F19] border-t border-gray-800 pt-16 pb-12 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center group">
            <Logo variant="light" size="sm" />
          </Link>
          <p className="text-xs text-gray-500">
            © 2026 AutoConsulta. Todos os direitos reservados. Plataforma independente de consulta veicular.
          </p>
          <div className="flex items-center gap-6 text-xs">
            <button onClick={() => handleGoToLogin()} type="button" className="hover:text-emerald-400 transition-colors cursor-pointer">
              Área do Cliente
            </button>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Termos de Uso</a>
          </div>
        </div>
      </footer>
    </div>
  )
}