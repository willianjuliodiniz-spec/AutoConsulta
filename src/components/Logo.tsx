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
    box: 'w-10 h-10 rounded-xl text-xl',
    text: 'text-xl',
  },
  sm: {
    box: 'w-8 h-8 rounded-lg text-base',
    text: 'text-lg',
  },
} as const

export function Logo({ variant = 'light', size = 'md', className = '' }: LogoProps) {
  const sizes = SIZES[size]
  const textColor = variant === 'light' ? 'text-white' : 'text-[#0B0F19]'
  const accentColor = variant === 'light' ? 'text-emerald-400' : 'text-emerald-600'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`${sizes.box} bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-[#0B0F19] font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform`}
      >
        <i className="fa-solid fa-shield-car"></i>
      </span>
      <span className={`${sizes.text} font-extrabold tracking-tight ${textColor}`}>
        Auto<span className={accentColor}>Consulta</span>
      </span>
    </span>
  )
}

