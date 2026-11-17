'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'

interface ConsultationItem {
  id: string
  plate: string
  vehicle_data: {
    modelo?: string
    marca?: string
    ano?: string | number
  } | null
  created_at: string
}

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function HistoricoPage() {
  const [consultations, setConsultations] = useState<ConsultationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('consultations')
        .select('id, plate, vehicle_data, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar histórico:', error)
        setErrorMsg('Não foi possível carregar seu histórico. Tente novamente em instantes.')
      } else if (data) {
        setConsultations(data as ConsultationItem[])
      }
      setLoading(false)
    }

    loadHistory()
  }, [router])

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 font-sans antialiased selection:bg-emerald-500 selection:text-white pb-20">
      <Navbar>
        <Link
          href="/"
          className="text-gray-300 hover:text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl bg-[#111827] border border-gray-800 hover:border-gray-700 transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-magnifying-glass text-emerald-400"></i>
          <span>Nova Placa</span>
        </Link>
      </Navbar>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Histórico de Consultas</h1>
          <p className="text-sm text-gray-400 mt-1">
            Acesse os relatórios das placas que você já consultou anteriormente, sem gastar novos créditos.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <i className="fa-solid fa-circle-notch fa-spin text-emerald-400"></i>
            <span>Carregando histórico...</span>
          </div>
        ) : errorMsg ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
            {errorMsg}
          </div>
        ) : consultations.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-10 text-center">
            <i className="fa-solid fa-folder-open text-3xl text-gray-600 mb-3"></i>
            <p className="text-gray-300">Você ainda não realizou nenhuma consulta.</p>
            <Link
              href="/"
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B0F19] font-bold text-sm transition-colors"
            >
              Fazer minha primeira consulta
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#111827] shadow-2xl">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-[#0B0F19]/60 text-gray-400">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Placa</th>
                  <th className="px-6 py-3.5 font-semibold">Veículo</th>
                  <th className="px-6 py-3.5 font-semibold">Data e Horário</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {consultations.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-white tracking-wider">
                      {item.plate}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {item.vehicle_data?.marca} {item.vehicle_data?.modelo || 'Veículo Consultado'}{' '}
                      {item.vehicle_data?.ano ? `(${item.vehicle_data.ano})` : ''}
                    </td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/consulta/${item.plate}?historicoId=${item.id}`}
                        className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
                      >
                        Ver relatório
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
