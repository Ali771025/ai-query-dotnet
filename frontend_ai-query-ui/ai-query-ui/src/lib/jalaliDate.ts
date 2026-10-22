/** Convert Persian/Arabic-Indic digits to Western digits. */
export function toWesternDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - '٠'.charCodeAt(0)))
}

/**
 * Normalize Jalali date fragments for comparison/storage:
 * Western digits + zero-padded month/day (e.g. `1403/5/1` → `1403/05/01`).
 * Leaves surrounding text (time, notes) intact.
 */
export function normalizeJalaliDateString(input: string): string {
  return toWesternDigits(input).replace(
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    (_m, y: string, mo: string, d: string) =>
      `${y}/${mo.padStart(2, '0')}/${d.padStart(2, '0')}`,
  )
}

/** Storage format used by seed data: `YYYY/MM/DD` with Western digits. */
export function formatJalaliStorage(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

/** Case-sensitive includes after digit/padding normalization (for table filters). */
export function jalaliDateIncludes(haystack: string, needle: string): boolean {
  const q = needle.trim()
  if (!q) return true
  return normalizeJalaliDateString(haystack).includes(normalizeJalaliDateString(q))
}
