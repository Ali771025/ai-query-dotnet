import type { ReactNode } from 'react'

type KpiCardProps = {
  title: string
  value: string
  hint?: string
  icon?: ReactNode
  trend?: string
}

export function KpiCard({ title, value, hint, icon, trend }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 shadow-[var(--shadow)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-heading">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
          {trend ? <p className="mt-2 text-xs font-medium text-emerald-500">{trend}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-lg bg-primary-soft p-2.5 text-accent">{icon}</div>
        ) : null}
      </div>
    </div>
  )
}
