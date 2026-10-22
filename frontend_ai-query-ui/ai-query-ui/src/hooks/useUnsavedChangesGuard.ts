import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { confirmDiscardForm } from '../lib/confirm'

const LEAVE_MESSAGE =
  'تغییرات ذخیره‌نشده دارید. آیا می‌خواهید بدون ذخیره خارج شوید؟'

/** مقایسه پایدار برای تشخیص تغییر فرم نسبت به مقدار اولیه */
export function isFormDirty(current: unknown, initial: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial)
}

/**
 * وقتی فرم تغییر کرده باشد، ناوبری داخل اپ (منو، لینک، تاریخچه) را مسدود می‌کند
 * و با تأیید کاربر اجازه خروج می‌دهد.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigate = useNavigate()
  const bypassRef = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypassRef.current) return false
    return (
      isDirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    )
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let alive = true
    void confirmDiscardForm(LEAVE_MESSAGE).then((ok) => {
      if (!alive) return
      if (ok) blocker.proceed?.()
      else blocker.reset?.()
    })
    return () => {
      alive = false
    }
  }, [blocker.state, blocker.location?.key, blocker.proceed, blocker.reset])

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  /** خروج بدون پرسش (مثلاً بعد از ذخیره موفق) */
  const bypassAndLeave = useCallback(
    (to: string) => {
      bypassRef.current = true
      navigate(to)
    },
    [navigate],
  )

  /** اگر dirty باشد تأیید می‌گیرد؛ در غیر این صورت مستقیم می‌رود */
  const confirmAndLeave = useCallback(
    async (to: string) => {
      if (!isDirty) {
        bypassRef.current = true
        navigate(to)
        return
      }
      const ok = await confirmDiscardForm(LEAVE_MESSAGE)
      if (!ok) return
      bypassRef.current = true
      navigate(to)
    },
    [isDirty, navigate],
  )

  /** برای بستن دیالوگ/ادیتور روی همان صفحه */
  const confirmAndStayOrDiscard = useCallback(async () => {
    if (!isDirty) return true
    return confirmDiscardForm(LEAVE_MESSAGE)
  }, [isDirty])

  return { bypassAndLeave, confirmAndLeave, confirmAndStayOrDiscard }
}
