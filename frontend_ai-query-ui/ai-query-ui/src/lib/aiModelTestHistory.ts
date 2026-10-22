import type { MockAiQueryTestResult } from './mockAiQueryTest'
import { loadJson, saveJson } from './storage'

export type AiModelTestHistoryEntry = {
  id: string
  userId: string
  softwareId: string
  versionId: string
  prompt: string
  /** کلید استفاده‌شده در اجرای تست (اختیاری برای تاریخچه قدیمی) */
  apiKeyId?: string
  apiKeyMasked?: string
  /** ارائه‌دهندهٔ پیش‌فرض پلتفرم در زمان اجرا */
  platformProviderId?: string
  platformProviderName?: string
  createdAt: string
  archived: boolean
  result: MockAiQueryTestResult
}

function storageKey(userId: string) {
  return `aiModelTests:${userId}`
}

export function loadAiModelTests(userId: string): AiModelTestHistoryEntry[] {
  if (!userId) return []
  return loadJson<AiModelTestHistoryEntry[]>(storageKey(userId), [])
}

export function persistAiModelTests(
  userId: string,
  entries: AiModelTestHistoryEntry[],
): void {
  if (!userId) return
  saveJson(storageKey(userId), entries)
}

export function createAiModelTestEntry(input: {
  userId: string
  softwareId: string
  versionId: string
  prompt: string
  result: MockAiQueryTestResult
  apiKeyId?: string
  apiKeyMasked?: string
  platformProviderId?: string
  platformProviderName?: string
}): AiModelTestHistoryEntry {
  return {
    id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    softwareId: input.softwareId,
    versionId: input.versionId,
    prompt: input.prompt,
    apiKeyId: input.apiKeyId,
    apiKeyMasked: input.apiKeyMasked,
    platformProviderId: input.platformProviderId,
    platformProviderName: input.platformProviderName,
    createdAt: new Date().toISOString(),
    archived: false,
    result: input.result,
  }
}
