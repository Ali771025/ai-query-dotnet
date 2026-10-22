import type { SystemUser } from '../types/rbac'
import type { Software, SoftwareMembership } from '../types/software'

/**
 * حذف عضویت‌های یتیم، تکراری، و تخصیص بین‌شرکتی خراب
 */
export function sanitizeMemberships(
  memberships: SoftwareMembership[],
  softwares: Software[],
  users: SystemUser[],
): SoftwareMembership[] {
  const seen = new Set<string>()
  const out: SoftwareMembership[] = []

  for (const m of memberships) {
    const key = `${m.softwareId}|${m.userId}|${m.kind}`
    if (seen.has(key)) continue

    const sw = softwares.find((s) => s.id === m.softwareId)
    const u = users.find((x) => x.id === m.userId)
    if (!sw || !u) continue

    if (m.kind === 'company_owner') {
      if (sw.ownerUserId !== m.userId) continue
    } else if (m.kind === 'software_owner') {
      // مالک نرم‌افزار می‌تواند روی چند نرم‌افزار باشد؛ فیلتر بین‌شرکتی اعمال نشود
    } else if (
      u.companyOwnerUserId &&
      u.companyOwnerUserId !== sw.ownerUserId
    ) {
      // کاربر متعلق به شرکت دیگر است ولی روی نرم‌افزار این شرکت مانده — خراب
      continue
    }

    seen.add(key)
    out.push(m)
  }

  return out
}

export function membershipExists(
  memberships: SoftwareMembership[],
  softwareId: string,
  userId: string,
  kind: string,
): boolean {
  return memberships.some(
    (m) =>
      m.softwareId === softwareId && m.userId === userId && m.kind === kind,
  )
}
