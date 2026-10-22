import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Archive,
  ArchiveRestore,
  Eye,
  FlaskConical,
  History,
  PanelRightClose,
  Play,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/CopyButton'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { Textarea } from '../../components/ui/Textarea'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import {
  createAiModelTestEntry,
  loadAiModelTests,
  persistAiModelTests,
  type AiModelTestHistoryEntry,
} from '../../lib/aiModelTestHistory'
import { confirmDelete } from '../../lib/confirm'
import { orderVersionsForSoftware } from '../../lib/databases'
import {
  mockAiQueryTest,
  type MockAiQueryTestResult,
} from '../../lib/mockAiQueryTest'
import { MyApiKeysPanel } from '../enduser/MyApiKeysPage'

type ResultTabId =
  | 'metrics'
  | 'confidence'
  | 'query'
  | 'files'
  | 'sources'

type PageTabId = 'test' | 'keys'

type HistoryFilter = 'active' | 'archived'

function formatMs(ms: number) {
  return `${ms.toLocaleString('fa-IR')} ms`
}

function formatTokens(n: number) {
  return n.toLocaleString('fa-IR')
}

function formatCreatedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString('fa-IR')
  } catch {
    return iso
  }
}

function CompactStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-border px-3 py-2 first:border-t-0">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-heading">
        {value}
      </p>
    </div>
  )
}

function CompactStatList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {children}
    </div>
  )
}

export function AiModelTestPage() {
  const { user } = useAuth()
  const {
    accessibleSoftwares,
    versions,
    getVersionKnowledge,
    apiKeys,
    defaultAiProvider,
  } = useDomain()
  const userId = user?.id ?? ''

  const platformProviderLabel =
    defaultAiProvider?.name?.trim() ||
    (defaultAiProvider ? defaultAiProvider.modelName : '') ||
    'تعریف‌نشده'

  const [softwareId, setSoftwareId] = useState(
    accessibleSoftwares[0]?.id ?? '',
  )
  const [versionId, setVersionId] = useState('')
  const [apiKeyId, setApiKeyId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<MockAiQueryTestResult | null>(null)
  const [resultTab, setResultTab] = useState<ResultTabId>('query')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  )
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('active')
  const [history, setHistory] = useState<AiModelTestHistoryEntry[]>(() =>
    loadAiModelTests(userId),
  )
  const [running, setRunning] = useState(false)
  const [historyRailOpen, setHistoryRailOpen] = useState(true)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [pageTab, setPageTab] = useState<PageTabId>('test')

  useEffect(() => {
    setHistory(loadAiModelTests(userId))
  }, [userId])

  const softwareVersions = useMemo(
    () => orderVersionsForSoftware(versions, softwareId),
    [versions, softwareId],
  )

  const effectiveVersionId =
    versionId && softwareVersions.some((v) => v.id === versionId)
      ? versionId
      : (softwareVersions[0]?.id ?? '')

  const myActiveKeys = useMemo(
    () =>
      apiKeys.filter(
        (k) =>
          k.status === 'active' &&
          k.userId === userId &&
          (!softwareId || k.softwareId === softwareId),
      ),
    [apiKeys, userId, softwareId],
  )

  const effectiveApiKeyId =
    apiKeyId && myActiveKeys.some((k) => k.id === apiKeyId)
      ? apiKeyId
      : (myActiveKeys[0]?.id ?? '')

  const selectedApiKey = myActiveKeys.find((k) => k.id === effectiveApiKeyId)

  const softwareNameById = useMemo(() => {
    const map = new Map(accessibleSoftwares.map((s) => [s.id, s.name]))
    return map
  }, [accessibleSoftwares])

  const versionLabelById = useMemo(() => {
    const map = new Map(versions.map((v) => [v.id, v.version]))
    return map
  }, [versions])

  const activeCount = useMemo(
    () => history.filter((e) => !e.archived).length,
    [history],
  )
  const archivedCount = useMemo(
    () => history.filter((e) => e.archived).length,
    [history],
  )

  const filteredHistory = useMemo(() => {
    const archived = historyFilter === 'archived'
    return history
      .filter((e) => e.archived === archived)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [history, historyFilter])

  const persistHistory = (next: AiModelTestHistoryEntry[]) => {
    setHistory(next)
    persistAiModelTests(userId, next)
  }

  const onSoftwareChange = (next: string) => {
    setSoftwareId(next)
    setVersionId('')
    setApiKeyId('')
    setResult(null)
    setSelectedHistoryId(null)
    setError('')
  }

  const openHistoryEntry = (entry: AiModelTestHistoryEntry) => {
    setSoftwareId(entry.softwareId)
    setVersionId(entry.versionId)
    setApiKeyId(entry.apiKeyId ?? '')
    setPrompt(entry.prompt)
    setResult(entry.result)
    setSelectedHistoryId(entry.id)
    setResultTab('query')
    setError('')
    setMobileHistoryOpen(false)
  }

  const onToggleArchive = (entry: AiModelTestHistoryEntry) => {
    persistHistory(
      history.map((e) =>
        e.id === entry.id ? { ...e, archived: !e.archived } : e,
      ),
    )
  }

  const onDelete = async (entry: AiModelTestHistoryEntry) => {
    const label =
      entry.prompt.trim().slice(0, 40) || formatCreatedAt(entry.createdAt)
    if (!(await confirmDelete(label))) return
    const next = history.filter((e) => e.id !== entry.id)
    persistHistory(next)
    if (selectedHistoryId === entry.id) {
      setSelectedHistoryId(null)
      setResult(null)
    }
  }

  const onRun = () => {
    setError('')
    setResult(null)
    setSelectedHistoryId(null)
    if (!softwareId || !effectiveVersionId) {
      setError('نرم‌افزار و نسخه را انتخاب کنید.')
      return
    }
    if (!effectiveApiKeyId || !selectedApiKey) {
      setError('یک API Key فعال متعلق به خودتان انتخاب کنید.')
      return
    }
    setRunning(true)
    try {
      const knowledge = getVersionKnowledge(effectiveVersionId)
      const outcome = mockAiQueryTest({
        prompt,
        softwareId,
        versionId: effectiveVersionId,
        knowledge,
      })
      if (!outcome.ok) {
        setError(outcome.message)
        return
      }
      setResult(outcome.result)
      setResultTab('query')
      if (userId) {
        const entry = createAiModelTestEntry({
          userId,
          softwareId,
          versionId: effectiveVersionId,
          prompt,
          result: outcome.result,
          apiKeyId: selectedApiKey.id,
          apiKeyMasked: selectedApiKey.keyMasked,
          platformProviderId: defaultAiProvider?.id,
          platformProviderName: defaultAiProvider?.name,
        })
        persistHistory([entry, ...history])
        setSelectedHistoryId(entry.id)
        setHistoryFilter('active')
      }
    } finally {
      setRunning(false)
    }
  }

  const historyPanel = (
    <HistoryRail
      filter={historyFilter}
      onFilterChange={setHistoryFilter}
      activeCount={activeCount}
      archivedCount={archivedCount}
      entries={filteredHistory}
      selectedId={selectedHistoryId}
      softwareNameById={softwareNameById}
      versionLabelById={versionLabelById}
      onOpen={openHistoryEntry}
      onToggleArchive={onToggleArchive}
      onDelete={onDelete}
      onCollapse={() => setHistoryRailOpen(false)}
      showCollapse
    />
  )

  const testWorkspace = (
    <>
      {/* Mobile history trigger */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMobileHistoryOpen(true)}
        >
          <History className="size-4" />
          تاریخچه
          {activeCount > 0 ? (
            <span className="text-muted">
              ({activeCount.toLocaleString('fa-IR')})
            </span>
          ) : null}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileHistoryOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-heading/40"
            aria-label="بستن تاریخچه"
            onClick={() => setMobileHistoryOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-[min(100%,20rem)] flex-col border-e border-border bg-panel-solid shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-heading">
                <History className="size-4 text-accent" />
                تاریخچه
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!px-2"
                onClick={() => setMobileHistoryOpen(false)}
                aria-label="بستن"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <HistoryRail
                filter={historyFilter}
                onFilterChange={setHistoryFilter}
                activeCount={activeCount}
                archivedCount={archivedCount}
                entries={filteredHistory}
                selectedId={selectedHistoryId}
                softwareNameById={softwareNameById}
                versionLabelById={versionLabelById}
                onOpen={openHistoryEntry}
                onToggleArchive={onToggleArchive}
                onDelete={onDelete}
                showCollapse={false}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        {/* History rail — first in DOM = start side in RTL */}
        <div className="hidden lg:block">
          {historyRailOpen ? (
            <aside className="sticky top-4 flex h-[calc(100vh-7rem)] w-72 flex-col overflow-hidden rounded-xl border border-border bg-panel">
              {historyPanel}
            </aside>
          ) : (
            <div className="sticky top-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-col !h-auto gap-1.5 !px-2.5 !py-3"
                onClick={() => setHistoryRailOpen(true)}
                title="نمایش تاریخچه"
                aria-label="نمایش تاریخچه"
              >
                <History className="size-4" />
                <span
                  className="text-[11px] leading-tight"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  تاریخچه
                </span>
              </Button>
            </div>
          )}
        </div>

        {/* Main: form + results */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Select
                label="نرم‌افزار"
                value={softwareId}
                onChange={(e) => onSoftwareChange(e.target.value)}
                options={accessibleSoftwares.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.code})`,
                }))}
              />
              <Select
                label="نسخه"
                value={effectiveVersionId}
                onChange={(e) => {
                  setVersionId(e.target.value)
                  setResult(null)
                  setSelectedHistoryId(null)
                  setError('')
                }}
                options={softwareVersions.map((v) => ({
                  value: v.id,
                  label: `${v.version} (${v.releasedAt})`,
                }))}
                disabled={!softwareVersions.length}
              />
              <Select
                label="API Key"
                value={effectiveApiKeyId}
                onChange={(e) => {
                  setApiKeyId(e.target.value)
                  setResult(null)
                  setSelectedHistoryId(null)
                  setError('')
                }}
                options={
                  myActiveKeys.length
                    ? myActiveKeys.map((k) => ({
                        value: k.id,
                        label: `${k.keyMasked} · ${k.allocatedTokens.toLocaleString('fa-IR')} توکن`,
                      }))
                    : [
                        {
                          value: '',
                          label: 'کلید فعالی ندارید — از تب API Keyها صادر کنید',
                        },
                      ]
                }
                disabled={!myActiveKeys.length}
              />
            </div>

            {!myActiveKeys.length ? (
              <p className="text-sm text-muted">
                هنوز کلید فعالی ندارید.{' '}
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
                  onClick={() => setPageTab('keys')}
                >
                  مدیریت API Key
                </button>
              </p>
            ) : null}

            <Textarea
              label="درخواست برای AI"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="مثلاً: مجموع فروش سه ماه اخیر به‌تفکیک مشتری"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={onRun}
                disabled={
                  running ||
                  !softwareId ||
                  !effectiveVersionId ||
                  !effectiveApiKeyId
                }
              >
                <Play className="size-4" />
                اجرای تست
              </Button>
              <p className="text-xs text-muted">
                خروجی mock و برای ورودی یکسان تکرارپذیر است. پس از اجرا ذخیره
                می‌شود.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>

          {result ? (
            <div className="rounded-xl border border-border bg-panel p-5">
              <Tabs
                activeId={resultTab}
                onChange={(id) => setResultTab(id as ResultTabId)}
                tabs={[
                  {
                    id: 'query',
                    label: 'کوئری پیشنهادی',
                    content: (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="size-4 text-accent" />
                            <h2 className="text-base font-semibold text-heading">
                              کوئری پیشنهادی
                            </h2>
                          </div>
                          <CopyButton text={result.query} title="کپی کوئری" />
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-border bg-surface px-3 py-3 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap">
                          {result.query}
                        </pre>
                      </div>
                    ),
                  },
                  {
                    id: 'metrics',
                    label: 'زمان و توکن',
                    content: (
                      <CompactStatList>
                        <CompactStat
                          label="زمان مطالعه فایل‌ها"
                          value={formatMs(result.timings.totalStudyMs)}
                        />
                        <CompactStat
                          label="زمان جستجو"
                          value={formatMs(result.timings.searchMs)}
                        />
                        <CompactStat
                          label="زمان ساخت کوئری"
                          value={formatMs(result.timings.queryBuildMs)}
                        />
                        <CompactStat
                          label="توکن کل"
                          value={formatTokens(result.tokens.total)}
                          hint={`مطالعه ${formatTokens(result.tokens.study)} · ساخت ${formatTokens(result.tokens.queryBuild)}`}
                        />
                      </CompactStatList>
                    ),
                  },
                  {
                    id: 'confidence',
                    label: 'اعتماد معنایی',
                    content: (
                      <CompactStatList>
                        <CompactStat
                          label="قواعد کوئری‌نویسی"
                          value={`${result.confidence.syntaxRulesPercent.toLocaleString('fa-IR')}٪`}
                          hint="همیشه کامل (syntax)"
                        />
                        <CompactStat
                          label="انتخاب جدول / فیلد"
                          value={`${result.confidence.schemaChoicePercent.toLocaleString('fa-IR')}٪`}
                          hint="اعتماد معنایی مدل"
                        />
                        <CompactStat
                          label="روش محاسبه"
                          value={`${result.confidence.calculationMethodPercent.toLocaleString('fa-IR')}٪`}
                          hint="اعتماد معنایی مدل"
                        />
                      </CompactStatList>
                    ),
                  },
                  {
                    id: 'files',
                    label: 'فایل‌های مطالعه‌شده',
                    content: (
                      <ul className="overflow-hidden rounded-lg border border-border">
                        {result.studiedFiles.map((f) => (
                          <li
                            key={f.path}
                            className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p
                                className="truncate font-medium text-heading"
                                title={f.path}
                              >
                                {f.name}
                              </p>
                              <p className="truncate text-xs text-muted">
                                {f.path}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {f.isQuerySource ? (
                                <Badge variant="success">منبع کوئری</Badge>
                              ) : null}
                              <span className="text-xs text-muted">
                                {formatMs(f.studyDurationMs)}
                              </span>
                              <span className="text-xs text-muted">
                                {formatTokens(f.tokens)} توکن
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    id: 'sources',
                    label: 'منبع مستندات',
                    content: (
                      <ul className="space-y-2">
                        {result.querySourcePaths.map((path) => (
                          <li
                            key={path}
                            className="rounded-lg border border-border px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-heading">
                              {path.split('/').pop()}
                            </p>
                            <p className="text-xs text-muted">{path}</p>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <div>
      <PageHeader
        title="تست مدل AI"
        description="شبیه‌سازی تولید کوئری بر اساس دانش نسخه با API Key خودتان — مدل طبق تنظیمات پلتفرم"
      />

      <p className="mb-4 rounded-lg border border-border bg-primary-soft/40 px-3 py-2 text-sm text-ink">
        طبق تنظیمات پلتفرم:{' '}
        <span className="font-semibold text-heading">{platformProviderLabel}</span>
        {defaultAiProvider?.modelName ? (
          <span className="text-muted">
            {' '}
            ({defaultAiProvider.modelName})
          </span>
        ) : null}
        {!defaultAiProvider ? (
          <span className="ms-1 text-muted">
            — مالک پلتفرم هنوز ارائه‌دهندهٔ پیش‌فرض تعریف نکرده است.
          </span>
        ) : null}
      </p>
      <Tabs
        activeId={pageTab}
        onChange={(id) => setPageTab(id as PageTabId)}
        tabs={[
          {
            id: 'test',
            label: 'تست مدل',
            content: testWorkspace,
          },
          {
            id: 'keys',
            label: 'API Keyها',
            content: <MyApiKeysPanel embedded />,
          },
        ]}
      />
    </div>
  )
}

function HistoryRail({
  filter,
  onFilterChange,
  activeCount,
  archivedCount,
  entries,
  selectedId,
  softwareNameById,
  versionLabelById,
  onOpen,
  onToggleArchive,
  onDelete,
  onCollapse,
  showCollapse,
}: {
  filter: HistoryFilter
  onFilterChange: (f: HistoryFilter) => void
  activeCount: number
  archivedCount: number
  entries: AiModelTestHistoryEntry[]
  selectedId: string | null
  softwareNameById: Map<string, string>
  versionLabelById: Map<string, string>
  onOpen: (entry: AiModelTestHistoryEntry) => void
  onToggleArchive: (entry: AiModelTestHistoryEntry) => void
  onDelete: (entry: AiModelTestHistoryEntry) => void
  onCollapse?: () => void
  showCollapse: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-heading">
          <History className="size-4 shrink-0 text-accent" />
          <span className="truncate">درخواست‌های قبلی</span>
        </div>
        {showCollapse && onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!px-2"
            onClick={onCollapse}
            title="جمع کردن تاریخچه"
            aria-label="جمع کردن تاریخچه"
          >
            <PanelRightClose className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="shrink-0 border-b border-border p-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-0.5">
          <button
            type="button"
            onClick={() => onFilterChange('active')}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
              filter === 'active'
                ? 'bg-panel text-accent shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            فعال ({activeCount.toLocaleString('fa-IR')})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('archived')}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
              filter === 'archived'
                ? 'bg-panel text-accent shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            آرشیو ({archivedCount.toLocaleString('fa-IR')})
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <HistoryList
          entries={entries}
          selectedId={selectedId}
          softwareNameById={softwareNameById}
          versionLabelById={versionLabelById}
          emptyLabel={
            filter === 'archived'
              ? 'آرشیوی وجود ندارد.'
              : 'هنوز تست فعالی ذخیره نشده است.'
          }
          onOpen={onOpen}
          onToggleArchive={onToggleArchive}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

function HistoryList({
  entries,
  selectedId,
  softwareNameById,
  versionLabelById,
  emptyLabel,
  onOpen,
  onToggleArchive,
  onDelete,
}: {
  entries: AiModelTestHistoryEntry[]
  selectedId: string | null
  softwareNameById: Map<string, string>
  versionLabelById: Map<string, string>
  emptyLabel: string
  onOpen: (entry: AiModelTestHistoryEntry) => void
  onToggleArchive: (entry: AiModelTestHistoryEntry) => void
  onDelete: (entry: AiModelTestHistoryEntry) => void
}) {
  if (!entries.length) {
    return <p className="px-3 py-6 text-center text-sm text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="py-1">
      {entries.map((entry) => {
        const selected = entry.id === selectedId
        const softwareName =
          softwareNameById.get(entry.softwareId) ?? entry.softwareId
        const versionLabel =
          versionLabelById.get(entry.versionId) ?? entry.versionId
        const promptPreview = entry.prompt.trim() || 'بدون متن درخواست'

        return (
          <li key={entry.id} className="group relative px-1.5">
            <div
              className={`flex items-start gap-1 rounded-lg px-2 py-2 transition ${
                selected
                  ? 'bg-primary-soft/60'
                  : 'hover:bg-primary-soft/30'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="min-w-0 flex-1 text-start"
              >
                <p
                  className="truncate text-sm font-medium text-heading"
                  title={promptPreview}
                >
                  {promptPreview}
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted">
                  {softwareName} · {versionLabel}
                  {entry.apiKeyMasked ? ` · ${entry.apiKeyMasked}` : ''}
                  {entry.platformProviderName
                    ? ` · ${entry.platformProviderName}`
                    : ''}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {formatCreatedAt(entry.createdAt)}
                </p>
              </button>

              <div
                className={`flex shrink-0 items-center gap-0.5 transition ${
                  selected
                    ? 'opacity-100'
                    : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="rounded-md p-1.5 text-muted hover:bg-panel hover:text-heading"
                  title="مشاهده"
                  aria-label="مشاهده"
                >
                  <Eye className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleArchive(entry)}
                  className="rounded-md p-1.5 text-muted hover:bg-panel hover:text-heading"
                  title={entry.archived ? 'خروج از آرشیو' : 'آرشیو'}
                  aria-label={entry.archived ? 'خروج از آرشیو' : 'آرشیو'}
                >
                  {entry.archived ? (
                    <ArchiveRestore className="size-3.5" />
                  ) : (
                    <Archive className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                  title="حذف"
                  aria-label="حذف"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
