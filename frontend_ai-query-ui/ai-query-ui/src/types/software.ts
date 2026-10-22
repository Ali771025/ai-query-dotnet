import type { Status } from './common'

export type SoftwareType = 'independent' | 'dependent'

export type Software = {
  id: string
  name: string
  code: string
  /** منسوخ — دیگر در UI استفاده نمی‌شود */
  type?: SoftwareType
  parentId?: string
  parentName?: string
  status: Status
  versionCount: number
  ownerUserId: string
  rowVersion?: number
}

/** دیتابیس متعلق به یک نرم‌افزار؛ می‌تواند فقط در بازهٔ مشخصی از نسخه‌ها باشد */
export type SoftwareDatabase = {
  id: string
  softwareId: string
  name: string
  code: string
  status: Status
  description?: string
  /** اولین نسخه‌ای که دیتابیس در آن ظاهر می‌شود؛ خالی = از ابتدا */
  introducedInVersionId?: string
  /** از این نسخه به بعد دیگر وجود ندارد؛ خالی = همچنان موجود */
  removedInVersionId?: string
  dialect?: string
  rowVersion?: number
}

export type SoftwareMembership = {
  id: string
  softwareId: string
  userId: string
  kind:
    | 'software_owner'
    | 'company_owner'
    | 'software_support'
    | 'end_user'
    | 'org_member'
  /** نقش‌های اعمال‌شده در context همین نرم‌افزار */
  roleIds: string[]
  /** برای org_member: کاربر نهایی (IT) که او را ساخته */
  parentTenantUserId?: string
}

export type TokenLedgerEntry = {
  id: string
  userId: string
  userName: string
  amount: number
  type: 'charge' | 'consume' | 'adjust' | 'allocate'
  purpose: 'manager' | 'end_user' | 'api_key'
  softwareId?: string
  apiKeyId?: string
  date: string
  note: string
  actorUserId?: string
}

export type SoftwareVersion = {
  id: string
  softwareId: string
  softwareName: string
  version: string
  status: Status
  knowledgeStatus: 'complete' | 'partial' | 'empty'
  referencedVersions: string[]
  releasedAt: string
  rowVersion?: number
}

/** فایل مستند داخل بستهٔ دانش یک دیتابیس/نسخه */
export type KnowledgeDocFile = {
  id: string
  /** مسیر نسبی داخل ZIP (با حفظ فولدربندی) */
  path: string
  name: string
  sizeLabel: string
  updatedAt: string
  /** text = قابل ویرایش در مرورگر؛ base64 = باینری */
  encoding: 'text' | 'base64'
  content: string
  active: boolean
  /** هش encoding+content برای مقایسهٔ هویت بین نسخه‌ها (اختیاری؛ در صورت نبود محاسبه می‌شود) */
  contentHash?: string
}

export type DatabaseVersionDocs = {
  databaseId: string
  files: KnowledgeDocFile[]
  updatedAt: string
}

/** دانش یک نسخه — توضیحات + مستندات دیتابیس‌های انتخاب‌شده */
export type VersionKnowledgeRecord = {
  versionId: string
  description: string
  analysis: string
  /** دیتابیس‌هایی که در این نسخه تغییر داشته‌اند */
  selectedDatabaseIds: string[]
  databaseDocs: DatabaseVersionDocs[]
  /** تایید نهایی حداقل یک‌بار انجام شده */
  confirmed: boolean
  confirmedAt?: string
}

/** @deprecated مدل قدیمی mock — از VersionKnowledgeRecord استفاده شود */
export type KnowledgeFile = {
  id: string
  name: string
  size: string
  updatedAt: string
  type: string
}

/** @deprecated */
export type VersionKnowledge = {
  versionId: string
  description: string
  analysis: string
  files: KnowledgeFile[]
}

export type AppUser = {
  id: string
  name: string
  username: string
  email: string
  status: Status
  tokenBalance: number
  apiKeyMasked: string
  softwareName: string
}

export type UserTokenCharge = {
  id: string
  userId: string
  userName: string
  amount: number
  type: 'charge' | 'consume'
  date: string
  note: string
}

export type ApiKeyRecord = {
  id: string
  userId: string
  userName: string
  softwareId: string
  keyMasked: string
  allocatedTokens: number
  createdAt: string
  lastUsedAt: string
  status: Status
  /** IT سازمانی که کلید را صادر کرده (اگر برای org_member باشد) */
  createdByTenantUserId?: string
}

export type RequestMonitorItem = {
  id: string
  timestamp: string
  user: string
  software: string
  topic: string
  status: 'success' | 'failed' | 'cached'
  latencyMs: number
  model: string
}

export type PromptLog = {
  id: string
  timestamp: string
  user: string
  prompt: string
  response: string
  model: string
  cached: boolean
}

export type AccuracyFeedback = {
  id: string
  requestId: string
  topic: string
  userScore: number
  systemScore: number
  managerScore: number | null
  comment: string
  date: string
}
