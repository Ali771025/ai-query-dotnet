import type {
  KnowledgeDocFile,
  VersionKnowledgeRecord,
} from '../types/software'
import {
  orderedVersionIdsForSoftware,
  orderVersionsForSoftware,
} from './databases'
import { normalizePath } from './knowledgeFileRules'

export { orderVersionsForSoftware, orderedVersionIdsForSoftware }

export type PropagateDirection = 'backward' | 'forward'

export type ContentSnapshot = {
  encoding: KnowledgeDocFile['encoding']
  content: string
}

/** هش ساده و پایدار از encoding+content برای مقایسهٔ هویت */
export function computeContentHash(
  encoding: KnowledgeDocFile['encoding'],
  content: string,
): string {
  const s = `${encoding}\0${content}`
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i)
  }
  // دو پاس کوتاه برای کاهش برخورد در محتواهای شبیه
  let h2 = 2166136261
  for (let i = 0; i < s.length; i++) {
    h2 ^= s.charCodeAt(i)
    h2 = Math.imul(h2, 16777619)
  }
  return `${(h >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`
}

export function contentKey(
  file: Pick<KnowledgeDocFile, 'encoding' | 'content'> & {
    contentHash?: string
  },
): string {
  return file.contentHash ?? computeContentHash(file.encoding, file.content)
}

export function withContentHash(file: KnowledgeDocFile): KnowledgeDocFile {
  if (file.contentHash) return file
  return {
    ...file,
    contentHash: computeContentHash(file.encoding, file.content),
  }
}

export function filesContentEqual(
  a: Pick<KnowledgeDocFile, 'encoding' | 'content'> & { contentHash?: string },
  b: Pick<KnowledgeDocFile, 'encoding' | 'content'> & { contentHash?: string },
): boolean {
  return contentKey(a) === contentKey(b)
}

function pathKey(path: string): string {
  return normalizePath(path).toLowerCase()
}

export type NearestPreviousDatabaseSource = {
  versionId: string
  files: KnowledgeDocFile[]
}

/**
 * نزدیک‌ترین نسخهٔ قبلی که برای این databaseId مستند دارد
 * (همان نسخه‌ای که برای diff/ارث استفاده می‌شود).
 * در صورت نبود → `null` (همه فایل‌ها جدیدند).
 */
export function findNearestPreviousDatabaseSource(
  orderedVersionIds: ReadonlyArray<string>,
  currentVersionId: string,
  databaseId: string,
  getKnowledge: (versionId: string) => VersionKnowledgeRecord,
): NearestPreviousDatabaseSource | null {
  const idx = orderedVersionIds.indexOf(currentVersionId)
  if (idx <= 0) return null

  for (let i = idx - 1; i >= 0; i--) {
    const versionId = orderedVersionIds[i]
    if (!versionId) continue
    const docs = getKnowledge(versionId).databaseDocs.find(
      (d) => d.databaseId === databaseId,
    )
    if (docs && docs.files.length > 0) {
      return { versionId, files: docs.files }
    }
  }
  return null
}

/**
 * نزدیک‌ترین نسخهٔ قبلی که برای این databaseId مستند دارد.
 * در صورت نبود → `null` (همه فایل‌ها جدیدند).
 */
export function findNearestPreviousDatabaseFiles(
  orderedVersionIds: ReadonlyArray<string>,
  currentVersionId: string,
  databaseId: string,
  getKnowledge: (versionId: string) => VersionKnowledgeRecord,
): KnowledgeDocFile[] | null {
  return (
    findNearestPreviousDatabaseSource(
      orderedVersionIds,
      currentVersionId,
      databaseId,
      getKnowledge,
    )?.files ?? null
  )
}

export type FileIdentityReferenceVersion = {
  versionId: string
}

/**
 * نسخهٔ مرجع هویت یک فایل = اولین نسخه (به ترتیب نرم‌افزار) که برای این
 * databaseId فایلی با همان `id` در مستندات ذخیره‌شده دارد.
 * (`referencedVersions` روی SoftwareVersion مربوط به نسب نسخه است، نه هویت فایل.)
 */
export function findFileIdentityReferenceVersion(
  orderedVersionIds: ReadonlyArray<string>,
  fileId: string,
  databaseId: string,
  getKnowledge: (versionId: string) => VersionKnowledgeRecord,
): FileIdentityReferenceVersion | null {
  for (const versionId of orderedVersionIds) {
    if (!versionId) continue
    const docs = getKnowledge(versionId).databaseDocs.find(
      (d) => d.databaseId === databaseId,
    )
    if (docs?.files.some((f) => f.id === fileId)) {
      return { versionId }
    }
  }
  return null
}

/**
 * وضعیت `active` را روی همهٔ نسخه‌هایی که همان file id را برای این databaseId
 * دارند اعمال می‌کند و رکوردهای تغییر یافته را برمی‌گرداند.
 */
export function applyFileActiveAcrossVersions(args: {
  orderedVersionIds: ReadonlyArray<string>
  databaseId: string
  fileId: string
  active: boolean
  updatedAt: string
  getKnowledge: (versionId: string) => VersionKnowledgeRecord
  /** نسخهٔ جاری که معمولاً فقط در state محلی به‌روز می‌شود */
  skipVersionId?: string
}): VersionKnowledgeRecord[] {
  const patched: VersionKnowledgeRecord[] = []

  for (const versionId of args.orderedVersionIds) {
    if (!versionId) continue
    if (args.skipVersionId && versionId === args.skipVersionId) continue

    const record = args.getKnowledge(versionId)
    const docsIdx = record.databaseDocs.findIndex(
      (d) => d.databaseId === args.databaseId,
    )
    if (docsIdx < 0) continue
    const docs = record.databaseDocs[docsIdx]
    if (!docs?.files.some((f) => f.id === args.fileId)) continue

    const nextFiles = docs.files.map((f) =>
      f.id === args.fileId
        ? { ...f, active: args.active, updatedAt: args.updatedAt }
        : f,
    )
    const nextDocs = record.databaseDocs.slice()
    nextDocs[docsIdx] = {
      ...docs,
      files: nextFiles,
      updatedAt: args.updatedAt,
    }
    patched.push({
      ...record,
      databaseDocs: nextDocs,
    })
  }

  return patched
}

export type IdentityMergeResult = {
  files: KnowledgeDocFile[]
  reusedCount: number
  changedCount: number
  newCount: number
  /** مسیرهایی که در نسخهٔ قبل بودند و در ZIP نیستند (= حذف) */
  removedCount: number
  /**
   * فایل‌هایی که محتوایشان نسبت به نسخهٔ قبلی عوض شده یا جدیدند
   * (برای انتشار انتخابی). برای changed، `baseline` محتوای قبلی است.
   */
  changedEntries: Array<{
    file: KnowledgeDocFile
    /** null = فایل کاملاً جدید (شناسه تازه) */
    baseline: ContentSnapshot | null
  }>
}

function newKnowledgeFileId() {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * ادغام خروجی ZIP با هویت فایل‌های نسخهٔ قبلی همان دیتابیس (سورس‌کنترل ساده):
 * - path+content یکسان → همان id قبلی
 * - path موجود با محتوای متفاوت → id جدید (تاریخچه)
 * - path جدید → id جدید
 * - path فقط در نسخهٔ قبل (در ZIP نیست) → حذف در این نسخه
 */
export function mergeZipWithIdentityReuse(
  extracted: ReadonlyArray<KnowledgeDocFile>,
  previousFiles: ReadonlyArray<KnowledgeDocFile> | null,
): IdentityMergeResult {
  const prevByPath = new Map<string, KnowledgeDocFile>()
  if (previousFiles) {
    for (const f of previousFiles) {
      prevByPath.set(pathKey(f.path), f)
    }
  }

  let reusedCount = 0
  let changedCount = 0
  let newCount = 0
  const changedEntries: IdentityMergeResult['changedEntries'] = []
  const files: KnowledgeDocFile[] = []
  const seenPaths = new Set<string>()

  for (const raw of extracted) {
    const incoming = withContentHash(raw)
    const key = pathKey(incoming.path)
    seenPaths.add(key)
    const prev = prevByPath.get(key)

    if (!prev) {
      newCount += 1
      const file = withContentHash({
        ...incoming,
        id: incoming.id || newKnowledgeFileId(),
      })
      files.push(file)
      changedEntries.push({ file, baseline: null })
      continue
    }

    if (filesContentEqual(prev, incoming)) {
      reusedCount += 1
      files.push(
        withContentHash({
          ...incoming,
          id: prev.id,
          updatedAt: prev.updatedAt,
          active: prev.active,
          contentHash: prev.contentHash ?? contentKey(prev),
        }),
      )
      continue
    }

    changedCount += 1
    const file = withContentHash({
      ...incoming,
      id: newKnowledgeFileId(),
    })
    files.push(file)
    changedEntries.push({
      file,
      baseline: { encoding: prev.encoding, content: prev.content },
    })
  }

  let removedCount = 0
  for (const key of prevByPath.keys()) {
    if (!seenPaths.has(key)) removedCount += 1
  }

  return {
    files,
    reusedCount,
    changedCount,
    newCount,
    removedCount,
    changedEntries,
  }
}

export type DocDiffKind = 'unchanged' | 'added' | 'modified' | 'removed'

export type DocDiffEntry = {
  kind: DocDiffKind
  path: string
  /** فایل نسخهٔ جاری (برای removed وجود ندارد) */
  current?: KnowledgeDocFile
  /** فایل نسخهٔ قبلی (برای added وجود ندارد) */
  previous?: KnowledgeDocFile
}

/**
 * مقایسهٔ درخت مستندات نسخهٔ جاری با نسخهٔ پایه/قبلی.
 * حذف = مسیر در قبل هست و در جاری نیست.
 */
export function diffKnowledgeDocs(
  currentFiles: ReadonlyArray<KnowledgeDocFile> | null | undefined,
  previousFiles: ReadonlyArray<KnowledgeDocFile> | null | undefined,
): DocDiffEntry[] {
  const curr = currentFiles ?? []
  const prev = previousFiles ?? []
  const currBy = new Map(curr.map((f) => [pathKey(f.path), f]))
  const prevBy = new Map(prev.map((f) => [pathKey(f.path), f]))
  const keys = new Set([...currBy.keys(), ...prevBy.keys()])
  const out: DocDiffEntry[] = []

  for (const key of [...keys].sort()) {
    const c = currBy.get(key)
    const p = prevBy.get(key)
    if (c && p) {
      if (filesContentEqual(c, p)) {
        out.push({ kind: 'unchanged', path: c.path, current: c, previous: p })
      } else {
        out.push({ kind: 'modified', path: c.path, current: c, previous: p })
      }
      continue
    }
    if (c && !p) {
      out.push({ kind: 'added', path: c.path, current: c })
      continue
    }
    if (p && !c) {
      out.push({ kind: 'removed', path: p.path, previous: p })
    }
  }

  return out
}

export function docDiffKindByPath(
  diffs: ReadonlyArray<DocDiffEntry>,
): Map<string, DocDiffKind> {
  const map = new Map<string, DocDiffKind>()
  for (const d of diffs) {
    map.set(pathKey(d.path), d.kind)
  }
  return map
}

function faNow() {
  return new Date().toLocaleDateString('fa-IR')
}

function patchRecordDatabaseFile(
  record: VersionKnowledgeRecord,
  databaseId: string,
  updatedFile: KnowledgeDocFile,
  matchPath: string,
): VersionKnowledgeRecord | null {
  const docsIdx = record.databaseDocs.findIndex(
    (d) => d.databaseId === databaseId,
  )
  if (docsIdx < 0) return null
  const docs = record.databaseDocs[docsIdx]
  if (!docs) return null

  const key = pathKey(matchPath)
  const fileIdx = docs.files.findIndex((f) => pathKey(f.path) === key)
  if (fileIdx < 0) return null

  const existing = docs.files[fileIdx]
  if (!existing) return null

  const nextFile = withContentHash({
    ...existing,
    id: updatedFile.id,
    content: updatedFile.content,
    encoding: updatedFile.encoding,
    sizeLabel: updatedFile.sizeLabel,
    updatedAt: updatedFile.updatedAt || faNow(),
    contentHash:
      updatedFile.contentHash ??
      computeContentHash(updatedFile.encoding, updatedFile.content),
    name: existing.name,
    path: existing.path,
    active: existing.active,
  })

  const nextFiles = docs.files.slice()
  nextFiles[fileIdx] = nextFile

  const nextDocs = record.databaseDocs.slice()
  nextDocs[docsIdx] = {
    ...docs,
    files: nextFiles,
    updatedAt: faNow(),
  }

  return {
    ...record,
    databaseDocs: nextDocs,
  }
}

/**
 * انتشار تغییر یک فایل در زنجیرهٔ نسخه‌هایی که هنوز همان file id
 * و همان محتوای baseline را برای آن path دارند.
 * با رسیدن به id متفاوت یا محتوای متفاوت متوقف می‌شود.
 */
export function propagateFileChange(args: {
  orderedVersionIds: ReadonlyArray<string>
  currentVersionId: string
  databaseId: string
  updatedFile: KnowledgeDocFile
  baseline: ContentSnapshot
  direction: PropagateDirection
  getKnowledge: (versionId: string) => VersionKnowledgeRecord
}): VersionKnowledgeRecord[] {
  const idx = args.orderedVersionIds.indexOf(args.currentVersionId)
  if (idx < 0) return []

  const step = args.direction === 'backward' ? -1 : 1
  const baselineKey = contentKey(args.baseline)
  const targetPath = args.updatedFile.path
  const targetId = args.updatedFile.id
  const patched: VersionKnowledgeRecord[] = []

  for (
    let i = idx + step;
    i >= 0 && i < args.orderedVersionIds.length;
    i += step
  ) {
    const versionId = args.orderedVersionIds[i]
    if (!versionId) break

    const record = args.getKnowledge(versionId)
    const docs = record.databaseDocs.find(
      (d) => d.databaseId === args.databaseId,
    )
    if (!docs) break

    const file = docs.files.find(
      (f) => pathKey(f.path) === pathKey(targetPath),
    )
    if (!file) break
    if (file.id !== targetId) break
    if (contentKey(file) !== baselineKey) break

    const next = patchRecordDatabaseFile(
      record,
      args.databaseId,
      args.updatedFile,
      targetPath,
    )
    if (!next) break
    patched.push(next)
  }

  return patched
}

export type FileChangeForPropagate = {
  updatedFile: KnowledgeDocFile
  /** اگر null باشد (فایل جدید)، انتشاری انجام نمی‌شود */
  baseline: ContentSnapshot | null
}

/**
 * چند تغییر را با تجمیع روی یک Map از records منتشر می‌کند.
 */
export function propagateFileChanges(args: {
  orderedVersionIds: ReadonlyArray<string>
  currentVersionId: string
  databaseId: string
  changes: ReadonlyArray<FileChangeForPropagate>
  propagateBackward: boolean
  propagateForward: boolean
  getKnowledge: (versionId: string) => VersionKnowledgeRecord
}): {
  records: VersionKnowledgeRecord[]
  touchedVersionCount: number
} {
  if (!args.propagateBackward && !args.propagateForward) {
    return { records: [], touchedVersionCount: 0 }
  }

  const byVersion = new Map<string, VersionKnowledgeRecord>()
  const getK = (versionId: string) =>
    byVersion.get(versionId) ?? args.getKnowledge(versionId)

  const directions: PropagateDirection[] = []
  if (args.propagateBackward) directions.push('backward')
  if (args.propagateForward) directions.push('forward')

  for (const change of args.changes) {
    if (!change.baseline) continue
    for (const direction of directions) {
      const patched = propagateFileChange({
        orderedVersionIds: args.orderedVersionIds,
        currentVersionId: args.currentVersionId,
        databaseId: args.databaseId,
        updatedFile: change.updatedFile,
        baseline: change.baseline,
        direction,
        getKnowledge: getK,
      })
      for (const r of patched) {
        byVersion.set(r.versionId, r)
      }
    }
  }

  return {
    records: Array.from(byVersion.values()),
    touchedVersionCount: byVersion.size,
  }
}
