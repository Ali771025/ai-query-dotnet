import type { TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}

export function Textarea({ label, hint, error, className = '', ...props }: TextareaProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-heading">{label}</span> : null}
      <textarea
        aria-invalid={error ? true : undefined}
        className={`min-h-28 rounded-lg border bg-input px-3 py-2 text-ink outline-none transition ${
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
