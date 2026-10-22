/**
 * دامنهٔ «هم‌سطح» برای مدیریت API Key مالکین.
 *
 * - پلتفرم: کاربران با نقش مالک پلتفرم یا پشتیبان پلتفرم (پرسونای سطح پلتفرم)
 * - مالک نرم‌افزار: سایر مالکین نرم‌افزار روی نرم‌افزارهای قابل‌دسترسی همان خط محصول
 * - شرکت و پایین‌تر: فقط خود کاربر (بدون peer)
 */

import type { SystemUser } from '../types/rbac'
import type { Software, SoftwareMembership } from '../types/software'
import {
  OWNER_ROLE_ID,
  PLATFORM_SUPPORT_ROLE_ID,
  SOFTWARE_OWNER_ROLE_ID,
} from '../data/seed'
import type { HierarchyTier } from './hierarchy'

export function isPlatformPeerUser(u: SystemUser): boolean {
  return (
    u.roleIds.includes(OWNER_ROLE_ID) ||
    u.roleIds.includes(PLATFORM_SUPPORT_ROLE_ID)
  )
}

export function isSoftwareOwnerPeerUser(u: SystemUser): boolean {
  return u.roleIds.includes(SOFTWARE_OWNER_ROLE_ID)
}

export function apiKeyPeerUsers(input: {
  actor: SystemUser
  tier: HierarchyTier | null
  users: SystemUser[]
  memberships: SoftwareMembership[]
  accessibleSoftwares: Software[]
}): SystemUser[] {
  const { actor, tier, users, memberships, accessibleSoftwares } = input
  const active = users.filter((u) => u.status === 'active')

  if (tier === 'platform') {
    return active
      .filter(isPlatformPeerUser)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  }

  if (tier === 'software_owner') {
    const softwareIds = new Set(accessibleSoftwares.map((s) => s.id))
    const peerIds = new Set<string>([actor.id])
    for (const m of memberships) {
      if (m.kind !== 'software_owner') continue
      if (!softwareIds.has(m.softwareId)) continue
      peerIds.add(m.userId)
    }
    // مالکانی که هنوز membership ندارند ولی نقش مالک نرم‌افزار دارند و روی خط محصول هم‌پوشانی دارند
    for (const u of active) {
      if (!isSoftwareOwnerPeerUser(u)) continue
      if (u.id === actor.id) {
        peerIds.add(u.id)
        continue
      }
      const theirSoftwares = new Set(
        memberships
          .filter((m) => m.userId === u.id && m.kind === 'software_owner')
          .map((m) => m.softwareId),
      )
      if (theirSoftwares.size === 0) continue
      for (const sid of theirSoftwares) {
        if (softwareIds.has(sid)) {
          peerIds.add(u.id)
          break
        }
      }
    }
    return active
      .filter((u) => peerIds.has(u.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  }

  return active.filter((u) => u.id === actor.id)
}

export function canManageApiKeyForUser(
  actor: SystemUser,
  tier: HierarchyTier | null,
  targetUserId: string,
  peers: SystemUser[],
): boolean {
  if (targetUserId === actor.id) return true
  if (tier !== 'platform' && tier !== 'software_owner') return false
  return peers.some((u) => u.id === targetUserId)
}
