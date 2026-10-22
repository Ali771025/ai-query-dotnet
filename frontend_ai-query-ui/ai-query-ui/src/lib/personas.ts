import type { Role, SystemUser, Workspace } from '../types/rbac'
import type { SoftwareMembership } from '../types/software'
import {
  END_USER_ROLE_ID,
  ORG_MEMBER_ROLE_ID,
  OWNER_ROLE_ID,
  PLATFORM_SUPPORT_ROLE_ID,
  SOFTWARE_COMPANY_ROLE_ID,
  SOFTWARE_OWNER_ROLE_ID,
  SOFTWARE_SUPPORT_ROLE_ID,
} from '../data/seed'
import { loadJson } from './storage'

const WORKSPACE_ORDER: Workspace[] = [
  'platform',
  'software_owner',
  'company',
  'support',
  'tenant',
]

export const PERSONA_LABELS: Record<Workspace, string> = {
  platform: 'مالک پلتفرم',
  software_owner: 'مالک نرم‌افزار',
  company: 'مالک شرکت نرم‌افزاری',
  support: 'پشتیبان',
  tenant: 'کاربر نهایی',
}

export function personaLabel(
  workspace: Workspace,
  user: SystemUser | null,
  roles: Role[],
): string {
  if (workspace === 'platform' && user) {
    if (
      user.roleIds.includes(PLATFORM_SUPPORT_ROLE_ID) &&
      !user.roleIds.includes(OWNER_ROLE_ID)
    ) {
      const r = roles.find((x) => x.id === PLATFORM_SUPPORT_ROLE_ID)
      return r?.name ?? 'پشتیبان پلتفرم (کیان)'
    }
    return 'مالک پلتفرم'
  }
  if (workspace === 'support' && user) {
    const custom = roles.find(
      (r) => Boolean(r.ownerUserId) && user.roleIds.includes(r.id),
    )
    if (custom) return custom.name
  }
  return PERSONA_LABELS[workspace]
}

export function loadMemberships(): SoftwareMembership[] {
  return loadJson<SoftwareMembership[]>('memberships', [])
}

/** نقش‌های مؤثر برای یک پرسونا (بدون اتحاد نقش‌های سایر سطوح) */
export function roleIdsForPersona(
  user: SystemUser,
  roles: Role[],
  persona: Workspace,
  memberships: SoftwareMembership[] = loadMemberships(),
): string[] {
  const mine = memberships.filter((m) => m.userId === user.id)
  switch (persona) {
    case 'platform': {
      const ids = user.roleIds.filter(
        (id) =>
          id === OWNER_ROLE_ID ||
          id === PLATFORM_SUPPORT_ROLE_ID ||
          roles.some(
            (r) =>
              r.id === id &&
              !r.isSystem &&
              !r.ownerUserId &&
              r.id !== SOFTWARE_OWNER_ROLE_ID,
          ),
      )
      return ids.length ? ids : [OWNER_ROLE_ID]
    }
    case 'software_owner': {
      const ids = user.roleIds.filter((id) => id === SOFTWARE_OWNER_ROLE_ID)
      if (ids.length) return ids
      if (mine.some((m) => m.kind === 'software_owner')) return [SOFTWARE_OWNER_ROLE_ID]
      return [SOFTWARE_OWNER_ROLE_ID]
    }
    case 'company': {
      const ids = user.roleIds.filter((id) => id === SOFTWARE_COMPANY_ROLE_ID)
      if (ids.length) return ids
      if (mine.some((m) => m.kind === 'company_owner')) return [SOFTWARE_COMPANY_ROLE_ID]
      return [SOFTWARE_COMPANY_ROLE_ID]
    }
    case 'support': {
      const ids = user.roleIds.filter(
        (id) =>
          id === SOFTWARE_SUPPORT_ROLE_ID ||
          roles.some((r) => r.id === id && Boolean(r.ownerUserId)),
      )
      if (ids.length) return ids
      const fromMem = mine.find((m) => m.kind === 'software_support')
      return fromMem?.roleIds?.length ? fromMem.roleIds : [SOFTWARE_SUPPORT_ROLE_ID]
    }
    case 'tenant': {
      const ids = user.roleIds.filter(
        (id) => id === END_USER_ROLE_ID || id === ORG_MEMBER_ROLE_ID,
      )
      if (ids.length) return ids
      if (mine.some((m) => m.kind === 'end_user')) return [END_USER_ROLE_ID]
      if (mine.some((m) => m.kind === 'org_member')) return [ORG_MEMBER_ROLE_ID]
      return [END_USER_ROLE_ID]
    }
  }
}

export function personasForUser(
  user: SystemUser | null,
  roles: Role[],
  memberships: SoftwareMembership[] = loadMemberships(),
): Workspace[] {
  if (!user) return []
  const set = new Set<Workspace>()
  const mine = memberships.filter((m) => m.userId === user.id)

  if (
    user.roleIds.includes(OWNER_ROLE_ID) ||
    user.roleIds.includes(PLATFORM_SUPPORT_ROLE_ID) ||
    roles.some(
      (r) =>
        !r.isSystem &&
        !r.ownerUserId &&
        user.roleIds.includes(r.id) &&
        r.id !== SOFTWARE_OWNER_ROLE_ID &&
        r.createdByUserId,
    )
  ) {
    set.add('platform')
  }

  if (
    user.roleIds.includes(SOFTWARE_OWNER_ROLE_ID) ||
    mine.some((m) => m.kind === 'software_owner')
  ) {
    set.add('software_owner')
  }

  if (
    user.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID) ||
    mine.some((m) => m.kind === 'company_owner')
  ) {
    set.add('company')
  }

  const hasCompanyCustom = roles.some(
    (r) => Boolean(r.ownerUserId) && user.roleIds.includes(r.id),
  )
  if (
    user.roleIds.includes(SOFTWARE_SUPPORT_ROLE_ID) ||
    hasCompanyCustom ||
    mine.some((m) => m.kind === 'software_support')
  ) {
    set.add('support')
  }

  if (
    user.roleIds.includes(END_USER_ROLE_ID) ||
    user.roleIds.includes(ORG_MEMBER_ROLE_ID) ||
    mine.some((m) => m.kind === 'end_user' || m.kind === 'org_member')
  ) {
    set.add('tenant')
  }

  return WORKSPACE_ORDER.filter((w) => set.has(w))
}

export function defaultPersona(personas: Workspace[]): Workspace {
  if (personas.includes('platform')) return 'platform'
  if (personas.includes('software_owner')) return 'software_owner'
  if (personas.includes('company')) return 'company'
  if (personas.includes('support')) return 'support'
  return personas[0] ?? 'tenant'
}

export function normalizeWorkspace(ws: string | undefined): Workspace | undefined {
  if (!ws) return undefined
  if (ws === 'owner') return 'platform'
  if (ws === 'manager') return 'company'
  if (ws === 'endUser') return 'tenant'
  if (
    ws === 'platform' ||
    ws === 'software_owner' ||
    ws === 'company' ||
    ws === 'support' ||
    ws === 'tenant'
  ) {
    return ws
  }
  return undefined
}

export function computePermissionsForRoleIds(
  roleIds: string[],
  roles: Role[],
): string[] {
  const set = new Set<string>()
  for (const role of roles.filter((r) => roleIds.includes(r.id))) {
    for (const p of role.permissionIds) set.add(p)
  }
  return [...set]
}
