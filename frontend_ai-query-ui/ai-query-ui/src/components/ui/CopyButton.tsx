import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from './Button'
import { copyTextToClipboard } from '../../lib/copyText'

type CopyButtonProps = {
  text: string
  className?: string
  /** Tooltip / aria when idle */
  title?: string
  disabled?: boolean
}

export function CopyButton({
  text,
  className = '',
  title = 'کپی',
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(text)
    if (!ok) return
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const idle = !copied
  const label = idle ? title : 'کپی شد'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`shrink-0 ${className}`}
      title={label}
      aria-label={label}
      disabled={disabled || !text}
      onClick={() => {
        void handleCopy()
      }}
    >
      {idle ? (
        <Copy className="size-3.5" />
      ) : (
        <>
          <Check className="size-3.5 text-accent" />
          <span className="text-[10px]">کپی شد</span>
        </>
      )}
    </Button>
  )
}
