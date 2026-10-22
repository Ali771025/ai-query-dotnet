import type { SoftwareVersion } from '../types/software'
import { normalizeJalaliDateString, toWesternDigits } from './jalaliDate'

/**
 * مقایسهٔ برچسب نسخه (مثل ۱، ۲، 2.3.0) به‌صورت بخش‌به‌بخش عددی.
 * برای tie-break وقتی تاریخ انتشار یکسان است.
 */
export function compareVersionLabels(a: string, b: string): number {
  const pa = toWesternDigits(a.trim())
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
  const pb = toWesternDigits(b.trim())
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const xa = pa[i] ?? ''
    const xb = pb[i] ?? ''
    const na = /^\d+$/.test(xa) ? Number(xa) : Number.NaN
    const nb = /^\d+$/.test(xb) ? Number(xb) : Number.NaN
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na - nb
      continue
    }
    const c = xa.localeCompare(xb, 'en', { sensitivity: 'base' })
    if (c) return c
  }
  return 0
}

/**
 * ترتیب پایدار نسخه‌ها از قدیم به جدید:
 * 1) تاریخ انتشار نرمال‌شده
 * 2) برچسب نسخه (semver-like)
 * 3) id
 *
 * بدون tie-break، نسخه‌های هم‌روز (پیش‌فرض فرم نسخه = امروز) با ترتیب ساخت
 * جابه‌جا می‌شوند و بازهٔ معرفی/حذف دیتابیس غلط می‌شود.
 */
export function compareSoftwareVersionsAsc(
  a: Pick<SoftwareVersion, 'id' | 'version' | 'releasedAt'>,
  b: Pick<SoftwareVersion, 'id' | 'version' | 'releasedAt'>,
): number {
  const da = normalizeJalaliDateString(a.releasedAt || '')
  const db = normalizeJalaliDateString(b.releasedAt || '')
  const byDate = da.localeCompare(db)
  if (byDate) return byDate
  const byLabel = compareVersionLabels(a.version, b.version)
  if (byLabel) return byLabel
  return a.id.localeCompare(b.id)
}

/** نسخه‌های یک نرم‌افزار از قدیم به جدید */
export function orderVersionsForSoftware(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
): SoftwareVersion[] {
  return versions
    .filter((v) => v.softwareId === softwareId)
    .slice()
    .sort(compareSoftwareVersionsAsc)
}

export function orderedVersionIdsForSoftware(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
): string[] {
  return orderVersionsForSoftware(versions, softwareId).map((v) => v.id)
}

/** آیا دیتابیس در نسخهٔ داده‌شده وجود دارد؟ */
export function isDatabaseInVersion(
  db: {
    introducedInVersionId?: string
    removedInVersionId?: string
  },
  versionId: string,
  /** شناسه نسخه‌ها از قدیم به جدید */
  orderedVersionIds: string[],
): boolean {
  const idx = orderedVersionIds.indexOf(versionId)
  if (idx < 0) return false

  if (db.introducedInVersionId) {
    const from = orderedVersionIds.indexOf(db.introducedInVersionId)
    if (from >= 0 && idx < from) return false
  }
  if (db.removedInVersionId) {
    const removedAt = orderedVersionIds.indexOf(db.removedInVersionId)
    if (removedAt >= 0 && idx >= removedAt) return false
  }
  return true
}
