import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [identity, setIdentity] = useState('')
  const [message, setMessage] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [demoLink, setDemoLink] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!identity.trim()) {
      setFieldError('نام کاربری یا شماره همراه الزامی است.')
      setMessage('')
      setDemoLink('')
      return
    }
    setFieldError('')
    const result = requestPasswordReset(identity)
    setMessage(result.message)
    if (result.demoToken) {
      setDemoLink(`/reset-password?token=${result.demoToken}`)
    } else {
      setDemoLink('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-8 shadow-[var(--shadow)] backdrop-blur">
        <h1 className="text-xl font-bold text-heading">بازیابی رمز عبور</h1>
        <p className="mt-2 text-sm text-muted">
          نام کاربری یا شماره همراه ثبت‌شده را وارد کنید. در صورت وجود حساب، پیامک بازیابی به
          همان شماره ارسال می‌شود.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            label="نام کاربری یا شماره همراه"
            value={identity}
            error={fieldError}
            onChange={(e) => {
              setFieldError('')
              setIdentity(e.target.value)
            }}
            autoComplete="username"
            placeholder="owner یا 0912..."
          />
          <Button type="submit" className="w-full">
            ارسال پیامک بازیابی
          </Button>
        </form>

        {message ? (
          <p className="mt-4 rounded-lg bg-primary-soft px-3 py-2 text-sm text-ink">{message}</p>
        ) : null}

        {demoLink ? (
          <p className="mt-3 text-sm text-muted">
            نمونه کلاینتی لینک:{' '}
            <Link to={demoLink} className="text-link hover:underline">
              بازنشانی رمز
            </Link>
          </p>
        ) : null}

        <Link to="/login" className="mt-6 inline-block text-sm text-link hover:underline">
          بازگشت به ورود
        </Link>
      </div>
    </div>
  )
}
