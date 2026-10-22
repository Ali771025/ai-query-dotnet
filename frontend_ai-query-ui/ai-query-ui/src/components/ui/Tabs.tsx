import type { ReactNode } from 'react'

type TabItem = {
  id: string
  label: string
  content: ReactNode
}

type TabsProps = {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.id === active.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-muted hover:text-heading'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="pt-5">{active?.content}</div>
    </div>
  )
}
