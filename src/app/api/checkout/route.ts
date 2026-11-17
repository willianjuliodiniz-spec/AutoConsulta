import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '' 
})

export async function POST(request: Request) {
  try {
    const { plan, userId, plate } = await request.json()

    if (!userId || !plan) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const isPack = plan === '3-creditos'
    const title = isPack ? 'AutoConsulta - Pacote 3 Créditos' : 'AutoConsulta - Consulta Única'
    const unitPrice = isPack ? 39.90 : 29.90
    const creditsToAdd = isPack ? 3 : 1

    const preference = new Preference(client)
    const result = await preference.create({
      body: {
        items: [
          {
            id: plan,
            title: title,
            quantity: 1,
            unit_price: unitPrice,
            currency_id: 'BRL',
          },
        ],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/consulta/${plate}?status=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/consulta/${plate}?status=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/consulta/${plate}?status=pending`,
        },
        // auto_return removido para evitar erro local em HTTP
        external_reference: JSON.stringify({ userId, creditsToAdd }),
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/mercadopago`,
      },
    })

    // Retorna o init_point de produção ou o sandbox_init_point se estiver usando credenciais de teste
    const checkoutUrl = result.init_point

    return NextResponse.json({ init_point: checkoutUrl })
  } catch (error: unknown) {
    const err = error as { message?: string; cause?: unknown } | null | undefined

    // Object.getOwnPropertyNames inclui message/stack/cause, que o JSON.stringify padrão omite em Error
    console.error(
      'Erro detalhado Mercado Pago:',
      JSON.stringify(error, Object.getOwnPropertyNames(Object(error)), 2)
    )

    return NextResponse.json(
      {
        error: 'Erro ao processar pagamento',
        details: err?.message || err?.cause || String(error),
      },
      { status: 500 }
    )
  }
}