import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  Diff,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  Replace,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from 'lucide-react'
import { confirmDelete } from '../../lib/confirm'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/CopyButton'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { Textarea } from '../../components/ui/Textarea'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import {
  isDatabaseInVersion,
  orderedVersionIdsForSoftware,
} from '../../lib/databases'
import {
  buildKnowledgeDocTree,
  filterKnowledgeDocs,
  isDocFilterActive,
  type DocFilterEncoding,
  type DocFilterStatus,
  type DocTreeFolder,
} from '../../lib/knowledgeDocTree'
import {
  KnowledgePathError,
  normalizePath,
} from '../../lib/knowledgeFileRules'
import {
  emptyVersionKnowledge,
  readLocalFileAsDoc,
} from '../../lib/knowledgeZip'
import {
  applyFileActiveAcrossVersions,
  findFileIdentityReferenceVersion,
  findNearestPreviousDatabaseFiles,
  findNearestPreviousDatabaseSource,
  propagateFileChanges,
  withContentHash,
  diffKnowledgeDocs,
  docDiffKindByPath,
  filesContentEqual,
  computeContentHash,
  type DocDiffKind,
  type DocDiffEntry,
} from '../../lib/knowledgeFileIdentity'
import {
  downloadKnowledgeDocFile,
  versionedKnowledgeDocFileName,
} from '../../lib/downloadKnowledgeDoc'
import {
  diffLines,
  toSideBySide,
  type DiffSegment,
} from '../../lib/textDiff'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type {
  DatabaseVersionDocs,
  KnowledgeDocFile,
  VersionKnowledgeRecord,
} from '../../types/software'
import { knowledgeApi, type KnowledgeJobDto, type SnapshotDto } from '../../api/knowledge'

function faNow() {
  return new Date().toLocaleDateString('fa-IR')
}

function sortFiles(files: KnowledgeDocFile[]) {
  return files.slice().sort((a, b) => a.path.localeCompare(b.path, 'en'))
}

type PropagateOpts = {
  backward: boolean
  forward: boolean
}

const defaultPropagateOpts = (): PropagateOpts => ({
  backward: false,
  forward: false,
})

function PropagateCheckboxes({
  value,
  onChange,
}: {
  value: PropagateOpts
  onChange: (next: PropagateOpts) => void
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-input/40 px-3 py-2">
      <p className="text-xs text-muted">
        انتشار تغییر فقط تا جایی که همان شناسهٔ فایل بدون واگرایی مانده باشد.
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent,#0d9488)]"
          checked={value.backward}
          onChange={(e) =>
            onChange({ ...value, backward: e.target.checked })
          }
        />
        اعمال به نسخه‌های قبلی
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent,#0d9488)]"
          checked={value.forward}
          onChange={(e) =>
            onChange({ ...value, forward: e.target.checked })
          }
        />
        اعمال به نسخه‌های بعدی
      </label>
    </div>
  )
}

const DIFF_LABEL: Record<DocDiffKind, string> = {
  unchanged: 'بدون تغییر',
  added: 'جدید',
  modified: 'تغییریافته',
  removed: 'حذف‌شده',
}

const DIFF_ROW_CLASS: Record<DocDiffKind, string> = {
  unchanged: '',
  added: 'bg-emerald-500/10',
  modified: 'bg-amber-500/15',
  removed: 'bg-rose-500/10',
}

const DIFF_BADGE_VARIANT: Record<
  DocDiffKind,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  unchanged: 'neutral',
  added: 'success',
  modified: 'warning',
  removed: 'danger',
}

type FileActiveControl =
  | { kind: 'toggle' }
  | { kind: 'openReference'; href: string }

type DocsFileActions = {
  onEdit: (file: KnowledgeDocFile) => void
  onReplace: (file: KnowledgeDocFile) => void
  onDelete: (file: KnowledgeDocFile) => void
  onToggleActive: (fileId: string) => void
  /** فعال/غیرفعال فقط روی نسخهٔ مرجع هویت؛ در غیر این صورت لینک به نسخهٔ مرجع */
  resolveActiveControl: (fileId: string) => FileActiveControl
}

function FileActiveControlButton({
  file,
  actions,
}: {
  file: KnowledgeDocFile
  actions: DocsFileActions
}) {
  const control = actions.resolveActiveControl(file.id)
  if (control.kind === 'openReference') {
    return (
      <Button
        variant="ghost"
        size="sm"
        title="رفتن به نسخه مرجع"
        onClick={() =>
          window.open(control.href, '_blank', 'noopener,noreferrer')
        }
      >
        <ExternalLink className="size-3.5" />
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      title={file.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
      onClick={() => actions.onToggleActive(file.id)}
    >
      {file.active ? (
        <ToggleRight className="size-3.5" />
      ) : (
        <ToggleLeft className="size-3.5" />
      )}
    </Button>
  )
}

function DocFileRow({
  file,
  depth,
  actions,
  readOnly,
  diffKind = 'unchanged',
}: {
  file: KnowledgeDocFile
  depth: number
  actions: DocsFileActions
  readOnly?: boolean
  diffKind?: DocDiffKind
}) {
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm ${DIFF_ROW_CLASS[diffKind]}`}
      style={{ paddingInlineStart: `${12 + depth * 16}px` }}
    >
      <div className="min-w-0">
        <p className="truncate font-medium" title={file.path}>
          <FileText className="me-1 inline size-3.5 opacity-70" />
          {file.name}
        </p>
        <p className="text-xs text-muted">
          {file.sizeLabel} — {file.updatedAt}
          {file.encoding === 'text' ? ' — متنی' : ' — باینری'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {diffKind !== 'unchanged' ? (
          <Badge variant={DIFF_BADGE_VARIANT[diffKind]}>
            {DIFF_LABEL[diffKind]}
          </Badge>
        ) : null}
        <Badge variant={file.active ? 'success' : 'neutral'}>
          {file.active ? 'فعال' : 'غیرفعال'}
        </Badge>
        {!readOnly && file.encoding === 'text' ? (
          <Button
            variant="ghost"
            size="sm"
            title="ویرایش"
            onClick={() => actions.onEdit(file)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
        {!readOnly ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              title="جایگزینی فایل"
              onClick={() => actions.onReplace(file)}
            >
              <Replace className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="حذف فایل"
              onClick={() => actions.onDelete(file)}
            >
              <Trash2 className="size-3.5 text-danger" />
            </Button>
            <FileActiveControlButton file={file} actions={actions} />
          </>
        ) : null}
      </div>
    </li>
  )
}

function DocFolderNode({
  folder,
  depth,
  expanded,
  forceExpand,
  onToggle,
  actions,
  readOnly,
  diffByPath,
}: {
  folder: DocTreeFolder
  depth: number
  expanded: Record<string, boolean>
  forceExpand: boolean
  onToggle: (path: string) => void
  actions: DocsFileActions
  readOnly?: boolean
  diffByPath?: Map<string, DocDiffKind>
}) {
  const open = forceExpand || Boolean(expanded[folder.path])
  const FolderIcon = open ? FolderOpen : Folder

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-start text-sm hover:bg-primary-soft/40"
        style={{ paddingInlineStart: `${12 + depth * 16}px` }}
        onClick={() => onToggle(folder.path)}
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted transition ${open ? '' : '-rotate-90'}`}
        />
        <FolderIcon className="size-3.5 shrink-0 text-accent opacity-80" />
        <span className="min-w-0 flex-1 truncate font-medium text-heading">
          {folder.name}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {folder.fileCount.toLocaleString('fa-IR')} فایل
        </span>
      </button>
      {open ? (
        <ul>
          {folder.children.map((child) =>
            child.kind === 'folder' ? (
              <DocFolderNode
                key={`d:${child.path}`}
                folder={child}
                depth={depth + 1}
                expanded={expanded}
                forceExpand={forceExpand}
                onToggle={onToggle}
                actions={actions}
                readOnly={readOnly}
                diffByPath={diffByPath}
              />
            ) : (
              <DocFileRow
                key={child.file.id}
                file={child.file}
                depth={depth + 1}
                actions={actions}
                readOnly={readOnly}
                diffKind={diffByPath?.get(normalizePath(child.file.path).toLowerCase()) ?? 'unchanged'}
              />
            ),
          )}
        </ul>
      ) : null}
    </li>
  )
}

function DatabaseDocsTree({
  files,
  actions,
  readOnly,
  diffByPath,
}: {
  files: KnowledgeDocFile[]
  actions: DocsFileActions
  readOnly?: boolean
  diffByPath?: Map<string, DocDiffKind>
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<DocFilterStatus>('all')
  const [encoding, setEncoding] = useState<DocFilterEncoding>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const filterOpts = useMemo(
    () => ({ query, status, encoding }),
    [query, status, encoding],
  )
  const filtering = isDocFilterActive(filterOpts)

  const filtered = useMemo(
    () => filterKnowledgeDocs(files, filterOpts),
    [files, filterOpts],
  )
  const tree = useMemo(() => buildKnowledgeDocTree(filtered), [filtered])

  const toggleFolder = (path: string) => {
    if (filtering) return
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const rootFolders = tree.children.filter(
    (c): c is DocTreeFolder => c.kind === 'folder',
  )
  const rootFiles = tree.children.filter((c) => c.kind === 'file')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Input
            label="جستجوی فایل"
            placeholder="نام یا مسیر فایل..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-36">
          <Select
            label="وضعیت"
            value={status}
            onChange={(e) => setStatus(e.target.value as DocFilterStatus)}
            options={[
              { value: 'all', label: 'همه' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
        </div>
        <div className="w-36">
          <Select
            label="نوع فایل"
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as DocFilterEncoding)}
            options={[
              { value: 'all', label: 'همه' },
              { value: 'text', label: 'متنی' },
              { value: 'base64', label: 'باینری' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          نمایش {filtered.length.toLocaleString('fa-IR')} از{' '}
          {files.length.toLocaleString('fa-IR')} فایل
          {filtering ? ' (فیلتر فعال — فولدرها باز)' : ' — فولدرها پیش‌فرض بسته'}
        </span>
        {!filtering && Object.keys(expanded).some((k) => expanded[k]) ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded({})}
          >
            بستن همه فولدرها
          </Button>
        ) : null}
      </div>

      {!filtered.length ? (
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted">
          فایلی با این فیلتر پیدا نشد.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {rootFolders.map((folder) => (
            <DocFolderNode
              key={`d:${folder.path}`}
              folder={folder}
              depth={0}
              expanded={expanded}
              forceExpand={filtering}
              onToggle={toggleFolder}
              actions={actions}
              readOnly={readOnly}
              diffByPath={diffByPath}
            />
          ))}
          {rootFiles.map((node) =>
            node.kind === 'file' ? (
              <DocFileRow
                key={node.file.id}
                file={node.file}
                depth={0}
                actions={actions}
                readOnly={readOnly}
                diffKind={
                  diffByPath?.get(normalizePath(node.file.path).toLowerCase()) ??
                  'unchanged'
                }
              />
            ) : null,
          )}
        </ul>
      )}
    </div>
  )
}

type ChangesViewMode = 'flat' | 'tree'

function renderDiffSegments(segments: DiffSegment[], side: 'left' | 'right') {
  return segments.map((seg, i) => {
    if (seg.kind === 'equal') {
      return <span key={i}>{seg.text}</span>
    }
    if (side === 'left' && seg.kind === 'remove') {
      return (
        <span
          key={i}
          className="rounded-sm bg-rose-500/35 text-rose-900 dark:text-rose-100"
        >
          {seg.text}
        </span>
      )
    }
    if (side === 'right' && seg.kind === 'add') {
      return (
        <span
          key={i}
          className="rounded-sm bg-emerald-500/35 text-emerald-950 dark:text-emerald-100"
        >
          {seg.text}
        </span>
      )
    }
    return null
  })
}

function DiffSideCell({
  side,
  cell,
  changed,
  edge,
}: {
  side: 'left' | 'right'
  cell: { text: string; line: number; segments?: DiffSegment[] } | undefined
  changed: boolean
  edge?: boolean
}) {
  const isModify = cell?.segments != null
  const isPureChange = Boolean(cell && changed && !isModify)

  return (
    <div
      className={`flex min-w-0 ${edge ? 'border-e border-border/60' : ''} ${
        isPureChange
          ? side === 'left'
            ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
            : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
          : isModify
            ? side === 'left'
              ? 'bg-rose-500/5'
              : 'bg-emerald-500/5'
            : cell
              ? ''
              : 'bg-muted/20'
      }`}
    >
      <span className="w-10 shrink-0 select-none border-e border-border/40 px-1 py-0.5 text-end text-[10px] text-muted opacity-70">
        {cell?.line ?? ''}
      </span>
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all px-2 py-0.5">
        {cell?.segments != null
          ? renderDiffSegments(cell.segments, side)
          : (cell?.text ?? '')}
      </pre>
    </div>
  )
}

function FileContentDiffDialog({
  open,
  entry,
  previousVersionLabel,
  currentVersionLabel,
  onClose,
}: {
  open: boolean
  entry: DocDiffEntry | null
  /** SoftwareVersion.version of the version actually compared as previous */
  previousVersionLabel: string
  /** SoftwareVersion.version of the current page version */
  currentVersionLabel: string
  onClose: () => void
}) {
  const previousText =
    entry?.previous?.encoding === 'text' ? entry.previous.content : ''
  const currentText =
    entry?.current?.encoding === 'text' ? entry.current.content : ''
  const fileName =
    entry?.current?.name ?? entry?.previous?.name ?? 'فایل'
  const rows = useMemo(
    () => toSideBySide(diffLines(previousText, currentText)),
    [previousText, currentText],
  )

  return (
    <Dialog
      open={open && Boolean(entry)}
      title={`مقایسه: ${fileName}`}
      onClose={onClose}
      panelClassName="max-w-5xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          بستن
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted">
        <span>
          {entry ? DIFF_LABEL[entry.kind] : ''}
          {entry?.kind === 'added'
            ? ' — فقط نسخهٔ جاری'
            : entry?.kind === 'removed'
              ? ' — فقط نسخهٔ قبلی'
              : ''}
        </span>
      </div>
      <div
        className="overflow-auto rounded-lg border border-border font-mono text-xs"
        dir="ltr"
      >
        <div className="sticky top-0 z-[1] grid grid-cols-2 border-b border-border bg-panel-solid text-[11px] font-sans font-medium text-muted">
          <div className="flex items-center justify-center gap-1 border-e border-border px-2 py-1">
            <span>قبلی</span>
            <CopyButton
              text={previousText}
              title="کپی نسخه قبلی"
              disabled={!previousText}
            />
            <Button
              variant="ghost"
              size="sm"
              title="دانلود نسخه قبلی"
              disabled={!entry?.previous}
              onClick={() => {
                if (!entry?.previous) return
                downloadKnowledgeDocFile(entry.previous, {
                  fileName: versionedKnowledgeDocFileName(
                    entry.previous.name,
                    'pre',
                    previousVersionLabel,
                  ),
                })
              }}
            >
              <Download className="size-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1 px-2 py-1">
            <span>جاری</span>
            <CopyButton
              text={currentText}
              title="کپی نسخه جاری"
              disabled={!currentText}
            />
            <Button
              variant="ghost"
              size="sm"
              title="دانلود نسخه جاری"
              disabled={!entry?.current}
              onClick={() => {
                if (!entry?.current) return
                downloadKnowledgeDocFile(entry.current, {
                  fileName: versionedKnowledgeDocFileName(
                    entry.current.name,
                    'cur',
                    currentVersionLabel,
                  ),
                })
              }}
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-center font-sans text-sm text-muted">
            محتوایی برای مقایسه نیست.
          </p>
        ) : (
          rows.map((row, idx) => (
            <div
              key={idx}
              className="grid min-w-[40rem] grid-cols-2 border-t border-border/60"
            >
              <DiffSideCell
                side="left"
                cell={row.left}
                changed={Boolean(row.left?.removed)}
                edge
              />
              <DiffSideCell
                side="right"
                cell={row.right}
                changed={Boolean(row.right?.added)}
              />
            </div>
          ))
        )}
      </div>
    </Dialog>
  )
}

function ChangesDiffFileRow({
  entry,
  depth,
  showPath,
  actions,
  previousVersionLabel,
  currentVersionLabel,
}: {
  entry: DocDiffEntry
  depth: number
  showPath?: boolean
  actions: DocsFileActions
  previousVersionLabel: string
  currentVersionLabel: string
}) {
  const [diffOpen, setDiffOpen] = useState(false)
  const kind = entry.kind
  const file = entry.current ?? entry.previous
  if (!file) return null

  const isRemoved = kind === 'removed'
  const currentFile = entry.current
  const previousFile = entry.previous
  const encoding = (currentFile ?? previousFile)?.encoding
  const isText = encoding === 'text'
  const canAct = !isRemoved && Boolean(currentFile)

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm first:border-t-0 ${DIFF_ROW_CLASS[kind]}`}
      style={
        depth > 0 ? { paddingInlineStart: `${12 + depth * 16}px` } : undefined
      }
    >
      <div className="min-w-0">
        <p
          className={`truncate font-medium ${isRemoved ? 'line-through opacity-80' : ''}`}
          title={file.path}
        >
          <FileText className="me-1 inline size-3.5 opacity-70" />
          {file.name}
        </p>
        {showPath ? (
          <p className="truncate text-xs text-muted">{file.path}</p>
        ) : null}
        <p className="text-xs text-muted">
          {isText ? 'متنی' : 'باینری'}
          {currentFile ? ` — ${currentFile.active ? 'فعال' : 'غیرفعال'}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={DIFF_BADGE_VARIANT[kind]}>{DIFF_LABEL[kind]}</Badge>

        {isText ? (
          <Button
            variant="ghost"
            size="sm"
            title="مشاهده تفاوت"
            onClick={() => setDiffOpen(true)}
          >
            <Diff className="size-3.5" />
          </Button>
        ) : (
          <>
            {previousFile ? (
              <Button
                variant="ghost"
                size="sm"
                title="دانلود نسخه قبلی"
                onClick={() =>
                  downloadKnowledgeDocFile(previousFile, {
                    fileName: versionedKnowledgeDocFileName(
                      previousFile.name,
                      'pre',
                      previousVersionLabel,
                    ),
                  })
                }
              >
                <Download className="size-3.5" />
                <span className="ms-0.5 text-[10px]">قبلی</span>
              </Button>
            ) : null}
            {currentFile ? (
              <Button
                variant="ghost"
                size="sm"
                title="دانلود نسخه جاری"
                onClick={() =>
                  downloadKnowledgeDocFile(currentFile, {
                    fileName: versionedKnowledgeDocFileName(
                      currentFile.name,
                      'cur',
                      currentVersionLabel,
                    ),
                  })
                }
              >
                <Download className="size-3.5" />
                <span className="ms-0.5 text-[10px]">جاری</span>
              </Button>
            ) : null}
          </>
        )}

        {canAct && currentFile ? (
          <>
            {currentFile.encoding === 'text' ? (
              <Button
                variant="ghost"
                size="sm"
                title="ویرایش"
                onClick={() => actions.onEdit(currentFile)}
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              title="جایگزینی فایل"
              onClick={() => actions.onReplace(currentFile)}
            >
              <Replace className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="حذف فایل"
              onClick={() => actions.onDelete(currentFile)}
            >
              <Trash2 className="size-3.5 text-danger" />
            </Button>
            <FileActiveControlButton file={currentFile} actions={actions} />
          </>
        ) : null}
      </div>

      <FileContentDiffDialog
        open={diffOpen}
        entry={entry}
        previousVersionLabel={previousVersionLabel}
        currentVersionLabel={currentVersionLabel}
        onClose={() => setDiffOpen(false)}
      />
    </li>
  )
}

function ChangesDiffFolderNode({
  folder,
  depth,
  expanded,
  onToggle,
  entryByPath,
  actions,
  previousVersionLabel,
  currentVersionLabel,
}: {
  folder: DocTreeFolder
  depth: number
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  entryByPath: Map<string, DocDiffEntry>
  actions: DocsFileActions
  previousVersionLabel: string
  currentVersionLabel: string
}) {
  const open = expanded[folder.path] !== false
  const FolderIcon = open ? FolderOpen : Folder

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-start text-sm hover:bg-primary-soft/40"
        style={{ paddingInlineStart: `${12 + depth * 16}px` }}
        onClick={() => onToggle(folder.path)}
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted transition ${open ? '' : '-rotate-90'}`}
        />
        <FolderIcon className="size-3.5 shrink-0 text-accent opacity-80" />
        <span className="min-w-0 flex-1 truncate font-medium text-heading">
          {folder.name}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {folder.fileCount.toLocaleString('fa-IR')} فایل
        </span>
      </button>
      {open ? (
        <ul>
          {folder.children.map((child) =>
            child.kind === 'folder' ? (
              <ChangesDiffFolderNode
                key={`d:${child.path}`}
                folder={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                entryByPath={entryByPath}
                actions={actions}
                previousVersionLabel={previousVersionLabel}
                currentVersionLabel={currentVersionLabel}
              />
            ) : (
              (() => {
                const entry = entryByPath.get(
                  normalizePath(child.file.path).toLowerCase(),
                )
                if (!entry) return null
                return (
                  <ChangesDiffFileRow
                    key={child.file.id}
                    entry={entry}
                    depth={depth + 1}
                    actions={actions}
                    previousVersionLabel={previousVersionLabel}
                    currentVersionLabel={currentVersionLabel}
                  />
                )
              })()
            ),
          )}
        </ul>
      ) : null}
    </li>
  )
}

function ChangesVsPreviousPanel({
  diffs,
  actions,
  previousVersionLabel,
  currentVersionLabel,
}: {
  diffs: DocDiffEntry[]
  actions: DocsFileActions
  previousVersionLabel: string
  currentVersionLabel: string
}) {
  const [viewMode, setViewMode] = useState<ChangesViewMode>('flat')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const changed = useMemo(
    () => diffs.filter((d) => d.kind !== 'unchanged'),
    [diffs],
  )

  const changedFiles = useMemo(
    () =>
      changed
        .map((d) => d.current ?? d.previous)
        .filter((f): f is KnowledgeDocFile => Boolean(f)),
    [changed],
  )

  const entryByPath = useMemo(() => {
    const m = new Map<string, DocDiffEntry>()
    for (const d of changed) {
      m.set(normalizePath(d.path).toLowerCase(), d)
    }
    return m
  }, [changed])

  const tree = useMemo(
    () => buildKnowledgeDocTree(changedFiles),
    [changedFiles],
  )

  const toggleFolder = (path: string) => {
    setExpanded((prev) => ({
      ...prev,
      [path]: prev[path] === false ? true : false,
    }))
  }

  if (!changed.length) {
    return (
      <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted">
        نسبت به نسخهٔ قبلی تغییری ثبت نشده است.
      </p>
    )
  }

  const rootFolders = tree.children.filter(
    (c): c is DocTreeFolder => c.kind === 'folder',
  )
  const rootFiles = tree.children.filter((c) => c.kind === 'file')

  return (
    <div className="space-y-3">
      <div
        className="inline-flex flex-wrap gap-1 rounded-lg border border-border p-0.5"
        role="group"
        aria-label="حالت نمایش تغییرات"
      >
        <Button
          type="button"
          size="sm"
          variant={viewMode === 'flat' ? 'primary' : 'ghost'}
          onClick={() => setViewMode('flat')}
        >
          نمایش تغییرات
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === 'tree' ? 'primary' : 'ghost'}
          onClick={() => setViewMode('tree')}
        >
          نمایش بر اساس ساختار درختی
        </Button>
      </div>

      {viewMode === 'flat' ? (
        <ul className="overflow-hidden rounded-lg border border-border">
          {changed.map((d) => (
            <ChangesDiffFileRow
              key={`${d.kind}:${d.path}`}
              entry={d}
              depth={0}
              showPath
              actions={actions}
              previousVersionLabel={previousVersionLabel}
              currentVersionLabel={currentVersionLabel}
            />
          ))}
        </ul>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {rootFolders.map((folder) => (
            <ChangesDiffFolderNode
              key={`d:${folder.path}`}
              folder={folder}
              depth={0}
              expanded={expanded}
              onToggle={toggleFolder}
              entryByPath={entryByPath}
              actions={actions}
              previousVersionLabel={previousVersionLabel}
              currentVersionLabel={currentVersionLabel}
            />
          ))}
          {rootFiles.map((node) => {
            if (node.kind !== 'file') return null
            const entry = entryByPath.get(
              normalizePath(node.file.path).toLowerCase(),
            )
            if (!entry) return null
            return (
              <ChangesDiffFileRow
                key={node.file.id}
                entry={entry}
                depth={0}
                actions={actions}
                previousVersionLabel={previousVersionLabel}
                currentVersionLabel={currentVersionLabel}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function VersionKnowledgeManagePage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user, activeTenantId, activeOrganizationId } = useAuth()
  const {
    ownedSoftwares,
    versions,
    databases,
    getVersionKnowledge,
    upsertVersionKnowledge,
    upsertVersionKnowledges,
    confirmVersionKnowledge,
  } = useDomain()

  const mySoftwares = useMemo(
    () => (user ? ownedSoftwares(user.id) : []),
    [ownedSoftwares, user],
  )
  const mySoftwareIds = useMemo(
    () => new Set(mySoftwares.map((s) => s.id)),
    [mySoftwares],
  )

  const version = versions.find((v) => v.id === id)
  const forbidden =
    Boolean(version) && !mySoftwareIds.has(version!.softwareId)
  const missing = Boolean(id) && !version

  const orderedVersionIds = useMemo(() => {
    if (!version) return []
    return orderedVersionIdsForSoftware(versions, version.softwareId)
  }, [versions, version])

  const inScopeDatabases = useMemo(() => {
    if (!version) return []
    return databases.filter(
      (d) =>
        d.softwareId === version.softwareId &&
        isDatabaseInVersion(d, version.id, orderedVersionIds),
    )
  }, [databases, version, orderedVersionIds])

  const stored = useMemo(
    () => (id ? getVersionKnowledge(id) : emptyVersionKnowledge('')),
    [getVersionKnowledge, id],
  )

  const [description, setDescription] = useState(stored.description)
  const [analysis, setAnalysis] = useState(stored.analysis)
  const [databaseDocs, setDatabaseDocs] = useState<DatabaseVersionDocs[]>(
    stored.databaseDocs,
  )
  const [confirmed, setConfirmed] = useState(stored.confirmed)
  const [confirmedAt, setConfirmedAt] = useState(stored.confirmedAt)
  const [baseline, setBaseline] = useState(() => ({
    description: stored.description,
    analysis: stored.analysis,
    databaseDocs: stored.databaseDocs,
  }))
  const [mainTab, setMainTab] = useState('knowledge')
  const [activeDbId, setActiveDbId] = useState<string>('')
  const [showChangesOnly, setShowChangesOnly] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploadingDbId, setUploadingDbId] = useState<string | null>(null)
  const [serverSnapshot, setServerSnapshot] = useState<SnapshotDto | null>(null)
  const [ingestionJob, setIngestionJob] = useState<KnowledgeJobDto | null>(null)
  /** فقط با بارگذاری مجدد ZIP ریست می‌شود تا درخت/فیلتر از نو ساخته شود */
  const [docsTreeEpoch, setDocsTreeEpoch] = useState<Record<string, number>>({})
  const [propagateByDb, setPropagateByDb] = useState<
    Record<string, PropagateOpts>
  >({})

  const [editFile, setEditFile] = useState<{
    databaseId: string
    file: KnowledgeDocFile
  } | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editBaseline, setEditBaseline] = useState('')
  const [editPropagate, setEditPropagate] = useState<PropagateOpts>(
    defaultPropagateOpts,
  )

  const zipInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [replaceTarget, setReplaceTarget] = useState<{
    databaseId: string
    file: KnowledgeDocFile
  } | null>(null)
  const [replacePropagate, setReplacePropagate] = useState<PropagateOpts>(
    defaultPropagateOpts,
  )
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(
    null,
  )

  /** دیتابیس‌هایی که در این نسخه مستند محلی دارند (= تغییر نسبت به ارث) */
  const selectedDatabaseIds = useMemo(
    () => databaseDocs.map((d) => d.databaseId),
    [databaseDocs],
  )

  useEffect(() => {
    if (!inScopeDatabases.length) {
      setActiveDbId('')
      return
    }
    const fromQuery = searchParams.get('db')
    setActiveDbId((prev) => {
      if (prev && inScopeDatabases.some((d) => d.id === prev)) return prev
      if (fromQuery && inScopeDatabases.some((d) => d.id === fromQuery)) {
        return fromQuery
      }
      return inScopeDatabases[0]?.id ?? ''
    })
  }, [inScopeDatabases, searchParams])

  useEffect(() => {
    setShowChangesOnly(false)
  }, [activeDbId])

  useEffect(() => {
    if (!activeTenantId || !activeOrganizationId || !version || !id) return
    const scope = { tenantId: activeTenantId, organizationId: activeOrganizationId, softwareId: version.softwareId, versionId: id }
    void knowledgeApi.latest(scope).then(async snapshot => {
      setServerSnapshot(snapshot)
      if (!snapshot) return
      const page = await knowledgeApi.files(scope, snapshot.id)
      if (!page.items.length) return
      const serverFiles: KnowledgeDocFile[] = page.items.map(item => ({ id: item.identityId, path: item.path, name: item.path.split('/').at(-1) ?? item.path, sizeLabel: `${Math.max(1, Math.ceil(item.sizeBytes / 1024)).toLocaleString('fa-IR')} KB`, updatedAt: new Date(item.createdAtUtc).toLocaleDateString('fa-IR'), encoding: item.mediaType.startsWith('text/') || item.mediaType.includes('json') || item.mediaType.includes('sql') ? 'text' : 'base64', content: '', active: item.isActive, contentHash: item.contentHash }))
      const databaseId = inScopeDatabases[0]?.id
      if (databaseId) setDocsFor(databaseId, serverFiles)
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'دریافت دانش نسخه ناموفق بود.'))
  }, [activeTenantId, activeOrganizationId, version, id, inScopeDatabases])

  useEffect(() => {
    if (!ingestionJob || ['Completed', 'Failed', 'Cancelled'].includes(ingestionJob.state) || !activeTenantId || !activeOrganizationId || !version || !id) return
    const scope = { tenantId: activeTenantId, organizationId: activeOrganizationId, softwareId: version.softwareId, versionId: id }
    const timer = window.setInterval(() => { void knowledgeApi.job(scope, ingestionJob.jobId).then(setIngestionJob).catch(() => undefined) }, 2000)
    return () => window.clearInterval(timer)
  }, [ingestionJob, activeTenantId, activeOrganizationId, version, id])

  const dirty =
    !forbidden &&
    !missing &&
    isFormDirty(
      { description, analysis, databaseDocs },
      baseline,
    )
  const { confirmAndLeave } = useUnsavedChangesGuard(dirty)

  const editDirty = Boolean(editFile) && editContent !== editBaseline

  if (missing) {
    return <Navigate to="/app/versions" replace />
  }
  if (forbidden) {
    return <Navigate to="/app/versions" replace />
  }
  if (!version || !id) {
    return <Navigate to="/app/versions" replace />
  }

  const docsFor = (databaseId: string) =>
    databaseDocs.find((d) => d.databaseId === databaseId)

  const inheritedFilesFor = (databaseId: string) => {
    const local = docsFor(databaseId)
    // وجود رکورد محلی (حتی با فایل خالی) یعنی دیگر ارثی نیست
    if (local) return null
    return findNearestPreviousDatabaseFiles(
      orderedVersionIds,
      id,
      databaseId,
      getVersionKnowledge,
    )
  }

  const dbDocStatus = (
    databaseId: string,
  ): 'local' | 'inherited' | 'empty' => {
    const local = docsFor(databaseId)
    if (local) return 'local'
    const inherited = inheritedFilesFor(databaseId)
    if (inherited?.some((f) => f.active)) return 'inherited'
    return 'empty'
  }

  const setDocsFor = (databaseId: string, files: KnowledgeDocFile[]) => {
    const updatedAt = faNow()
    setDatabaseDocs((prev) => {
      const exists = prev.some((d) => d.databaseId === databaseId)
      if (exists) {
        return prev.map((d) =>
          d.databaseId === databaseId ? { ...d, files, updatedAt } : d,
        )
      }
      return [{ databaseId, files, updatedAt }, ...prev]
    })
  }

  /**
   * اگر مستند محلی نباشد، کپی از نسخهٔ قبلی می‌سازد تا ویرایش/جایگزینی/حذف ممکن شود.
   * فایل‌های برگشتی را برای mutate هم‌زمان با setState استفاده کنید.
   */
  const ensureLocalDocs = (databaseId: string): KnowledgeDocFile[] => {
    const local = docsFor(databaseId)
    if (local) return local.files.slice()
    const inherited = findNearestPreviousDatabaseFiles(
      orderedVersionIds,
      id,
      databaseId,
      getVersionKnowledge,
    )
    const files = inherited
      ? sortFiles(inherited.map((f) => withContentHash({ ...f })))
      : []
    setDocsFor(databaseId, files)
    setDocsTreeEpoch((prev) => ({
      ...prev,
      [databaseId]: (prev[databaseId] ?? 0) + 1,
    }))
    return files
  }

  const clearLocalDocs = (databaseId: string) => {
    setDatabaseDocs((prev) => prev.filter((d) => d.databaseId !== databaseId))
    setDocsTreeEpoch((prev) => {
      const next = { ...prev }
      delete next[databaseId]
      return next
    })
    setMessage('مستندات محلی این نسخه حذف شد؛ از نسخهٔ قبلی ارث می‌برد.')
  }

  const getPropagateOpts = (databaseId: string): PropagateOpts =>
    propagateByDb[databaseId] ?? defaultPropagateOpts()

  const setPropagateOpts = (databaseId: string, next: PropagateOpts) => {
    setPropagateByDb((prev) => ({ ...prev, [databaseId]: next }))
  }

  const applyPropagation = (
    databaseId: string,
    changes: Array<{
      updatedFile: KnowledgeDocFile
      baseline: { encoding: KnowledgeDocFile['encoding']; content: string } | null
    }>,
    opts: PropagateOpts,
  ): string => {
    if (!opts.backward && !opts.forward) return ''
    const { records, touchedVersionCount } = propagateFileChanges({
      orderedVersionIds,
      currentVersionId: id,
      databaseId,
      changes,
      propagateBackward: opts.backward,
      propagateForward: opts.forward,
      getKnowledge: getVersionKnowledge,
    })
    if (!records.length) {
      return ' انتشار به نسخهٔ دیگری لازم نبود (زنجیره قطع یا بدون اشتراک هویت).'
    }
    const result = upsertVersionKnowledges(records)
    if (!result.ok) {
      setError(result.message)
      return ''
    }
    return ` تغییر روی ${touchedVersionCount.toLocaleString('fa-IR')} نسخهٔ دیگر نیز اعمال شد.`
  }

  const onZipUpload = async (databaseId: string, file: File | null) => {
    if (!file) return
    setUploadingDbId(databaseId)
    setError('')
    setMessage('')
    try {
      if (!activeTenantId || !activeOrganizationId) {
        throw new Error('محدوده فعال سازمانی برای بارگذاری مشخص نیست.')
      }
      const scope = { tenantId: activeTenantId, organizationId: activeOrganizationId, softwareId: version.softwareId, versionId: id }
      const draft = serverSnapshot ?? await knowledgeApi.createDraft(scope)
      const uploaded = await knowledgeApi.upload(scope, draft.id, [file])
      setServerSnapshot(uploaded.snapshot)
      const serverFiles: KnowledgeDocFile[] = uploaded.files.map(item => ({
        id: item.identityId,
        path: item.path,
        name: item.path.split('/').at(-1) ?? item.path,
        sizeLabel: `${Math.max(1, Math.ceil(item.sizeBytes / 1024)).toLocaleString('fa-IR')} KB`,
        updatedAt: new Date(item.createdAtUtc).toLocaleDateString('fa-IR'),
        encoding: item.mediaType.startsWith('text/') || item.mediaType.includes('json') || item.mediaType.includes('sql') ? 'text' : 'base64',
        content: '',
        active: item.isActive,
        contentHash: item.contentHash,
      }))
      setDocsFor(databaseId, sortFiles(serverFiles))
      setDocsTreeEpoch((prev) => ({
        ...prev,
        [databaseId]: (prev[databaseId] ?? 0) + 1,
      }))
      setMessage(`${serverFiles.length.toLocaleString('fa-IR')} فایل با hash و metadata در سرور ثبت شد؛ محتوای خام در مرورگر نگهداری نشد.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خواندن فایل ZIP با خطا مواجه شد.')
    } finally {
      setUploadingDbId(null)
    }
  }

  const knowledgeLookingUpLocal = (
    versionId: string,
  ): VersionKnowledgeRecord => {
    const base = getVersionKnowledge(versionId)
    if (versionId !== id) return base
    return {
      ...base,
      databaseDocs,
      description,
      analysis,
      selectedDatabaseIds,
      confirmed,
      confirmedAt,
    }
  }

  const toggleFileActive = (databaseId: string, fileId: string) => {
    const reference = findFileIdentityReferenceVersion(
      orderedVersionIds,
      fileId,
      databaseId,
      knowledgeLookingUpLocal,
    )
    // فقط روی نسخهٔ مرجع هویت قابل تغییر است
    if (!reference || reference.versionId !== id) return

    const files = ensureLocalDocs(databaseId)
    const target = files.find((f) => f.id === fileId)
    if (!target) return

    const nextActive = !target.active
    const updatedAt = faNow()
    setDocsFor(
      databaseId,
      files.map((f) =>
        f.id === fileId ? { ...f, active: nextActive, updatedAt } : f,
      ),
    )

    const otherRecords = applyFileActiveAcrossVersions({
      orderedVersionIds,
      databaseId,
      fileId,
      active: nextActive,
      updatedAt,
      getKnowledge: getVersionKnowledge,
      skipVersionId: id,
    })
    if (otherRecords.length) {
      const result = upsertVersionKnowledges(otherRecords)
      if (!result.ok) {
        setError(result.message)
        setMessage('')
      }
    }
  }

  const resolveActiveControl = (
    databaseId: string,
    fileId: string,
  ): FileActiveControl => {
    const reference = findFileIdentityReferenceVersion(
      orderedVersionIds,
      fileId,
      databaseId,
      knowledgeLookingUpLocal,
    )
    if (!reference || reference.versionId === id) {
      return { kind: 'toggle' }
    }
    return {
      kind: 'openReference',
      href: `/app/versions/${reference.versionId}/knowledge?db=${encodeURIComponent(databaseId)}`,
    }
  }

  const openEdit = (databaseId: string, file: KnowledgeDocFile) => {
    if (file.encoding !== 'text') return
    ensureLocalDocs(databaseId)
    setEditFile({ databaseId, file })
    setEditContent(file.content)
    setEditBaseline(file.content)
    setEditPropagate(getPropagateOpts(databaseId))
  }

  const saveEdit = () => {
    if (!editFile) return
    const files = ensureLocalDocs(editFile.databaseId)
    const baseline = {
      encoding: editFile.file.encoding as KnowledgeDocFile['encoding'],
      content: editBaseline,
    }
    const previous = findNearestPreviousDatabaseFiles(
      orderedVersionIds,
      id,
      editFile.databaseId,
      getVersionKnowledge,
    )
    const prevAtPath = previous?.find(
      (f) =>
        normalizePath(f.path).toLowerCase() ===
        normalizePath(editFile.file.path).toLowerCase(),
    )
    const draft = withContentHash({
      ...editFile.file,
      content: editContent,
      sizeLabel: `${new TextEncoder().encode(editContent).length} B`,
      updatedAt: faNow(),
    })
    let nextId = editFile.file.id
    if (prevAtPath && filesContentEqual(prevAtPath, draft)) {
      nextId = prevAtPath.id
    } else if (!filesContentEqual(editFile.file, draft)) {
      nextId = `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const updated = withContentHash({
      ...draft,
      id: nextId,
      contentHash: computeContentHash(draft.encoding, draft.content),
    })
    const nextFiles = files.map((f) =>
      f.id === editFile.file.id ? updated : f,
    )
    setDocsFor(editFile.databaseId, nextFiles)

    let propagateNote = ''
    if (editContent !== editBaseline) {
      propagateNote = applyPropagation(
        editFile.databaseId,
        [{ updatedFile: updated, baseline }],
        editPropagate,
      )
    }

    setEditFile(null)
    setMessage(
      nextId !== editFile.file.id && editContent !== editBaseline
        ? `محتوای فایل ذخیره شد (شناسه جدید برای تاریخچه).${propagateNote}`
        : `محتوای فایل ذخیره شد (پیش‌نویس محلی).${propagateNote}`,
    )
  }

  const triggerReplace = (databaseId: string, file: KnowledgeDocFile) => {
    ensureLocalDocs(databaseId)
    setReplaceTarget({ databaseId, file })
    setReplacePropagate(getPropagateOpts(databaseId))
    setPendingReplaceFile(null)
    replaceInputRef.current?.click()
  }

  const onReplaceFilePicked = (picked: File | null) => {
    if (!picked || !replaceTarget) {
      setReplaceTarget(null)
      return
    }
    setPendingReplaceFile(picked)
  }

  const cancelReplace = () => {
    setReplaceTarget(null)
    setPendingReplaceFile(null)
    setReplacePropagate(defaultPropagateOpts())
  }

  const confirmReplace = async () => {
    if (!pendingReplaceFile || !replaceTarget) return
    const { databaseId, file } = replaceTarget
    const picked = pendingReplaceFile
    setError('')
    setMessage('')
    try {
      const files = ensureLocalDocs(databaseId)

      const baseline = {
        encoding: file.encoding,
        content: file.content,
      }

      // جایگزینی درجا: path و name موجود حفظ می‌شود؛ محتوای متفاوت → شناسه جدید
      // encoding از فایل انتخاب‌شده می‌آید (متنی یا باینری)
      const next = await readLocalFileAsDoc(
        picked,
        file.path,
        files,
        file.id,
      )
      const previous = findNearestPreviousDatabaseFiles(
        orderedVersionIds,
        id,
        databaseId,
        getVersionKnowledge,
      )
      const prevAtPath = previous?.find(
        (f) =>
          normalizePath(f.path).toLowerCase() ===
          normalizePath(file.path).toLowerCase(),
      )
      const draft = withContentHash({
        ...next,
        path: file.path,
        name: file.name,
        active: file.active,
      })
      let nextId = file.id
      if (prevAtPath && filesContentEqual(prevAtPath, draft)) {
        nextId = prevAtPath.id
      } else if (!filesContentEqual(file, draft)) {
        nextId = `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }
      const updated = withContentHash({
        ...draft,
        id: nextId,
        contentHash: computeContentHash(draft.encoding, draft.content),
      })
      setDocsFor(
        databaseId,
        files.map((f) => (f.id === file.id ? updated : f)),
      )

      const propagateNote = applyPropagation(
        databaseId,
        [{ updatedFile: updated, baseline }],
        replacePropagate,
      )

      setMessage(
        `فایل «${file.name}» جایگزین شد.${nextId !== file.id ? ' (شناسه جدید)' : ''}${propagateNote}`,
      )
      cancelReplace()
    } catch (err) {
      if (err instanceof KnowledgePathError) {
        setError(err.message)
        return
      }
      setError('جایگزینی فایل ناموفق بود.')
    }
  }

  const deleteDocFile = async (databaseId: string, file: KnowledgeDocFile) => {
    if (!(await confirmDelete(file.name))) return
    const files = ensureLocalDocs(databaseId)
    setDocsFor(
      databaseId,
      files.filter((f) => f.id !== file.id),
    )
    setMessage(`فایل «${file.name}» حذف شد.`)
  }

  const buildRecord = (): VersionKnowledgeRecord => ({
    versionId: id,
    description,
    analysis,
    selectedDatabaseIds,
    databaseDocs,
    confirmed,
    confirmedAt,
  })

  const saveDraft = () => {
    setError('')
    const result = upsertVersionKnowledge(buildRecord())
    if (!result.ok) {
      setError(result.message)
      return
    }
    setBaseline({
      description,
      analysis,
      databaseDocs,
    })
    setMessage('پیش‌نویس دانش نسخه ذخیره شد.')
  }

  const startServerIngestion = async () => {
    if (!serverSnapshot || !activeTenantId || !activeOrganizationId) {
      setError('ابتدا فایل دانش را روی سرور بارگذاری کنید.')
      return
    }
    try {
      const scope = { tenantId: activeTenantId, organizationId: activeOrganizationId, softwareId: version.softwareId, versionId: id }
      const job = await knowledgeApi.start(scope, serverSnapshot)
      setIngestionJob(job)
      setMessage('پردازش دانش در صف Worker قرار گرفت.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'شروع پردازش ناموفق بود.')
    }
  }

  const finalConfirm = () => {
    setError('')
    const result = confirmVersionKnowledge(buildRecord())
    if (!result.ok) {
      setError(result.message)
      setMessage('')
      return
    }
    setConfirmed(true)
    setConfirmedAt((prev) => prev ?? faNow())
    setBaseline({
      description,
      analysis,
      databaseDocs,
    })
    setMessage('تایید نهایی دانش نسخه با موفقیت انجام شد.')
  }

  const activeDb = inScopeDatabases.find((d) => d.id === activeDbId)
  const activeLocalDocs = activeDb ? docsFor(activeDb.id) : undefined
  const activeLocalFiles = activeLocalDocs
    ? sortFiles(activeLocalDocs.files)
    : []
  const activeInherited = activeDb ? inheritedFilesFor(activeDb.id) : null
  const activeStatus = activeDb ? dbDocStatus(activeDb.id) : 'empty'
  // وجود رکورد محلی (حتی خالی) اولویت دارد تا حذف‌ها به ارث برنگردند
  const displayFiles = activeLocalDocs
    ? activeLocalFiles
    : activeInherited
      ? sortFiles(activeInherited)
      : []
  // روی ارثی هم اکشن‌ها فعال‌اند؛ اولین ویرایش/جایگزینی/حذف مستند محلی می‌سازد
  const displayReadOnly = false

  const previousSourceForActive = activeDb
    ? findNearestPreviousDatabaseSource(
        orderedVersionIds,
        id,
        activeDb.id,
        getVersionKnowledge,
      )
    : null
  const previousForActive = previousSourceForActive?.files ?? null
  const previousVersionLabel = previousSourceForActive
    ? (versions.find((v) => v.id === previousSourceForActive.versionId)
        ?.version ?? previousSourceForActive.versionId)
    : ''
  const currentVersionLabel = version.version
  const activeDiffs =
    activeStatus === 'local'
      ? diffKnowledgeDocs(activeLocalFiles, previousForActive)
      : []
  const activeDiffByPath = docDiffKindByPath(activeDiffs)
  const changeCount = activeDiffs.filter((d) => d.kind !== 'unchanged').length

  return (
    <div>
      <PageHeader
        title="مدیریت دانش نسخه"
        description={`${version.softwareName} — نسخه ${version.version}`}
        actions={
          <Button
            variant="outline"
            onClick={() => void confirmAndLeave('/app/versions')}
          >
            بازگشت
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-input/30 p-3 text-sm">
        <span className="text-muted">چرخه پردازش سرور:</span>
        <Badge variant={ingestionJob?.state === 'Completed' ? 'success' : ingestionJob?.state === 'Failed' ? 'danger' : 'neutral'}>
          {ingestionJob ? `${ingestionJob.state} — ٪${ingestionJob.progress.toLocaleString('fa-IR')}` : serverSnapshot ? serverSnapshot.state : 'بدون Snapshot سرور'}
        </Badge>
        <Button size="sm" variant="outline" disabled={!serverSnapshot || Boolean(ingestionJob && !['Completed', 'Failed', 'Cancelled'].includes(ingestionJob.state))} onClick={() => void startServerIngestion()}>
          شروع پردازش Worker
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">وضعیت دانش:</span>
        <Badge
          variant={
            version.knowledgeStatus === 'complete'
              ? 'success'
              : version.knowledgeStatus === 'partial'
                ? 'warning'
                : 'neutral'
          }
        >
          {version.knowledgeStatus === 'complete'
            ? 'کامل'
            : version.knowledgeStatus === 'partial'
              ? 'ناقص'
              : 'خالی'}
        </Badge>
        {confirmed ? (
          <Badge variant="success">
            تایید نهایی{confirmedAt ? ` — ${confirmedAt}` : ''}
          </Badge>
        ) : (
          <Badge variant="neutral">هنوز تایید نهایی نشده</Badge>
        )}
      </div>

      <Tabs
        activeId={mainTab}
        onChange={setMainTab}
        tabs={[
          {
            id: 'knowledge',
            label: 'دانش نسخه',
            content: (
              <div className="max-w-3xl space-y-4 rounded-xl border border-border bg-panel p-5">
                <Textarea
                  label="توضیحات نسخه"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  hint="شرح تغییرات و ویژگی‌های این نسخه"
                />
                <Textarea
                  label="تحلیل دانش"
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  hint="تحلیل ساختاری / دامنه برای پاسخ‌گویی بر اساس این نسخه"
                />
              </div>
            ),
          },
          {
            id: 'docs',
            label: 'مستندات دیتابیس',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  بدون بارگذاری ZIP برای یک دیتابیس، مستندات نسخهٔ قبلی همان دیتابیس
                  به‌صورت خودکار اعمال می‌شود. فقط وقتی تغییری دارید ZIP بارگذاری کنید.
                </p>

                {!inScopeDatabases.length ? (
                  <p className="rounded-xl border border-border bg-panel p-5 text-sm text-muted">
                    دیتابیسی در محدودهٔ این نسخه تعریف نشده است.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
                    <aside className="rounded-xl border border-border bg-panel p-2">
                      <p className="mb-2 px-2 text-xs font-medium text-muted">
                        دیتابیس‌های این نسخه
                      </p>
                      <ul className="space-y-1">
                        {inScopeDatabases.map((db) => {
                          const status = dbDocStatus(db.id)
                          const selected = db.id === activeDbId
                          return (
                            <li key={db.id}>
                              <button
                                type="button"
                                onClick={() => setActiveDbId(db.id)}
                                className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-start text-sm transition ${
                                  selected
                                    ? 'bg-primary-soft text-heading'
                                    : 'hover:bg-input/60 text-heading'
                                }`}
                              >
                                <span className="font-medium">{db.name}</span>
                                <span className="text-xs text-muted">
                                  {db.code}
                                </span>
                                <Badge
                                  variant={
                                    status === 'local'
                                      ? 'success'
                                      : status === 'inherited'
                                        ? 'info'
                                        : 'neutral'
                                  }
                                >
                                  {status === 'local'
                                    ? 'مستند این نسخه'
                                    : status === 'inherited'
                                      ? 'از نسخه قبل'
                                      : 'بدون مستند'}
                                </Badge>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </aside>

                    <div className="rounded-xl border border-border bg-panel p-5 space-y-3">
                      {!activeDb ? (
                        <p className="text-sm text-muted">
                          یک دیتابیس را از فهرست انتخاب کنید.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-medium text-heading">
                                مستندات — {activeDb.name}
                              </h3>
                              <p className="text-xs text-muted">
                                کد: {activeDb.code}
                                {activeLocalDocs?.updatedAt
                                  ? ` — به‌روزرسانی ${activeLocalDocs.updatedAt}`
                                  : ''}
                                {displayFiles.length
                                  ? ` — ${displayFiles.length.toLocaleString('fa-IR')} فایل`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {activeStatus === 'local' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => clearLocalDocs(activeDb.id)}
                                >
                                  بازگشت به نسخه قبل
                                </Button>
                              ) : null}
                              <input
                                ref={(el) => {
                                  zipInputRefs.current[activeDb.id] = el
                                }}
                                type="file"
                                accept=".zip,application/zip"
                                className="hidden"
                                onChange={(e) => {
                                  void onZipUpload(
                                    activeDb.id,
                                    e.target.files?.[0] ?? null,
                                  )
                                  e.target.value = ''
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={uploadingDbId === activeDb.id}
                                onClick={() =>
                                  zipInputRefs.current[activeDb.id]?.click()
                                }
                              >
                                <Upload className="size-3.5" />
                                {activeStatus === 'local'
                                  ? 'بارگذاری مجدد ZIP'
                                  : 'بارگذاری ZIP تغییرات'}
                              </Button>
                            </div>
                          </div>

                          {activeStatus === 'inherited' ? (
                            <p className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm text-muted">
                              در حال نمایش مستندات ارثی از نسخهٔ قبلی. با ویرایش،
                              جایگزینی یا حذف یک فایل، کپی محلی برای این نسخه ساخته
                              می‌شود؛ یا می‌توانید ZIP بارگذاری کنید.
                            </p>
                          ) : null}

                          {activeStatus === 'local' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant={showChangesOnly ? 'primary' : 'outline'}
                                onClick={() => setShowChangesOnly((v) => !v)}
                              >
                                تغییرات نسبت به نسخه قبلی
                                {changeCount
                                  ? ` (${changeCount.toLocaleString('fa-IR')})`
                                  : ''}
                              </Button>
                              <p className="text-xs text-muted">
                                جدید / تغییر / حذف — در درخت عادی هم رنگی نمایش داده
                                می‌شوند
                              </p>
                            </div>
                          ) : null}

                          {activeStatus === 'local' ? (
                            <PropagateCheckboxes
                              value={getPropagateOpts(activeDb.id)}
                              onChange={(next) =>
                                setPropagateOpts(activeDb.id, next)
                              }
                            />
                          ) : null}

                          {!displayFiles.length && !showChangesOnly ? (
                            <p className="text-sm text-muted">
                              هنوز مستندی برای این دیتابیس وجود ندارد. یک ZIP با
                              ساختار فولدر بارگذاری کنید. فایل غایب در ZIP نسبت به
                              نسخهٔ قبل به‌معنی حذف است.
                            </p>
                          ) : showChangesOnly && activeStatus === 'local' ? (
                            <ChangesVsPreviousPanel
                              diffs={activeDiffs}
                              previousVersionLabel={previousVersionLabel}
                              currentVersionLabel={currentVersionLabel}
                              actions={{
                                onEdit: (file) => openEdit(activeDb.id, file),
                                onReplace: (file) =>
                                  triggerReplace(activeDb.id, file),
                                onDelete: (file) =>
                                  void deleteDocFile(activeDb.id, file),
                                onToggleActive: (fileId) =>
                                  toggleFileActive(activeDb.id, fileId),
                                resolveActiveControl: (fileId) =>
                                  resolveActiveControl(activeDb.id, fileId),
                              }}
                            />
                          ) : (
                            <DatabaseDocsTree
                              key={`${activeDb.id}:${docsTreeEpoch[activeDb.id] ?? 0}:${displayReadOnly ? 'ro' : 'rw'}`}
                              files={displayFiles}
                              readOnly={displayReadOnly}
                              diffByPath={
                                activeStatus === 'local'
                                  ? activeDiffByPath
                                  : undefined
                              }
                              actions={{
                                onEdit: (file) => openEdit(activeDb.id, file),
                                onReplace: (file) =>
                                  triggerReplace(activeDb.id, file),
                                onDelete: (file) =>
                                  void deleteDocFile(activeDb.id, file),
                                onToggleActive: (fileId) =>
                                  toggleFileActive(activeDb.id, fileId),
                                resolveActiveControl: (fileId) =>
                                  resolveActiveControl(activeDb.id, fileId),
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}
      {message ? (
        <p className="mt-4 text-sm text-emerald-600">{message}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void confirmAndLeave('/app/versions')}
        >
          انصراف
        </Button>
        <Button type="button" variant="outline" onClick={saveDraft}>
          ذخیره پیش‌نویس
        </Button>
        <Button type="button" onClick={finalConfirm}>
          تایید نهایی
        </Button>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          onReplaceFilePicked(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      <Dialog
        open={Boolean(editFile)}
        title={editFile ? `ویرایش ${editFile.file.name}` : 'ویرایش فایل'}
        form
        dirty={editDirty}
        panelClassName="max-w-3xl"
        onClose={() => setEditFile(null)}
        footer={(api) => (
          <>
            <Button variant="outline" onClick={api.requestClose}>
              انصراف
            </Button>
            <Button onClick={saveEdit}>اعمال در پیش‌نویس</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-heading">محتوا</span>
              <CopyButton text={editContent} title="کپی محتوا" />
            </div>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-64 font-mono text-xs"
            />
          </div>
          <PropagateCheckboxes
            value={editPropagate}
            onChange={setEditPropagate}
          />
        </div>
      </Dialog>

      <Dialog
        open={Boolean(replaceTarget && pendingReplaceFile)}
        title={
          replaceTarget
            ? `جایگزینی «${replaceTarget.file.name}»`
            : 'جایگزینی فایل'
        }
        form
        dirty={Boolean(pendingReplaceFile)}
        onClose={cancelReplace}
        footer={(api) => (
          <>
            <Button variant="outline" onClick={api.requestClose}>
              انصراف
            </Button>
            <Button
              onClick={() => {
                void confirmReplace()
              }}
            >
              اعمال جایگزینی
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            فایل انتخاب‌شده:{' '}
            <span className="font-medium text-heading">
              {pendingReplaceFile?.name ?? '—'}
            </span>
            . به‌صورت پیش‌فرض فقط همین نسخه به‌روز می‌شود.
          </p>
          <PropagateCheckboxes
            value={replacePropagate}
            onChange={setReplacePropagate}
          />
        </div>
      </Dialog>
    </div>
  )
}
