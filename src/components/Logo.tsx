import Image from 'next/image'

// Arquivo em public/ (o nome real do arquivo tem extensão duplicada)
const LOGO_SRC = '/logo.png.png'
// Dimensões intrínsecas do arquivo, usadas pelo next/image para reservar o espaço (proporção)
const LOGO_WIDTH = 282
const LOGO_HEIGHT = 318

interface LogoProps {
  /**
   * 'light': texto claro, para fundos escuros (padrão do site).
   * 'dark': texto escuro, para fundos claros.
   */
  variant?: 'light' | 'dark'
  /** 'md' (Navbar) ou 'sm' (rodapé). */
  size?: 'sm' | 'md'
  className?: string
}

const SIZES = {
  md: {
    image: 'h-11 w-auto',
    text: 'text-xl',
  },
  sm: {
    image: 'h-9 w-auto',
    text: 'text-lg',
  },
} as const

export function Logo({ variant = 'light', size = 'md', className = '' }: LogoProps) {
  const sizes = SIZES[size]
  const textColor = variant === 'light' ? 'text-white' : 'text-[#0B0F19]'
  const accentColor = variant === 'light' ? 'text-emerald-400' : 'text-emerald-600'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="Logo AutoConsulta"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={`${sizes.image} shrink-0 object-contain group-hover:scale-105 transition-transform`}
      />
      <span className={`${sizes.text} font-extrabold tracking-tight ${textColor}`}>
        Auto<span className={accentColor}>Consulta</span>
      </span>
    </span>
  )
}

