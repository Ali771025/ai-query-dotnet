import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

type BadgeProps = {
  children: ReactNode
  variant?: Variant
  className?: string
}

const variantClass: Record<Variant, string> = {
  default: 'bg-primary-soft text-accent',
  success: 'bg-[#95A4FC]/15 text-[#95A4FC] dark:text-[#A8B4FF]',
  warning: 'bg-[#FFCB71]/15 text-[#C48A2A] dark:text-[#FFCB71]',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-[#C6C7F8]/20 text-[#5B5FC7] dark:text-[#C6C7F8]',
  neutral: 'bg-primary-soft text-muted',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
