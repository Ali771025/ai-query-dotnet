import type { KnowledgeDocFile } from '../types/software'
import { normalizePath, sanitizeKnowledgePath } from './knowledgeFileRules'

export type DocTreeFolder = {
  kind: 'folder'
  name: string
  /** مسیر نسبی فولدر (بدون اسلش پایانی)؛ ریشه = '' */
  path: string
  /** تعداد فایل‌های زیرمجموعه (بازگشتی) */
  fileCount: number
  children: DocTreeNode[]
}

export type DocTreeFileNode = {
  kind: 'file'
  file: KnowledgeDocFile
}

export type DocTreeNode = DocTreeFolder | DocTreeFileNode

export type DocFilterStatus = 'all' | 'active' | 'inactive'
export type DocFilterEncoding = 'all' | 'text' | 'base64'

export type KnowledgeDocFilter = {
  query?: string
  status?: DocFilterStatus
  encoding?: DocFilterEncoding
}

export function normalizeDocPath(path: string): string {
  return normalizePath(path)
}

export function filterKnowledgeDocs(
  files: KnowledgeDocFile[],
  opts: KnowledgeDocFilter = {},
): KnowledgeDocFile[] {
  const q = opts.query?.trim().toLowerCase() ?? ''
  const status = opts.status ?? 'all'
  const encoding = opts.encoding ?? 'all'

  return files.filter((f) => {
    if (status === 'active' && !f.active) return false
    if (status === 'inactive' && f.active) return false
    if (encoding === 'text' && f.encoding !== 'text') return false
    if (encoding === 'base64' && f.encoding !== 'base64') return false
    if (q) {
      const hay = `${f.path} ${f.name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function isDocFilterActive(opts: KnowledgeDocFilter): boolean {
  return Boolean(
    opts.query?.trim() ||
      (opts.status && opts.status !== 'all') ||
      (opts.encoding && opts.encoding !== 'all'),
  )
}

/** ساخت درخت فولدر از مسیرهای فایل؛ فرزندان: فولدرها سپس فایل‌ها، مرتب الفبایی */
export function buildKnowledgeDocTree(files: KnowledgeDocFile[]): DocTreeFolder {
  const root: DocTreeFolder = {
    kind: 'folder',
    name: '',
    path: '',
    fileCount: 0,
    children: [],
  }
  const folders = new Map<string, DocTreeFolder>([['', root]])

  const ensureFolder = (folderPath: string): DocTreeFolder => {
    const existing = folders.get(folderPath)
    if (existing) return existing

    const parts = folderPath.split('/')
    const name = parts[parts.length - 1] ?? folderPath
    const parentPath = parts.slice(0, -1).join('/')
    const parent = ensureFolder(parentPath)
    const folder: DocTreeFolder = {
      kind: 'folder',
      name,
      path: folderPath,
      fileCount: 0,
      children: [],
    }
    parent.children.push(folder)
    folders.set(folderPath, folder)
    return folder
  }

  const sorted = files
    .slice()
    .sort((a, b) => normalizeDocPath(a.path).localeCompare(normalizeDocPath(b.path), 'en'))

  for (const file of sorted) {
    const sanitized = sanitizeKnowledgePath(file.path)
    const norm = sanitized ?? normalizeDocPath(file.path)
    const displayFile =
      sanitized && sanitized !== file.path
        ? {
            ...file,
            path: sanitized,
            name: sanitized.split('/').pop() || file.name,
          }
        : file
    const slash = norm.lastIndexOf('/')
    const dir = slash >= 0 ? norm.slice(0, slash) : ''
    ensureFolder(dir).children.push({ kind: 'file', file: displayFile })
  }

  const finalize = (folder: DocTreeFolder): number => {
    let count = 0
    for (const child of folder.children) {
      count += child.kind === 'folder' ? finalize(child) : 1
    }
    folder.fileCount = count
    folder.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      const an = a.kind === 'folder' ? a.name : a.file.name
      const bn = b.kind === 'folder' ? b.name : b.file.name
      return an.localeCompare(bn, 'en')
    })
    return count
  }

  finalize(root)
  return root
}
