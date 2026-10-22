export type AiProviderKind = 'openai_compatible' | 'custom' | 'local'

/** وضعیت آخرین تست اتصال (اختیاری) */
export type AiProviderConnectionStatus = 'unknown' | 'ok' | 'failed'

export type AiProviderConfig = {
  id: string
  name: string
  providerKind: AiProviderKind
  baseUrl: string
  /** کلید API — فقط در localStorage این اپ mock ذخیره می‌شود */
  apiKey: string
  modelName: string
  isActive: boolean
  /** دقیقاً یک پیش‌فرض برای همهٔ درخواست‌ها */
  isDefault: boolean
  status?: AiProviderConnectionStatus
  createdAt?: string
  updatedAt?: string
}

export const AI_PROVIDER_KIND_LABELS: Record<AiProviderKind, string> = {
  openai_compatible: 'سازگار با OpenAI',
  custom: 'سفارشی / ارائه‌دهنده ایرانی',
  local: 'مدل محلی (API)',
}
