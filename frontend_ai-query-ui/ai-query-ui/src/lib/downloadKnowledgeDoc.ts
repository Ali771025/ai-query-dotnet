import type { KnowledgeDocFile } from '../types/software'

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export type DownloadKnowledgeDocOptions = {
  /** Override browser download filename (keeps file content unchanged). */
  fileName?: string
}

/** `{basename}_pre{n}{ext}` / `{basename}_cur{n}{ext}` from original file name. */
export function versionedKnowledgeDocFileName(
  fileName: string,
  tag: 'pre' | 'cur',
  versionLabel: string,
): string {
  const fallback = fileName || 'download'
  const dot = fallback.lastIndexOf('.')
  const hasExt = dot > 0
  const base = hasExt ? fallback.slice(0, dot) : fallback
  const ext = hasExt ? fallback.slice(dot) : ''
  return `${base}_${tag}${versionLabel}${ext}`
}

/** Trigger a browser download for a knowledge doc (text or base64 binary). */
export function downloadKnowledgeDocFile(
  file: KnowledgeDocFile,
  options?: DownloadKnowledgeDocOptions,
): void {
  const blob =
    file.encoding === 'text'
      ? new Blob([file.content], { type: 'text/plain;charset=utf-8' })
      : new Blob([base64ToUint8Array(file.content) as BlobPart])

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = options?.fileName || file.name || 'download'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
