import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-heading">{label}</span> : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`h-10 rounded-lg border bg-input px-3 text-ink outline-none transition placeholder:text-muted ${
          error
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
            : 'border-border focus:border-accent focus:ring-2 focus:ring-primary-soft'
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}
