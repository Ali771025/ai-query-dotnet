/**
 * سلسله‌مراتب ثابت پلتفرم — بدون دور زدن سطوح بالاتر.
 *
 * platform (مالک پلتفرم)
 *   → software_owner (مالک نرم‌افزار)
 *     → company (مالک شرکت نرم‌افزاری)
 *       → support (نقش سفارشی شرکت / پشتیبان)
 *         → tenant (کاربر نهایی)
 *           → org_member (کاربر سازمان + API Key)
 *
 * نقش‌های سفارشی (پشتیبان پلتفرم کیان، نقش‌های شرکت) ستون سلسله نیستند؛
 * فقط داخل envelope همان سطح ساخته می‌شوند.
 */

export type HierarchyTier =
  | 'platform'
  | 'software_owner'
  | 'company'
  | 'support'
  | 'tenant'
  | 'org_member'

export type MembershipKind =
  | 'software_owner'
  | 'company_owner'
  | 'software_support'
  | 'end_user'
  | 'org_member'

/** عدد بالاتر = قدرت بیشتر؛ فقط به سطوح پایین‌تر می‌توان دسترسی داد */
export const TIER_RANK: Record<HierarchyTier, number> = {
  platform: 60,
  software_owner: 50,
  company: 40,
  support: 30,
  tenant: 20,
  org_member: 10,
}

export const MEMBERSHIP_KIND_TIER: Record<MembershipKind, HierarchyTier> = {
  software_owner: 'software_owner',
  company_owner: 'company',
  software_support: 'support',
  end_user: 'tenant',
  org_member: 'org_member',
}

/** چه kindهایی هر سطح می‌تواند روی یک نرم‌افزار بسازد/لینک کند */
export const CAN_ASSIGN_KIND: Record<HierarchyTier, MembershipKind[]> = {
  platform: ['software_owner'],
  software_owner: ['company_owner'],
  company: ['software_support', 'end_user'],
  support: ['end_user'],
  tenant: ['org_member'],
  org_member: [],
}

export function canAssignMembership(
  actorTier: HierarchyTier,
  kind: MembershipKind,
): boolean {
  return CAN_ASSIGN_KIND[actorTier]?.includes(kind) ?? false
}

export function isStrictlyBelow(actor: HierarchyTier, target: HierarchyTier): boolean {
  return TIER_RANK[actor] > TIER_RANK[target]
}
