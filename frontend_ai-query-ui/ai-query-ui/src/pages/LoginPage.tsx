import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Sparkles, User, Shield } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { Workspace } from '../types/rbac'
import { personaLabel } from '../lib/personas'
import { loadJson } from '../lib/storage'
import type { SystemUser } from '../types/rbac'

export function LoginPage() {
  const {
    login,
    selectLoginPersona,
    cancelPersonaSelection,
    isAuthenticated,
    roles,
  } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [personas, setPersonas] = useState<Workspace[] | null>(null)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [personaError, setPersonaError] = useState('')

  if (isAuthenticated) return <Navigate to="/app" replace />

  const pendingUser: SystemUser | null = pendingUserId
    ? (loadJson<SystemUser[]>('users', []).find((u) => u.id === pendingUserId) ??
      null)
    : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setPersonaError('')
    setSubmitting(true)
    const result = await login(username, password)
    setSubmitting(false)
    if (!result.ok) {
      if (result.fields && Object.keys(result.fields).length > 0) {
        setFieldErrors(result.fields)
      } else if (result.field) {
        setFieldErrors({ [result.field]: result.message })
      } else {
        setFieldErrors({ password: result.message })
      }
      return
    }
    if ('requiresPersonaSelection' in result && result.requiresPersonaSelection) {
      setPersonas(result.personas)
      setPendingUserId(result.pendingUserId)
      return
    }
    navigate('/app')
  }

  const onSelectPersona = async (ws: Workspace) => {
    setPersonaError('')
    const result = await selectLoginPersona(ws)
    if (!result.ok) {
      setPersonaError(result.message)
      return
    }
    setPersonas(null)
    setPendingUserId(null)
    navigate('/app')
  }

  const onBackToCredentials = () => {
    cancelPersonaSelection()
    setPersonas(null)
    setPendingUserId(null)
    setPersonaError('')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4"
        onClick={toggleTheme}
        aria-label="تغییر تم"
      >
        {theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
      </Button>

      <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-8 shadow-[var(--shadow)] backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-accent">
            {personas ? <Shield className="size-6" /> : <Sparkles className="size-6" />}
          </div>
          <h1 className="text-2xl font-bold text-heading">
            {personas ? 'انتخاب نقش ورود' : 'ورود به سامانه'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {personas
              ? 'چند نقش فعال دارید؛ مشخص کنید با کدام نقش وارد می‌شوید. دسترسی نشست فقط همان نقش خواهد بود.'
              : 'منوها بر اساس نقش و دسترسی‌های شما نمایش داده می‌شوند'}
          </p>
        </div>

        {personas ? (
          <div className="space-y-3">
            {pendingUser ? (
              <p className="mb-2 text-center text-sm text-muted">
                حساب: <span className="font-medium text-heading">{pendingUser.name}</span>
              </p>
            ) : null}
            {personas.map((ws) => (
              <Button
                key={ws}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start px-4 py-3 text-right"
                onClick={() => onSelectPersona(ws)}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold text-heading">
                    {personaLabel(ws, pendingUser, roles)}
                  </span>
                  <span className="text-xs font-normal text-muted">
                    ورود با دسترسی همین سطح
                  </span>
                </span>
              </Button>
            ))}
            {personaError ? (
              <p className="text-sm text-danger">{personaError}</p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onBackToCredentials}
            >
              بازگشت به ورود
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="relative">
              <User className="pointer-events-none absolute top-9 right-3 size-4 text-muted" />
              <Input
                label="نام کاربری"
                autoComplete="username"
                value={username}
                error={fieldErrors.username}
                onChange={(e) => {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.username
                    return next
                  })
                  setUsername(e.target.value)
                }}
                className="pr-9"
                placeholder="owner"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-9 right-3 size-4 text-muted" />
              <Input
                label="رمز عبور"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                error={fieldErrors.password}
                onChange={(e) => {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.password
                    return next
                  })
                  setPassword(e.target.value)
                }}
                className="pr-9 pl-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute top-9 left-3 text-muted hover:text-ink"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              ورود
            </Button>
          </form>
        )}

        {!personas ? (
          <>
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/forgot-password" className="text-link hover:underline">
                فراموشی رمز عبور
              </Link>
            </div>

          </>
        ) : null}
      </div>
    </div>
  )
}
