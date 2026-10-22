import { NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { AppNavGroup } from '../../data/permissions'

type SidebarProps = {
  brand: string
  subtitle?: string
  groups: AppNavGroup[]
  collapsed?: boolean
}

export function Sidebar({ brand, subtitle, groups, collapsed = false }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.title, true])),
  )

  return (
    <aside
      className={`flex h-full flex-col border-l border-border bg-sidebar backdrop-blur-md ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div className="border-b border-border px-4 py-5">
        <p className="text-sm font-bold text-accent">{collapsed ? 'AI' : brand}</p>
        {!collapsed && subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => {
          const isOpen = openGroups[group.title] ?? true
          return (
            <div key={group.title} className="mb-3">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))
                  }
                  className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-muted hover:bg-primary-soft"
                >
                  <span>{group.title}</span>
                  <ChevronDown className={`size-3.5 transition ${isOpen ? '' : '-rotate-90'}`} />
                </button>
              ) : null}
              {(collapsed || isOpen) && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === '/app'}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                              isActive
                                ? 'bg-primary-soft font-medium text-accent'
                                : 'text-ink hover:bg-primary-soft hover:text-heading'
                            }`
                          }
                          title={item.label}
                        >
                          <Icon className="size-4 shrink-0" />
                          {!collapsed ? <span>{item.label}</span> : null}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
