import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, Moon, PanelLeftClose, Sun, LogOut } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Button } from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { useTheme } from '../../context/ThemeContext'
import { NAV_GROUPS, WORKSPACE_MODULE_IDS, MENU_MODULES } from '../../data/permissions'
import type { Workspace } from '../../types/rbac'
import { PERSONA_LABELS, personaLabel } from '../../lib/personas'

const WORKSPACE_ORDER: Workspace[] = [
  'platform',
  'software_owner',
  'company',
  'support',
  'tenant',
]

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const {
    user,
    roles,
    permissions,
    logout,
    getRoleNames,
    activeWorkspace,
    setWorkspace,
    availableWorkspaces,
    sessionRoleIds,
    activeSoftwareId,
    setActiveSoftwareId,
  } = useAuth()
  const { ownedSoftwares, accessibleSoftwares } = useDomain()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const workspaces = useMemo(
    () => WORKSPACE_ORDER.filter((w) => availableWorkspaces.includes(w)),
    [availableWorkspaces],
  )

  const contextSoftwares = useMemo(() => {
    if (activeWorkspace === 'company' && user) return ownedSoftwares(user.id)
    if (
      activeWorkspace === 'software_owner' ||
      activeWorkspace === 'support' ||
      activeWorkspace === 'tenant'
    ) {
      return accessibleSoftwares
    }
    return []
  }, [activeWorkspace, user, ownedSoftwares, accessibleSoftwares])

  useEffect(() => {
    if (activeWorkspace === 'platform') return
    if (!contextSoftwares.length) return
    if (!activeSoftwareId || !contextSoftwares.some((s) => s.id === activeSoftwareId)) {
      setActiveSoftwareId(contextSoftwares[0]!.id)
    }
  }, [activeWorkspace, contextSoftwares, activeSoftwareId, setActiveSoftwareId])

  const allowedModuleIds = WORKSPACE_MODULE_IDS[activeWorkspace] ?? []

  const groups = useMemo(() => {
    const moduleTitles = new Set(
      MENU_MODULES.filter((m) => allowedModuleIds.includes(m.id)).map((m) => m.label),
    )
    return NAV_GROUPS.filter((g) => moduleTitles.has(g.title))
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.permission || permissions.includes(item.permission),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [permissions, allowedModuleIds])

  const roleLabel =
    personaLabel(activeWorkspace, user, roles) ||
    getRoleNames(sessionRoleIds).join('، ') ||
    PERSONA_LABELS[activeWorkspace]

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        brand="سامانه هوشمند گزارش‌ساز"
        subtitle={roleLabel || 'پنل مدیریتی'}
        groups={groups}
        collapsed={collapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-panel px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="تغییر سایدبار"
            >
              {collapsed ? <Menu className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
            {workspaces.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1">
                {workspaces.map((ws) => (
                  <Button
                    key={ws}
                    size="sm"
                    variant={activeWorkspace === ws ? 'primary' : 'outline'}
                    onClick={() => {
                      setWorkspace(ws)
                      navigate('/app')
                    }}
                  >
                    {PERSONA_LABELS[ws]}
                  </Button>
                ))}
              </div>
            ) : (
              <span className="hidden text-xs text-muted md:inline">
                {PERSONA_LABELS[activeWorkspace]}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="تغییر تم">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <span className="hidden text-muted sm:inline">{user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="size-3.5" />
              خروج
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
