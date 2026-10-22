import type { SoftwareVersion } from '../types/software'

/**
 * ارجاع نسخه برای اشتراک دانش مثل پشته است:
 * - حلقه ممنوع (مثلاً ۲→۱ و ۱→۲)
 * - ارجاع به نسخهٔ میانی که خودش ارجاع دارد → به ریشهٔ زنجیره canonicalize می‌شود
 */

export function versionsOfSoftware(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
): SoftwareVersion[] {
  return versions.filter((v) => v.softwareId === softwareId)
}

function byVersionNumber(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
  versionNumber: string,
): SoftwareVersion | undefined {
  const n = versionNumber.trim()
  if (!n) return undefined
  return versions.find(
    (v) => v.softwareId === softwareId && v.version.trim() === n,
  )
}

/**
 * ریشهٔ پشتهٔ ارجاع: اولین نسخه‌ای که خودش ارجاعی ندارد.
 * در صورت حلقه، روی همان گرهٔ شروع حلقه متوقف می‌شود (بدون بی‌نهایت).
 *
 * `ignoreOutgoingOf`: شمارهٔ نسخهٔ در حال ویرایش — ارجاع ذخیره‌شدهٔ قبلی‌اش
 * دنبال نمی‌شود تا حلقهٔ پنهان پشت لبهٔ قدیمی از قلم نیفتد.
 */
export function resolveReferenceRoot(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
  versionNumber: string,
  ignoreOutgoingOf?: string,
): string {
  const start = versionNumber.trim()
  if (!start) return ''
  const ignore = ignoreOutgoingOf?.trim() ?? ''

  const seen = new Set<string>()
  let current = start

  while (current) {
    if (seen.has(current)) return current
    seen.add(current)
    // نسخهٔ در حال ویرایش: لبهٔ خروجی قدیمی را نادیده بگیر
    if (ignore && current === ignore) return current
    const node = byVersionNumber(versions, softwareId, current)
    const next = node?.referencedVersions[0]?.trim() ?? ''
    if (!next) return current
    current = next
  }

  return start
}

/**
 * آیا اگر `fromVersionNumber` به `toVersionNumber` ارجاع دهد حلقه ساخته می‌شود؟
 * `fromVersionNumber` شمارهٔ نسخه‌ای است که در حال ذخیره است (ممکن است هنوز در لیست نباشد).
 */
export function wouldCreateReferenceCycle(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
  fromVersionNumber: string,
  toVersionNumber: string,
): boolean {
  const from = fromVersionNumber.trim()
  const to = toVersionNumber.trim()
  if (!from || !to) return false
  if (from === to) return true

  // از هدف به‌سمت ریشه راه برو؛ اگر به «from» برسیم حلقه است
  const seen = new Set<string>()
  let current = to
  while (current) {
    if (current === from) return true
    if (seen.has(current)) return true
    seen.add(current)
    const node = byVersionNumber(versions, softwareId, current)
    // وقتی from همان نسخهٔ در حال ویرایش است، ارجاع ذخیره‌شدهٔ قبلی‌اش را نادیده بگیر
    // و فقط زنجیرهٔ هدف را دنبال کن — برای این کار از نسخهٔ فرضی با ارجاع جدید استفاده نمی‌کنیم
    const next = node?.referencedVersions[0]?.trim() ?? ''
    if (!next) return false
    // اگر next برابر from باشد و node همان from است (ویرایش)، از ارجاع پیشنهادی استفاده شده
    current = next
  }
  return false
}

/**
 * ارجاع انتخاب‌شده را به ریشهٔ پشته تبدیل می‌کند (مستندات تغییر نکرده = همان مرجع پایه).
 * اگر منجر به حلقه شود `null` برمی‌گرداند.
 */
export function canonicalizeVersionReference(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
  fromVersionNumber: string,
  selectedRefVersion: string,
): { ok: true; root: string } | { ok: false; message: string } {
  const selected = selectedRefVersion.trim()
  if (!selected) return { ok: true, root: '' }

  const target = byVersionNumber(versions, softwareId, selected)
  if (!target) {
    return { ok: false, message: 'نسخهٔ ارجاع‌شده یافت نشد.' }
  }

  const root = resolveReferenceRoot(
    versions,
    softwareId,
    selected,
    fromVersionNumber,
  )

  if (
    wouldCreateReferenceCycle(versions, softwareId, fromVersionNumber, root)
  ) {
    return {
      ok: false,
      message:
        'این ارجاع حلقه می‌سازد (مثلاً ارجاع متقابل دو نسخه). نسخهٔ دیگری را انتخاب کنید.',
    }
  }

  return { ok: true, root }
}

/** گزینه‌های ارجاع مجاز برای فرم — نسخه‌هایی که با ارجاع به ریشه‌شان حلقه نمی‌سازند */
export function allowedReferenceVersionNumbers(
  versions: ReadonlyArray<SoftwareVersion>,
  softwareId: string,
  fromVersionNumber: string,
  excludeVersionId?: string,
): string[] {
  return versionsOfSoftware(versions, softwareId)
    .filter((v) => !excludeVersionId || v.id !== excludeVersionId)
    .map((v) => v.version.trim())
    .filter((num) => {
      if (!num) return false
      if (fromVersionNumber.trim() && num === fromVersionNumber.trim()) {
        return false
      }
      const root = resolveReferenceRoot(
        versions,
        softwareId,
        num,
        fromVersionNumber,
      )
      return !wouldCreateReferenceCycle(
        versions,
        softwareId,
        fromVersionNumber,
        root,
      )
    })
}
