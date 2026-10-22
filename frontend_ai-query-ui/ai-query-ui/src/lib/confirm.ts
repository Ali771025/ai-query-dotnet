import { getGlobalConfirm } from '../context/ConfirmContext'

/** تأیید قبل از حذف — از دیالوگ داخل اپ (نه window.confirm) */
export async function confirmDelete(itemLabel?: string): Promise<boolean> {
  const detail = itemLabel?.trim() ? `«${itemLabel.trim()}»` : 'این مورد'
  const confirm = getGlobalConfirm()
  if (!confirm) {
    return window.confirm(
      `آیا از حذف ${detail} مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    )
  }
  return confirm({
    title: 'تأیید حذف',
    message: `آیا از حذف ${detail} مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmLabel: 'حذف',
    cancelLabel: 'انصراف',
    danger: true,
  })
}

export async function confirmRevoke(itemLabel?: string): Promise<boolean> {
  const detail = itemLabel?.trim() ? `«${itemLabel.trim()}»` : 'این کلید'
  const confirm = getGlobalConfirm()
  if (!confirm) {
    return window.confirm(
      `آیا از ابطال ${detail} مطمئن هستید؟ پس از ابطال قابل استفاده نیست.`,
    )
  }
  return confirm({
    title: 'تأیید ابطال',
    message: `آیا از ابطال ${detail} مطمئن هستید؟ پس از ابطال قابل استفاده نیست.`,
    confirmLabel: 'ابطال',
    cancelLabel: 'انصراف',
    danger: true,
  })
}

/** تأیید بستن فرم با تغییرات ذخیره‌نشده */
export async function confirmDiscardForm(
  message = 'تغییرات ذخیره‌نشده دارید. آیا می‌خواهید بدون ذخیره خارج شوید؟',
): Promise<boolean> {
  const confirm = getGlobalConfirm()
  if (!confirm) return window.confirm(message)
  return confirm({
    title: 'خروج از فرم',
    message,
    confirmLabel: 'خروج بدون ذخیره',
    cancelLabel: 'ادامه ویرایش',
    danger: true,
  })
}
