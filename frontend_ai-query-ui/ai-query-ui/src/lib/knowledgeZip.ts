import JSZip from 'jszip'
import type { KnowledgeDocFile, VersionKnowledgeRecord } from '../types/software'
import {
  KnowledgePathError,
  assertNoDuplicatePath,
  isValidKnowledgeFileName,
  normalizePath,
  sanitizeKnowledgePath,
  splitKnowledgePath,
} from './knowledgeFileRules'

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.sql',
  '.json',
  '.xml',
  '.yml',
  '.yaml',
  '.csv',
  '.tsv',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.cs',
  '.java',
  '.py',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.less',
  '.ini',
  '.cfg',
  '.conf',
  '.env',
  '.log',
  '.graphql',
  '.gql',
  '.prisma',
  '.toml',
  '.properties',
])

/** سقف تقریبی محتوا در localStorage (کاراکتر) */
const MAX_CONTENT_CHARS = 400_000

function faNow() {
  return new Date().toLocaleDateString('fa-IR')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isTextKnowledgePath(path: string): boolean {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  if (dot < 0) return false
  return TEXT_EXTENSIONS.has(base.slice(dot).toLowerCase())
}

function shouldSkipZipEntry(path: string): boolean {
  const p = normalizePath(path)
  if (!p || p.endsWith('/')) return true
  if (p.startsWith('__MACOSX/') || p.includes('/__MACOSX/')) return true
  if (p.split('/').some((seg) => seg === '.DS_Store')) return true
  return false
}

function newFileId() {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function entryToDocFile(
  path: string,
  entry: JSZip.JSZipObject,
): Promise<KnowledgeDocFile | null> {
  if (shouldSkipZipEntry(path)) return null

  const sanitized = sanitizeKnowledgePath(path)
  if (!sanitized) return null

  const { name } = splitKnowledgePath(sanitized)
  if (!isValidKnowledgeFileName(name)) return null

  const asText = isTextKnowledgePath(sanitized)

  if (asText) {
    let text = await entry.async('string')
    if (text.length > MAX_CONTENT_CHARS) {
      text =
        text.slice(0, MAX_CONTENT_CHARS) +
        '\n\n/* …بریده‌شده به‌خاطر محدودیت ذخیره محلی */'
    }
    const bytes = new TextEncoder().encode(text).length
    return {
      id: newFileId(),
      path: sanitized,
      name,
      sizeLabel: formatSize(bytes),
      updatedAt: faNow(),
      encoding: 'text',
      content: text,
      active: true,
    }
  }

  const buf = await entry.async('uint8array')
  const slice = buf.subarray(0, Math.min(buf.length, 300_000))
  return {
    id: newFileId(),
    path: sanitized,
    name,
    sizeLabel: formatSize(buf.length),
    updatedAt: faNow(),
    encoding: 'base64',
    content: bytesToBase64(slice),
    active: true,
  }
}

export type ExtractKnowledgeZipResult = {
  files: KnowledgeDocFile[]
  warnings: string[]
}

/** استخراج فایل‌های ZIP با حفظ مسیر فولدر و اعمال قواعد فیزیکی نام/مسیر */
export async function extractKnowledgeZip(
  file: File,
): Promise<ExtractKnowledgeZipResult> {
  const zip = await JSZip.loadAsync(file)
  const paths = Object.keys(zip.files).sort((a, b) => a.localeCompare(b, 'en'))
  const byPath = new Map<string, KnowledgeDocFile>()
  const warnings: string[] = []
  let skippedInvalid = 0
  let overwritten = 0

  for (const path of paths) {
    const entry = zip.files[path]
    if (!entry || entry.dir) continue
    const doc = await entryToDocFile(path, entry)
    if (!doc) {
      const norm = normalizePath(path)
      if (
        norm &&
        !norm.endsWith('/') &&
        !norm.startsWith('__MACOSX/') &&
        !norm.includes('/__MACOSX/') &&
        !norm.split('/').some((seg) => seg === '.DS_Store')
      ) {
        skippedInvalid += 1
      }
      continue
    }
    const key = normalizePath(doc.path).toLowerCase()
    if (byPath.has(key)) {
      overwritten += 1
    }
    byPath.set(key, doc)
  }

  if (skippedInvalid > 0) {
    warnings.push(
      `${skippedInvalid.toLocaleString('fa-IR')} ورودی به‌خاطر نام/مسیر نامعتبر یا traversal رد شد.`,
    )
  }
  if (overwritten > 0) {
    warnings.push(
      `${overwritten.toLocaleString('fa-IR')} مسیر تکراری پس از نرمال‌سازی؛ آخرین نسخه نگه داشته شد.`,
    )
  }

  return {
    files: Array.from(byPath.values()),
    warnings,
  }
}

/**
 * خواندن یک فایل محلی به‌عنوان سند دانش.
 * مسیر باید پس از sanitize معتبر باشد؛ در صورت لیست موجود، تکراری بودن بررسی می‌شود.
 */
export async function readLocalFileAsDoc(
  file: File,
  path: string,
  existing: ReadonlyArray<{ id?: string; path: string }> = [],
  excludeId?: string,
): Promise<KnowledgeDocFile> {
  const sanitized = sanitizeKnowledgePath(path)
  if (!sanitized) {
    throw new KnowledgePathError(
      'مسیر فایل نامعتبر است (کاراکتر غیرمجاز، نام رزرو ویندوز، یا مسیر خارج از محدوده).',
    )
  }

  const { name } = splitKnowledgePath(sanitized)
  if (!isValidKnowledgeFileName(name)) {
    throw new KnowledgePathError(
      `نام فایل «${name || file.name}» معتبر نیست. از کاراکترهای خاص، نقطه/فاصلهٔ انتهایی و نام‌های رزرو ویندوز استفاده نکنید.`,
    )
  }

  assertNoDuplicatePath(sanitized, existing, excludeId)

  if (isTextKnowledgePath(sanitized) || file.type.startsWith('text/')) {
    let text = await file.text()
    if (text.length > MAX_CONTENT_CHARS) {
      text = text.slice(0, MAX_CONTENT_CHARS)
    }
    return {
      id: newFileId(),
      path: sanitized,
      name,
      sizeLabel: formatSize(file.size),
      updatedAt: faNow(),
      encoding: 'text',
      content: text,
      active: true,
    }
  }
  const buf = new Uint8Array(await file.arrayBuffer())
  const slice = buf.subarray(0, Math.min(buf.length, 300_000))
  return {
    id: newFileId(),
    path: sanitized,
    name,
    sizeLabel: formatSize(file.size),
    updatedAt: faNow(),
    encoding: 'base64',
    content: bytesToBase64(slice),
    active: true,
  }
}

export function emptyVersionKnowledge(versionId: string): VersionKnowledgeRecord {
  return {
    versionId,
    description: '',
    analysis: '',
    selectedDatabaseIds: [],
    databaseDocs: [],
    confirmed: false,
  }
}
