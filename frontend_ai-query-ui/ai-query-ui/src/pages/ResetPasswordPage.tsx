import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    const next: Record<string, string> = {}
    if (!password) next.password = 'رمز عبور جدید الزامی است.'
    else if (password.length < 8) next.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد.'
    if (!confirm) next.confirm = 'تکرار رمز عبور الزامی است.'
    else if (password !== confirm) next.confirm = 'تکرار رمز عبور مطابقت ندارد.'
    if (Object.keys(next).length) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    const result = resetPassword(token, password)
    if (!result.ok) {
      if (result.field) setFieldErrors({ [result.field]: result.message })
      else setFormError(result.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login'), 1200)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-8 shadow-[var(--shadow)] backdrop-blur">
        <h1 className="text-xl font-bold text-heading">تعیین رمز عبور جدید</h1>
        <p className="mt-2 text-sm text-muted">حداقل ۸ کاراکتر وارد کنید.</p>

        {done ? (
          <p className="mt-6 text-sm text-emerald-500">رمز عبور با موفقیت تغییر کرد. در حال انتقال...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <Input
              label="رمز عبور جدید"
              type="password"
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
              autoComplete="new-password"
            />
            <Input
              label="تکرار رمز عبور"
              type="password"
              value={confirm}
              error={fieldErrors.confirm}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.confirm
                  return next
                })
                setConfirm(e.target.value)
              }}
              autoComplete="new-password"
            />
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <Button type="submit" className="w-full" disabled={!token}>
              ذخیره رمز جدید
            </Button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-block text-sm text-link hover:underline">
          بازگشت به ورود
        </Link>
      </div>
    </div>
  )
}
