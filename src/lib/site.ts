// Fonte única do endereço oficial do site.
export const SITE_HOST = 'www.autoconsultaveicular.com.br'
export const SITE_URL = `https://${SITE_HOST}`
export const SITE_NAME = 'AutoConsulta'

/**
 * URL base usada em back_urls / notification_url do Mercado Pago.
 * - Em produção: sempre o domínio oficial (ignora variáveis esquecidas apontando para localhost).
 * - Em desenvolvimento: NEXT_PUBLIC_APP_URL (ex.: http://localhost:3000), com o domínio oficial como fallback.
 */
export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') return SITE_URL
  return (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '')
}


/**
 * Origem usada nos redirecionamentos de autenticação (Supabase) no navegador.
 * Em produção usa sempre o domínio oficial; em desenvolvimento usa a origem atual (localhost).
 */
export function getClientOrigin(): string {
  if (process.env.NODE_ENV === 'production') return SITE_URL
  return window.location.origin
}
