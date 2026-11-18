import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '' 
})

export async function POST(request: Request) {
  try {
    // Criado dentro do handler: se a chave de serviço faltar, o erro é logado de forma clara
    // em vez de derrubar o carregamento do módulo.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Webhook MP: SUPABASE_SERVICE_ROLE_KEY não definida — os créditos não podem ser adicionados.')
      return NextResponse.json({ error: 'Configuração ausente' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const url = new URL(request.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('id') || url.searchParams.get('data.id')

    if (topic === 'payment' && id) {
      const payment = new Payment(client)
      const paymentInfo = await payment.get({ id: Number(id) })

      if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
        const { userId, creditsToAdd } = JSON.parse(paymentInfo.external_reference)

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single()

        if (profile) {
          const currentCredits = profile.credits || 0
          const newTotalCredits = currentCredits + creditsToAdd

          await supabaseAdmin
            .from('profiles')
            .update({ credits: newTotalCredits })
            .eq('id', userId)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Erro no webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}