import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { NAV_GROUPS } from '../../data/permissions'

type RequirePermissionProps = {
  permission: string
  children: ReactNode
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { hasPermission, permissions } = useAuth()

  if (!hasPermission(permission)) {
    const fallback =
      NAV_GROUPS.flatMap((g) => g.items).find(
        (item) => item.permission && permissions.includes(item.permission),
      )?.to ?? '/app'
    return <Navigate to={fallback} replace />
  }

  return children
}
