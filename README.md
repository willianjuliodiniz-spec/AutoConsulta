# AutoConsulta Veicular

Site oficial: **https://www.autoconsultaveicular.com.br**

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente (produção)

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://www.autoconsultaveicular.com.br` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (somente servidor; necessária para o webhook) |
| `MP_ACCESS_TOKEN` | Token de produção do Mercado Pago |
| `USE_MOCK` | `true` enquanto a API externa de placas não estiver integrada |

O domínio oficial está centralizado em `src/lib/site.ts`.

## Checklist de configuração externa

- **Supabase → Authentication → URL Configuration**: Site URL = `https://www.autoconsultaveicular.com.br`; Redirect URLs: `https://www.autoconsultaveicular.com.br/**`.
- **Google OAuth (Google Cloud Console)**: origem JavaScript autorizada `https://www.autoconsultaveicular.com.br`; o URI de redirecionamento continua sendo o callback do Supabase.
- **Mercado Pago**: webhook de produção em `https://www.autoconsultaveicular.com.br/api/webhook/mercadopago`.
- **DNS / hospedagem**: apontar `www` para o provedor e redirecionar o domínio raiz (`autoconsultaveicular.com.br`) para `www`.
