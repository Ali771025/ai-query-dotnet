/** قواعد فیزیکی نام/مسیر فایل‌های مستندات دانش نسخه (ویندوز + عمومی) */

const ILLEGAL_CHARS_RE = /[<>:"|?*\u0000-\u001f]/g

const RESERVED_BASENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

/** یکسان‌سازی جداکننده و حذف اسلش ابتدا/انتها */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function stripTrailingDotsAndSpaces(segment: string): string {
  return segment.replace(/[.\s]+$/g, '')
}

function reservedStem(segment: string): string {
  const base = segment.includes('.')
    ? segment.slice(0, segment.lastIndexOf('.'))
    : segment
  return base.toUpperCase()
}

function hasIllegalChars(value: string): boolean {
  ILLEGAL_CHARS_RE.lastIndex = 0
  return ILLEGAL_CHARS_RE.test(value)
}

/** نام فایل (بدون مسیر) از نظر کاراکتر خاص / رزرو ویندوز معتبر است؟ */
export function isValidKnowledgeFileName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (trimmed.includes('/') || trimmed.includes('\\')) return false
  if (hasIllegalChars(trimmed)) return false
  if (stripTrailingDotsAndSpaces(trimmed) !== trimmed) return false
  if (!stripTrailingDotsAndSpaces(trimmed)) return false
  if (RESERVED_BASENAMES.has(reservedStem(trimmed))) return false
  if (trimmed === '.' || trimmed === '..') return false
  return true
}

function sanitizeSegment(segment: string): string | null {
  if (segment === '' || segment === '.' || segment === '..') return null

  let s = segment.replace(ILLEGAL_CHARS_RE, '_')
  s = stripTrailingDotsAndSpaces(s)
  if (!s) s = '_'

  if (RESERVED_BASENAMES.has(reservedStem(s))) {
    s = `_${s}`
  }

  // پس از sanitize هنوز نباید جداکننده یا کاراکتر غیرمجاز بماند
  if (s.includes('/') || s.includes('\\') || hasIllegalChars(s)) return null
  if (s === '.' || s === '..') return null
  return s
}

/**
 * پاک‌سازی مسیر نسبی فایل دانش.
 * در صورت traversal (`..`) یا نام غیرقابل‌بازیابی → `null`.
 */
export function sanitizeKnowledgePath(path: string): string | null {
  const norm = normalizePath(path)
  if (!norm) return null

  const parts = norm.split('/')
  if (parts.some((p) => p === '..' || p === '.')) return null

  const sanitized: string[] = []
  for (const part of parts) {
    const next = sanitizeSegment(part)
    if (next === null) return null
    sanitized.push(next)
  }

  const joined = sanitized.join('/')
  return joined || null
}

export class KnowledgePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnowledgePathError'
  }
}

/**
 * در یک پوشهٔ والد، مسیر تکراری نباشد.
 * `excludeId` برای جایگزینی همان فایل (نگه داشتن path موجود).
 */
export function assertNoDuplicatePath(
  path: string,
  existing: ReadonlyArray<{ id?: string; path: string }>,
  excludeId?: string,
): void {
  const target = normalizePath(path).toLowerCase()
  if (!target) {
    throw new KnowledgePathError('مسیر فایل نامعتبر است.')
  }

  const clash = existing.find((f) => {
    if (excludeId && f.id === excludeId) return false
    return normalizePath(f.path).toLowerCase() === target
  })

  if (clash) {
    throw new KnowledgePathError(
      `فایلی با مسیر «${normalizePath(path)}» در همین پوشه از قبل وجود دارد.`,
    )
  }
}

/** مسیر والد (دایرکتوری) و نام فایل از path نرمال‌شده */
export function splitKnowledgePath(path: string): {
  dir: string
  name: string
} {
  const norm = normalizePath(path)
  const slash = norm.lastIndexOf('/')
  if (slash < 0) return { dir: '', name: norm }
  return { dir: norm.slice(0, slash), name: norm.slice(slash + 1) }
}
