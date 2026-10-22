import { createContext, useContext, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { confirmDiscardForm } from '../../lib/confirm'

type DialogCloseApi = {
  requestClose: () => void
}

const DialogCloseContext = createContext<DialogCloseApi | null>(null)

export function useDialogRequestClose() {
  const ctx = useContext(DialogCloseContext)
  if (!ctx) {
    throw new Error('useDialogRequestClose must be used inside Dialog')
  }
  return ctx.requestClose
}

type DialogProps = {
  open: boolean
  title: string
  children: ReactNode
  footer?: ReactNode | ((api: DialogCloseApi) => ReactNode)
  onClose: () => void
  panelClassName?: string
  /**
   * فرم ثبت/ویرایش: کلیک بیرون نمی‌بندد؛
   * بستن فقط از انصراف/ضربدر.
   * اگر dirty=true باشد قبل از بستن تأیید می‌گیرد.
   */
  form?: boolean
  /** وقتی form است: فقط در صورت تغییر، تأیید بستن نشان داده می‌شود */
  dirty?: boolean
  confirmMessage?: string
  /** برای دیالوگ تأیید روی دیالوگ دیگر */
  elevated?: boolean
}

const DEFAULT_CONFIRM =
  'تغییرات ذخیره‌نشده دارید. آیا می‌خواهید بدون ذخیره خارج شوید؟'

export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  panelClassName = 'max-w-lg',
  form = false,
  dirty = false,
  confirmMessage = DEFAULT_CONFIRM,
  elevated = false,
}: DialogProps) {
  if (!open) return null

  const requestClose = () => {
    if (form && dirty) {
      void confirmDiscardForm(confirmMessage).then((ok) => {
        if (ok) onClose()
      })
      return
    }
    onClose()
  }

  const api: DialogCloseApi = { requestClose }
  const footerNode = typeof footer === 'function' ? footer(api) : footer
  const zClass = elevated ? 'z-[100]' : 'z-50'

  return (
    <DialogCloseContext.Provider value={api}>
      <div className={`fixed inset-0 ${zClass} flex items-center justify-center p-4`}>
        {form ? (
          <div className="absolute inset-0 bg-black/50" aria-hidden />
        ) : (
          <button
            type="button"
            aria-label="بستن"
            className="absolute inset-0 bg-black/50"
            onClick={requestClose}
          />
        )}
        <div
          role="dialog"
          aria-modal="true"
          className={`relative z-10 flex max-h-[90vh] w-full flex-col rounded-xl border border-border bg-panel-solid shadow-[var(--shadow)] backdrop-blur ${panelClassName}`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-heading">{title}</h3>
            <Button variant="ghost" size="sm" onClick={requestClose} aria-label="بستن">
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-ink">
            {children}
          </div>
          {footerNode ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
              {footerNode}
            </div>
          ) : null}
        </div>
      </div>
    </DialogCloseContext.Provider>
  )
}
