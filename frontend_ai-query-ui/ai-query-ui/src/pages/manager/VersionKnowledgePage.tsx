import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { useDomain } from '../../context/DomainContext'
import { versionKnowledge } from '../../data/mock/software'

export function VersionKnowledgePage() {
  const { versions } = useDomain()
  const versionOptions = useMemo(
    () =>
      versions.map((v) => ({
        value: v.id,
        label: `${v.softwareName} — ${v.version}`,
      })),
    [versions],
  )
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '')
  const [tab, setTab] = useState('description')
  const [description, setDescription] = useState(versionKnowledge.description)
  const [analysis, setAnalysis] = useState(versionKnowledge.analysis)

  return (
    <div>
      <PageHeader
        title="ثبت دانش نسخه‌ای"
        description="هر نسخه دانش مستقل دارد و بر اساس همان نسخه پاسخ می‌دهد"
        actions={<Button>ذخیره دانش</Button>}
      />

      <div className="mb-5 max-w-sm">
        <Select
          label="نسخه"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          options={versionOptions}
        />
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <Tabs
          activeId={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'description',
              label: 'توضیحات نسخه',
              content: (
                <Textarea
                  label="توضیحات"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              ),
            },
            {
              id: 'analysis',
              label: 'تحلیل دانش برنامه',
              content: (
                <Textarea
                  label="تحلیل دانش"
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                />
              ),
            },
            {
              id: 'files',
              label: 'فایل‌های نسخه',
              content: (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">
                      جایگذاری فایل جدید بدون تغییر کل نسخه
                    </p>
                    <Button size="sm" variant="outline">
                      بارگذاری فایل
                    </Button>
                  </div>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {versionKnowledge.files.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted">
                            {f.size} — به‌روزرسانی {f.updatedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{f.type}</Badge>
                          <Button size="sm" variant="ghost">
                            مشاهده
                          </Button>
                          <Button size="sm" variant="ghost">
                            جایگزینی
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
