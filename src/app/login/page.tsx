'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type AuthMode = 'login' | 'register'

function LoginContent() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [isResetMode, setIsResetMode] = useState(false) // Novo estado para tela de recuperar senha
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [resetSent, setResetSent] = useState(false) // Novo estado para confirmar envio do e-mail de recuperação
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [activePlate, setActivePlate] = useState<string | null>(null)
  const [activePlan, setActivePlan] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    localStorage.removeItem('autoconsulta_pending_plate')

    const plateParam = searchParams.get('placa')
    const planParam = searchParams.get('plano')

    if (plateParam) {
      const formattedPlate = plateParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      setActivePlate(formattedPlate)
      setActivePlan(null)
      setMode('register')
    } else if (planParam) {
      setActivePlan(planParam)
      setActivePlate(null)
      setMode('register')
    } else {
      setActivePlate(null)
      setActivePlan(null)
      setMode('login')
    }
  }, [searchParams])

  const getDestinationPath = () => {
    if (activePlate) return `/consulta/${activePlate}`
    // Sem fragmento (#): o Supabase anexa tokens ao hash no retorno do OAuth/e-mail
    if (activePlan) return `/?comprar=${activePlan}`
    return '/'
  }

  const getRedirectUrl = () => {
    return `${window.location.origin}${getDestinationPath()}`
  }

  // Função de Envio de Login ou Cadastro (com e-mail duplicado tratado)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error

        router.push(getDestinationPath())
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(),
          },
        })
        if (error) throw error

        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setMode('login')
          setErrorMsg('Este e-mail já possui cadastro. Digite sua senha para entrar.')
          return
        }

        if (data.user && !data.session) {
          setVerificationSent(true)
        } else {
          router.push(getDestinationPath())
        }
      }
    } catch (err: unknown) {
      const errorObj = err as Error
      const msg = errorObj.message?.toLowerCase() || ''

      if (msg.includes('invalid login credentials')) {
        setErrorMsg('E-mail ou senha incorretos.')
      } else if (msg.includes('user already registered') || msg.includes('already registered')) {
        setMode('login')
        setErrorMsg('Este e-mail já possui cadastro. Digite sua senha para entrar.')
      } else {
        setErrorMsg(errorObj.message || 'Erro ao processar sua solicitação.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Nova Função: Solicitar Recuperação de Senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      // URL para onde o usuário voltará após clicar no link do e-mail para redefinir a senha
      const redirectTo = `${window.location.origin}/atualizar-senha`

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) throw error

      setResetSent(true)
    } catch (err: unknown) {
      const errorObj = err as Error
      setErrorMsg(errorObj.message || 'Erro ao enviar e-mail de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      const errorObj = err as Error
      setErrorMsg(errorObj.message || 'Não foi possível conectar com o Google.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="bg-[#0B0F19] text-gray-100 font-sans antialiased selection:bg-emerald-500 selection:text-white min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-[#0B0F19] font-black text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-shield-car"></i>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-white">
            Auto<span className="text-emerald-400">Consulta</span>
          </span>
        </Link>

        {/* CABEÇALHO DINÂMICO */}
        {activePlate ? (
          <div className="mb-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold mb-3">
              <i className="fa-solid fa-car"></i> PLACA: {activePlate}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Veículo localizado!
            </h2>
            <p className="text-sm text-gray-400 mt-1.5">
              Identifique-se gratuitamente para liberar os dados iniciais.
            </p>
          </div>
        ) : activePlan ? (
          <div className="mb-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase mb-3">
              <i className="fa-solid fa-ticket"></i>
              {activePlan === '3-creditos' ? 'Pacote 3 Créditos (R$ 39,90)' : 'Consulta Única (R$ 29,90)'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Quase lá!
            </h2>
            <p className="text-sm text-gray-400 mt-1.5">
              Crie sua conta ou entre para adicionar os créditos ao seu saldo.
            </p>
          </div>
        ) : (
          <div className="transition-all duration-300">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isResetMode
                ? 'Recuperar senha'
                : mode === 'login'
                ? 'Bem-vindo de volta'
                : 'Crie sua conta gratuita'}
            </h2>
            <p className="text-sm text-gray-400 mt-1.5">
              {isResetMode
                ? 'Enviaremos um link para você redefinir sua senha.'
                : mode === 'login'
                ? 'Acesse seus créditos e laudos veiculares.'
                : 'Consulte o histórico completo de qualquer veículo.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-[#111827]/95 border border-gray-800 py-8 px-6 sm:px-8 shadow-2xl rounded-2xl backdrop-blur-xl">
          
          {verificationSent ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto animate-bounce">
                <i className="fa-solid fa-envelope-circle-check"></i>
              </div>
              <h3 className="text-xl font-bold text-white">Verifique seu e-mail</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Enviamos um link de confirmação para <strong className="text-white">{email}</strong>. Clique no link para ativar sua conta e continuar.
              </p>
              <button
                onClick={() => {
                  setVerificationSent(false)
                  setMode('login')
                }}
                className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
              >
                Já confirmei, ir para o login
              </button>
            </div>
          ) : resetSent ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                <i className="fa-solid fa-paper-plane"></i>
              </div>
              <h3 className="text-xl font-bold text-white">E-mail enviado!</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Enviamos instruções de redefinição de senha para <strong className="text-white">{email}</strong>. Verifique sua caixa de entrada ou spam.
              </p>
              <button
                onClick={() => {
                  setResetSent(false)
                  setIsResetMode(false)
                  setMode('login')
                }}
                className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
              >
                Voltar para o login
              </button>
            </div>
          ) : isResetMode ? (
            /* TELA DE RECUPERAÇÃO DE SENHA */
            <>
              {errorMsg && (
                <div className="p-3.5 rounded-xl mb-5 text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 transition-all">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <i className="fa-solid fa-envelope text-sm"></i>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#0B0F19] border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 text-[#0B0F19] font-extrabold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <span>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false)
                    setErrorMsg(null)
                  }}
                  className="text-xs text-gray-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>Lembrou a senha? Voltar ao login</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* BOTÃO GOOGLE OFICIAL */}
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                type="button"
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white hover:bg-gray-100 active:scale-[0.99] disabled:opacity-60 text-gray-900 font-semibold text-sm shadow-md transition-all cursor-pointer"
              >
                {googleLoading ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-gray-600 text-lg"></i>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>{googleLoading ? 'Conectando...' : 'Continuar com Google'}</span>
              </button>

              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-xs uppercase tracking-wider">ou use seu e-mail</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              {/* ABAS COM PÍLULA DESLIZANTE */}
              <div className="relative grid grid-cols-2 p-1 bg-[#0B0F19] border border-gray-800 rounded-xl mb-6">
                <div
                  className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-emerald-500 rounded-lg shadow-md shadow-emerald-500/20 transition-transform duration-300 ease-out ${
                    mode === 'login' ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setErrorMsg(null)
                  }}
                  className={`relative z-10 py-2.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer ${
                    mode === 'register'
                      ? 'text-[#0B0F19]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg(null)
                  }}
                  className={`relative z-10 py-2.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer ${
                    mode === 'login'
                      ? 'text-[#0B0F19]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Já tenho conta
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl mb-5 text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 transition-all">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* FORMULÁRIO DE LOGIN/CADASTRO */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    E-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <i className="fa-solid fa-envelope text-sm"></i>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#0B0F19] border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Senha
                    </label>
                    {/* Botão de Esqueci a Senha (só aparece visível no modo login) */}
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetMode(true)
                          setErrorMsg(null)
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <i className="fa-solid fa-lock text-sm"></i>
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                      className="w-full pl-10 pr-4 py-3 bg-[#0B0F19] border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 text-[#0B0F19] font-extrabold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <span>
                    {loading
                      ? 'Aguarde...'
                      : activePlate
                      ? (mode === 'register' ? 'Criar Conta e Ver Consulta' : 'Entrar e Ver Consulta')
                      : (mode === 'register' ? 'Criar Conta Gratuita' : 'Entrar na Conta')}
                  </span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-gray-800/80 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
              <i className="fa-solid fa-arrow-left"></i>
              <span>Voltar para a página inicial</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0F19]" />}>
      <LoginContent />
    </Suspense>
  )
}