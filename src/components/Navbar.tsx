'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

export interface NavbarLink {
  href: string
  label: string
}

interface NavbarProps {
  /** 'fixed' (landing, com conteúdo recuado por padding) ou 'sticky' (demais páginas). */
  position?: 'fixed' | 'sticky'
  /** Links de âncora exibidos no centro (desktop) e no menu mobile. */
  links?: NavbarLink[]
  /** Ações extras da página (ex.: botão "Consultar Agora", link "Nova Placa"). */
  children?: ReactNode
  /** Altere este valor para forçar uma nova busca do saldo de créditos. */
  creditsRefreshKey?: number
}

export function Navbar({
  position = 'sticky',
  links = [],
  children,
  creditsRefreshKey = 0,
}: NavbarProps) {
  const [user, setUser] = useState<User | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const userId = user?.id ?? null
  const hasLinks = links.length > 0
  const displayCredits = userId ? credits : null

  // Sessão atual + mudanças de autenticação em tempo real.
  // Não fazemos consultas ao Supabase dentro do callback (risco de deadlock no supabase-js v2).
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Saldo de créditos: busca quando o usuário muda ou quando creditsRefreshKey muda.
  useEffect(() => {
    if (!userId) return

    let active = true

    supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setCredits(typeof data?.credits === 'number' ? data.credits : 0)
      })

    return () => {
      active = false
    }
  }, [userId, creditsRefreshKey])

  const handleLogout = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    setUser(null)
    setCredits(null)
    router.push('/')
    router.refresh()
  }

  const handleLoginClick = () => {
    setMenuOpen(false)
    localStorage.removeItem('autoconsulta_pending_plate')
    sessionStorage.clear()
  }

  const creditsLabel =
    displayCredits === null
      ? '...'
      : `${displayCredits} ${displayCredits === 1 ? 'crédito' : 'créditos'}`

  const positionClasses = position === 'fixed' ? 'fixed top-0 left-0 right-0' : 'sticky top-0'

  return (
    <header
      className={`${positionClasses} z-50 bg-[#0B0F19]/85 backdrop-blur-md border-b border-gray-800/60 transition-all duration-300`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          {/* A Navbar tem fundo escuro, então usa a variante "light" */}
          <Logo variant="light" />
        </Link>

        {hasLinks && (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-emerald-400 transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3 sm:gap-4">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-xl bg-gray-800/60" />
          ) : user ? (
            <>
              {/* Badge de créditos */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#111827] border border-gray-800 text-xs">
                <i className="fa-solid fa-coins text-emerald-400"></i>
                <span className="text-gray-400">Saldo:</span>
                <span className="font-bold text-white">{creditsLabel}</span>
              </div>

              {/* Histórico */}
              <Link
                href="/historico"
                title="Minhas Consultas"
                className="text-gray-300 hover:text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-800/50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-clock-rotate-left text-emerald-400"></i>
                <span className="hidden lg:inline">Minhas Consultas</span>
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              onClick={handleLoginClick}
              className={`text-gray-300 hover:text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800/50 transition-colors ${
                hasLinks ? 'hidden sm:block' : ''
              }`}
            >
              Entrar
            </Link>
          )}

          {children}

          {!loading && user && (
            <button
              onClick={handleLogout}
              type="button"
              title={`Sair (${user.email ?? 'Cliente'})`}
              className="text-gray-400 hover:text-red-400 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          )}

          {hasLinks && (
            <button
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              className="md:hidden text-gray-300 hover:text-white focus:outline-none p-2 cursor-pointer"
            >
              <i className="fa-solid fa-bars text-xl"></i>
            </button>
          )}
        </div>
      </div>

      {/* Menu mobile */}
      {hasLinks && menuOpen && (
        <div className="md:hidden bg-[#111827] border-b border-gray-800 px-6 py-4 space-y-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block text-gray-300 hover:text-emerald-400 py-1"
            >
              {link.label}
            </a>
          ))}

          {!loading && user ? (
            <>
              <div className="flex items-center gap-2 py-1 text-sm">
                <i className="fa-solid fa-coins text-emerald-400"></i>
                <span className="text-gray-400">Saldo:</span>
                <span className="font-bold text-white">{creditsLabel}</span>
              </div>
              <Link
                href="/historico"
                onClick={() => setMenuOpen(false)}
                className="block text-gray-300 hover:text-emerald-400 py-1"
              >
                Minhas Consultas
              </Link>
            </>
          ) : (
            !loading && (
              <Link
                href="/login"
                onClick={handleLoginClick}
                className="block w-full text-left text-gray-300 hover:text-emerald-400 py-1"
              >
                Entrar na Conta
              </Link>
            )
          )}
        </div>
      )}
    </header>
  )
}

