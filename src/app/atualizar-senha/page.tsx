'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AtualizarSenhaPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem. Digite novamente.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)
      
      setTimeout(() => {
        router.push('/login')
      }, 3500)

    } catch (err: unknown) {
      const errorObj = err as Error
      const msg = errorObj.message?.toLowerCase() || ''

      // Traduzindo a mensagem do Supabase de senha igual para português
      if (msg.includes('different from the old password') || msg.includes('should be different')) {
        setErrorMsg('A nova senha deve ser diferente da senha anterior.')
      } else {
        setErrorMsg(errorObj.message || 'Não foi possível atualizar a senha. O link pode ter expirado.')
      }
    } finally {
      setLoading(false)
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

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Nova senha
        </h2>
        <p className="text-sm text-gray-400 mt-1.5">
          Digite sua nova senha abaixo para recuperar o acesso à sua conta.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-[#111827]/95 border border-gray-800 py-8 px-6 sm:px-8 shadow-2xl rounded-2xl backdrop-blur-xl">
          
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                <i className="fa-solid fa-check"></i>
              </div>
              <h3 className="text-xl font-bold text-white">Senha alterada com sucesso!</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Sua senha foi atualizada. Redirecionando você para a página de login...
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
              >
                Ir para o login agora
              </Link>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3.5 rounded-xl mb-5 text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 transition-all">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Nova Senha
                  </label>
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
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-4 py-3 bg-[#0B0F19] border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Confirme a Nova Senha
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <i className="fa-solid fa-lock text-sm"></i>
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite a senha novamente"
                      className="w-full pl-10 pr-4 py-3 bg-[#0B0F19] border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 text-[#0B0F19] font-extrabold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <span>{loading ? 'Atualizando...' : 'Salvar Nova Senha'}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-gray-800/80 text-center">
            <Link href="/login" className="text-xs text-gray-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
              <i className="fa-solid fa-arrow-left"></i>
              <span>Lembrou a senha? Voltar ao login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}