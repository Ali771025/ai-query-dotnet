import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '../components/ui/Button'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

let globalConfirm: ConfirmFn | null = null

export function getGlobalConfirm(): ConfirmFn | null {
  return globalConfirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback((value: boolean) => {
    setOpen(false)
    resolverRef.current?.(value)
    resolverRef.current = null
  }, [])

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  globalConfirm = confirm

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-panel-solid p-5 shadow-[var(--shadow)]"
          >
            <h3 className="text-base font-semibold text-heading">
              {options.title ?? 'تأیید'}
            </h3>
            <p className="mt-3 text-sm text-ink">{options.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => close(false)}>
                {options.cancelLabel ?? 'انصراف'}
              </Button>
              <Button
                variant={options.danger ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? 'تأیید'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
