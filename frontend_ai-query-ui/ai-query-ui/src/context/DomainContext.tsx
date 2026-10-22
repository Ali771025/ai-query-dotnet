import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  ApiKeyRecord,
  Software,
  SoftwareDatabase,
  SoftwareMembership,
  SoftwareVersion,
  TokenLedgerEntry,
  VersionKnowledgeRecord,
} from '../types/software'
import type { AiProviderConfig } from '../types/aiProvider'
import { emptyVersionKnowledge } from '../lib/knowledgeZip'
import {
  isDatabaseInVersion,
  orderedVersionIdsForSoftware,
} from '../lib/databases'
import type { Role, SystemUser, Workspace } from '../types/rbac'
import {
  DOMAIN_SCHEMA_VERSION,
  END_USER_ROLE_ID,
  ORG_MEMBER_ROLE_ID,
  OWNER_ROLE_ID,
  PLATFORM_SUPPORT_ROLE_ID,
  SOFTWARE_COMPANY_ROLE_ID,
  SOFTWARE_OWNER_ROLE_ID,
  SOFTWARE_SUPPORT_ROLE_ID,
} from '../data/seed'
import {
  seedApiKeys,
  seedMemberships,
  seedTokenLedger,
} from '../data/domainSeed'
import {
  canAssignMembership,
  type HierarchyTier,
  type MembershipKind,
} from '../lib/hierarchy'
import {
  apiKeyPeerUsers as resolveApiKeyPeerUsers,
  canManageApiKeyForUser,
} from '../lib/apiKeyScope'
import { loadJson, saveJson } from '../lib/storage'
import { membershipExists, sanitizeMemberships } from '../lib/memberships'
import { canonicalizeVersionReference } from '../lib/versionReferences'
import { isValidMobile, useAuth } from './AuthContext'
import { catalogApi } from '../api/catalog'

type Fail = {
  ok: false
  message: string
  fields?: Record<string, string>
  linkedUserId?: string
}

function fail(message: string, fields?: Record<string, string>): Fail {
  return fields ? { ok: false, message, fields } : { ok: false, message }
}

function faToday() {
  return new Date().toLocaleDateString('fa-IR')
}

export function actorTier(
  user: SystemUser | null,
  roles: Role[] = [],
  activeWorkspace?: Workspace | null,
): HierarchyTier | null {
  if (!user) return null
  // اولویت با پرسونای نشست — جلوگیری از اتحاد قدرت چند نقش
  if (activeWorkspace === 'platform') return 'platform'
  if (activeWorkspace === 'software_owner') return 'software_owner'
  if (activeWorkspace === 'company') return 'company'
  if (activeWorkspace === 'support') return 'support'
  if (activeWorkspace === 'tenant') return 'tenant'

  if (
    user.roleIds.includes(OWNER_ROLE_ID) ||
    user.roleIds.includes(PLATFORM_SUPPORT_ROLE_ID)
  ) {
    return 'platform'
  }
  if (user.roleIds.includes(SOFTWARE_OWNER_ROLE_ID)) return 'software_owner'
  if (user.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID)) return 'company'
  if (user.roleIds.includes(SOFTWARE_SUPPORT_ROLE_ID)) return 'support'
  if (roles.some((r) => Boolean(r.ownerUserId) && user.roleIds.includes(r.id))) {
    return 'support'
  }
  if (user.roleIds.includes(END_USER_ROLE_ID)) return 'tenant'
  if (user.roleIds.includes(ORG_MEMBER_ROLE_ID)) return 'org_member'
  return null
}

function migrateMembership(m: SoftwareMembership): SoftwareMembership {
  const raw = m as unknown as { kind: string }
  if (raw.kind === 'manager') {
    return { ...m, kind: 'company_owner' }
  }
  return m
}

function ensureDomainSeed() {
  const version = loadJson<number>('domainSchemaVersion', 0)

  // فقط اگر کلید وجود نداشته باشد seed کن — آرایهٔ خالی عمدی کاربر را دست نزن
  const mems = loadJson<SoftwareMembership[] | null>('memberships', null)
  if (mems === null) {
    saveJson('memberships', seedMemberships)
  } else {
    const migrated = mems.map(migrateMembership)
    const changed = migrated.some((m, i) => m.kind !== mems[i]?.kind)
    if (changed) saveJson('memberships', migrated)
  }
  if (loadJson<TokenLedgerEntry[] | null>('tokenLedger', null) === null) {
    saveJson('tokenLedger', seedTokenLedger)
  }
  if (loadJson<ApiKeyRecord[] | null>('apiKeys', null) === null) {
    saveJson('apiKeys', seedApiKeys)
  }

  if (version < DOMAIN_SCHEMA_VERSION) {
    // افزودن membershipهای seed که هنوز نیستند (بدون wipe)
    const current = loadJson<SoftwareMembership[]>('memberships', [])
    const byId = new Set(current.map((m) => m.id))
    let merged = [...current]
    for (const seed of seedMemberships) {
      if (!byId.has(seed.id)) merged.push(seed)
    }
    if (merged.length !== current.length) {
      saveJson('memberships', merged)
    }
    saveJson('domainSchemaVersion', DOMAIN_SCHEMA_VERSION)
  }
}

function hasActiveDocs(
  record: VersionKnowledgeRecord,
  databaseId: string,
): boolean {
  const docs = record.databaseDocs.find((d) => d.databaseId === databaseId)
  return Boolean(docs?.files.some((f) => f.active))
}

/** مستند محلی این نسخه، یا نزدیک‌ترین نسخهٔ قبلی همان دیتابیس */
function hasEffectiveActiveDocs(
  record: VersionKnowledgeRecord,
  databaseId: string,
  orderedIds: string[],
  allKnowledge: VersionKnowledgeRecord[],
): boolean {
  if (hasActiveDocs(record, databaseId)) return true
  const idx = orderedIds.indexOf(record.versionId)
  if (idx <= 0) return false
  for (let i = idx - 1; i >= 0; i--) {
    const versionId = orderedIds[i]
    if (!versionId) continue
    const prev = allKnowledge.find((k) => k.versionId === versionId)
    if (!prev) continue
    if (hasActiveDocs(prev, databaseId)) return true
  }
  return false
}

function deriveKnowledgeStatus(
  record: VersionKnowledgeRecord,
): SoftwareVersion['knowledgeStatus'] {
  if (record.confirmed) return 'complete'
  const hasText =
    Boolean(record.description.trim()) || Boolean(record.analysis.trim())
  const hasFiles = record.databaseDocs.some((d) =>
    d.files.some((f) => f.active),
  )
  const hasSelection = record.selectedDatabaseIds.length > 0
  if (!hasText && !hasFiles && !hasSelection) return 'empty'
  return 'partial'
}

ensureDomainSeed()

const KIND_DEFAULT_ROLE: Record<MembershipKind, string> = {
  software_owner: SOFTWARE_OWNER_ROLE_ID,
  company_owner: SOFTWARE_COMPANY_ROLE_ID,
  software_support: SOFTWARE_SUPPORT_ROLE_ID,
  end_user: END_USER_ROLE_ID,
  org_member: ORG_MEMBER_ROLE_ID,
}

type DomainContextValue = {
  softwares: Software[]
  versions: SoftwareVersion[]
  databases: SoftwareDatabase[]
  memberships: SoftwareMembership[]
  tokenLedger: TokenLedgerEntry[]
  apiKeys: ApiKeyRecord[]
  actorTier: HierarchyTier | null
  ownedSoftwares: (userId: string) => Software[]
  accessibleSoftwares: Software[]
  isSoftwareManagerUser: (userId: string) => boolean
  softwareManagers: SystemUser[]
  membershipsForSoftware: (softwareId: string) => SoftwareMembership[]
  usersOfKindForSoftware: (softwareId: string, kind: MembershipKind) => SystemUser[]
  databasesForSoftware: (softwareId: string) => SoftwareDatabase[]
  versionsForSoftware: (softwareId: string) => SoftwareVersion[]
  upsertSoftware: (software: Software) => Promise<{ ok: true } | Fail>
  deleteSoftware: (softwareId: string) => Promise<{ ok: true } | Fail>
  upsertVersion: (version: SoftwareVersion) => Promise<{ ok: true } | Fail>
  deleteVersion: (versionId: string) => Promise<{ ok: true } | Fail>
  versionKnowledges: VersionKnowledgeRecord[]
  getVersionKnowledge: (versionId: string) => VersionKnowledgeRecord
  upsertVersionKnowledge: (record: VersionKnowledgeRecord) => { ok: true } | Fail
  /** ذخیرهٔ چند رکورد دانش نسخه در یک persist (مثلاً انتشار فایل بین نسخه‌ها) */
  upsertVersionKnowledges: (
    records: VersionKnowledgeRecord[],
  ) => { ok: true } | Fail
  confirmVersionKnowledge: (record: VersionKnowledgeRecord) => { ok: true } | Fail
  upsertDatabase: (db: SoftwareDatabase) => Promise<{ ok: true } | Fail>
  deleteDatabase: (databaseId: string) => Promise<{ ok: true } | Fail>
  upsertMembership: (m: SoftwareMembership) => { ok: true } | Fail
  removeMembership: (membershipId: string) => { ok: true } | Fail
  /** تخصیص سلسله‌مراتبی کاربر به نرم‌افزار (ایجاد یا لینک) — چند نقش همزمان مجاز */
  assignUserToSoftware: (input: {
    softwareId: string
    kinds: MembershipKind[]
    name: string
    username: string
    mobile: string
    email: string
    password: string
    organizationName?: string
    /** وقتی کاربر موجود با موبایل انتخاب شده */
    linkedUserId?: string
    /**
     * نقش سفارشی شرکت برای kind=software_support
     * (سراسری شرکت — جایگزین نقش سیستمی پشتیبان)
     */
    supportRoleId?: string
  }) => { ok: true; userId: string; linked: boolean } | Fail
  allocateManagerTokens: (
    targetUserId: string,
    amount: number,
    note: string,
  ) => { ok: true } | Fail
  selfChargeEndUser: (amount: number, note: string) => { ok: true } | Fail
  /** شارژ کیف کاربر نهایی توسط مالک نرم‌افزار */
  chargeSoftwareEndUser: (
    softwareId: string,
    targetUserId: string,
    amount: number,
    note: string,
  ) => { ok: true } | Fail
  createApiKey: (
    softwareId: string,
    forUserId?: string,
  ) => { ok: true; keyFull: string; record: ApiKeyRecord } | Fail
  allocateTokensToApiKey: (apiKeyId: string, amount: number) => { ok: true } | Fail
  revokeApiKey: (apiKeyId: string) => { ok: true } | Fail
  /** کاربران هم‌سطح برای صدور/مدیریت API Key */
  apiKeyPeerUsers: SystemUser[]
  managerLedger: TokenLedgerEntry[]
  endUserLedgerFor: (userId: string) => TokenLedgerEntry[]
  orgMembersForTenant: (tenantUserId: string, softwareId?: string) => SystemUser[]
  /** آیا شرکت جاری می‌تواند مشخصات این کاربر را ویرایش کند؟ */
  canEditAssignedUser: (targetUserId: string) => boolean
  /** تنظیمات ارائه‌دهندگان AI — فقط مالک پلتفرم می‌تواند تغییر دهد */
  aiProviders: AiProviderConfig[]
  defaultAiProvider: AiProviderConfig | null
  upsertAiProvider: (provider: AiProviderConfig) => { ok: true } | Fail
  deleteAiProvider: (providerId: string) => { ok: true } | Fail
  setDefaultAiProvider: (providerId: string) => { ok: true } | Fail
  setAiProviderConnectionStatus: (
    providerId: string,
    status: NonNullable<AiProviderConfig['status']>,
  ) => { ok: true } | Fail
}

const DomainContext = createContext<DomainContextValue | null>(null)

export function DomainProvider({ children }: { children: ReactNode }) {
  const { user, users, roles, patchUserBalances, ensureUserHasRole, findUserByIdentity, activeWorkspace, activeTenantId, activeOrganizationId } =
    useAuth()

  // fallback خالی: ensureDomainSeed قبلاً فقط در نبود کلید seed کرده؛ [] عمدی کاربر حفظ می‌شود
  const [softwares, setSoftwares] = useState<Software[]>([])
  const [versions, setVersions] = useState<SoftwareVersion[]>([])
  const [databases, setDatabases] = useState<SoftwareDatabase[]>([])
  const [memberships, setMemberships] = useState<SoftwareMembership[]>(() =>
    loadJson<SoftwareMembership[]>('memberships', []).map(migrateMembership),
  )
  const [tokenLedger, setTokenLedger] = useState<TokenLedgerEntry[]>(() =>
    loadJson('tokenLedger', []),
  )
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(() =>
    loadJson('apiKeys', []),
  )
  const [versionKnowledges, setVersionKnowledges] = useState<
    VersionKnowledgeRecord[]
  >([])
  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>(() =>
    loadJson('aiProviders', []),
  )

  useEffect(() => {
    if (!activeTenantId) { setSoftwares([]); setVersions([]); setDatabases([]); return }
    catalogApi.listSoftware({ activeTenantId, activeOrganizationId }).then(async page => {
      const mapped: Software[] = page.items.map(item => ({ id:item.id,name:item.name,code:item.code,status:item.status.toLowerCase()==='active'?'active':'inactive',versionCount:item.versionCount,ownerUserId:item.ownerOrganizationId,rowVersion:item.version }))
      setSoftwares(mapped)
      const nested = await Promise.all(page.items.map(async software => {
        const [versionPage,databasePage]=await Promise.all([catalogApi.listVersions(software.id,activeTenantId,activeOrganizationId),catalogApi.listDatabases(software.id,activeTenantId,activeOrganizationId)])
        return { software, versions:versionPage.items, databases:databasePage.items }
      }))
      setVersions(nested.flatMap(group=>group.versions.map(item=>({id:item.id,softwareId:item.softwareId,softwareName:group.software.name,version:item.label,status:item.status.toLowerCase()==='active'?'active':'inactive',knowledgeStatus:item.knowledgeStatus.toLowerCase()==='available'?'complete':item.knowledgeStatus.toLowerCase()==='partial'?'partial':'empty',referencedVersions:item.dependencies,releasedAt:item.releaseDate??'',rowVersion:item.version}))))
      setDatabases(nested.flatMap(group=>group.databases.map(item=>({id:item.id,softwareId:item.softwareId,name:item.name,code:item.code,status:item.isActive?'active':'inactive',introducedInVersionId:item.introducedVersionId??undefined,removedInVersionId:item.removedVersionId??undefined,dialect:item.dialect,rowVersion:item.version}))))
    }).catch(() => { setSoftwares([]); setVersions([]); setDatabases([]) })
  }, [activeTenantId, activeOrganizationId])

  const persistSoftwares = (next: Software[]) => {
    setSoftwares(next)
  }
  const persistVersions = (next: SoftwareVersion[]) => {
    setVersions(next)
  }
  const persistDatabases = (next: SoftwareDatabase[]) => {
    setDatabases(next)
  }
  const persistMemberships = (next: SoftwareMembership[]) => {
    setMemberships(next)
    saveJson('memberships', next)
  }
  const persistLedger = (next: TokenLedgerEntry[]) => {
    setTokenLedger(next)
    saveJson('tokenLedger', next)
  }
  const persistApiKeys = (next: ApiKeyRecord[]) => {
    setApiKeys(next)
    saveJson('apiKeys', next)
  }
  const persistVersionKnowledges = (next: VersionKnowledgeRecord[]) => {
    setVersionKnowledges(next)
  }
  const persistAiProviders = (next: AiProviderConfig[]) => {
    setAiProviders(next)
    saveJson('aiProviders', next)
  }

  const tier = actorTier(user, roles, activeWorkspace)

  useEffect(() => {
    if (!users.length || !softwares.length) return
    const cleaned = sanitizeMemberships(memberships, softwares, users)
    if (cleaned.length !== memberships.length) {
      persistMemberships(cleaned)
    }
    // فقط وقتی طول فرق کند؛ وابستگی به memberships عمدی است
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, softwares])

  const ownedSoftwares = useCallback(
    (userId: string) => softwares.filter((s) => s.ownerUserId === userId),
    [softwares],
  )

  const accessibleSoftwares = useMemo(() => {
    if (!user) return []
    if (tier === 'platform' || user.roleIds.includes(OWNER_ROLE_ID)) {
      // فقط وقتی پرسونا پلتفرم است همه را ببین؛ وگرنه sessionRoleIds فیلتر منو را می‌کند
      if (tier === 'platform') return softwares
    }
    if (tier === 'software_owner') {
      const ids = new Set(
        memberships
          .filter((m) => m.userId === user.id && m.kind === 'software_owner')
          .map((m) => m.softwareId),
      )
      // اگر هنوز membership ندارد، کل کاتالوگ برای تخصیص مالک شرکت
      return ids.size ? softwares.filter((s) => ids.has(s.id)) : softwares
    }
    if (tier === 'company') return softwares.filter((s) => s.ownerUserId === user.id)
    if (tier === 'support' || tier === 'tenant' || tier === 'org_member') {
      const ids = new Set(
        memberships.filter((m) => m.userId === user.id).map((m) => m.softwareId),
      )
      return softwares.filter((s) => ids.has(s.id))
    }
    return []
  }, [user, softwares, memberships, tier])

  const isSoftwareManagerUser = useCallback(
    (userId: string) => softwares.some((s) => s.ownerUserId === userId),
    [softwares],
  )

  const softwareManagers = useMemo(
    () =>
      users
        .filter(
          (u) => u.status === 'active' && softwares.some((s) => s.ownerUserId === u.id),
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt, 'fa')),
    [users, softwares],
  )

  const membershipsForSoftware = useCallback(
    (softwareId: string) => memberships.filter((m) => m.softwareId === softwareId),
    [memberships],
  )

  const usersOfKindForSoftware = useCallback(
    (softwareId: string, kind: MembershipKind) => {
      const seen = new Set<string>()
      const result: SystemUser[] = []
      for (const m of memberships) {
        if (m.softwareId !== softwareId || m.kind !== kind) continue
        if (seen.has(m.userId)) continue
        seen.add(m.userId)
        const u = users.find((x) => x.id === m.userId)
        if (u) result.push(u)
      }
      return result
    },
    [memberships, users],
  )

  const orgMembersForTenant = useCallback(
    (tenantUserId: string, softwareId?: string) => {
      const seen = new Set<string>()
      const result: SystemUser[] = []
      for (const m of memberships) {
        if (m.kind !== 'org_member') continue
        if (m.parentTenantUserId !== tenantUserId) continue
        if (softwareId && m.softwareId !== softwareId) continue
        if (seen.has(m.userId)) continue
        seen.add(m.userId)
        const u = users.find((x) => x.id === m.userId)
        if (u) result.push(u)
      }
      for (const u of users) {
        if (u.parentTenantUserId === tenantUserId && !seen.has(u.id)) {
          seen.add(u.id)
          result.push(u)
        }
      }
      return result
    },
    [memberships, users],
  )

  const canActOnSoftware = useCallback(
    (softwareId: string): boolean => {
      if (!user || !tier) return false
      const sw = softwares.find((s) => s.id === softwareId)
      if (!sw) return false
      if (tier === 'platform') return true
      if (tier === 'software_owner') {
        return (
          memberships.some(
            (m) =>
              m.softwareId === softwareId &&
              m.userId === user.id &&
              m.kind === 'software_owner',
          ) || softwares.some((s) => s.id === softwareId)
        )
      }
      if (tier === 'company') return sw.ownerUserId === user.id
      return memberships.some((m) => m.softwareId === softwareId && m.userId === user.id)
    },
    [user, tier, softwares, memberships],
  )

  const upsertSoftware = useCallback(
    async (software: Software): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      if (tier !== 'company' && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط شرکت نرم‌افزاری می‌تواند نرم‌افزار تعریف کند.')
      }
      const fields: Record<string, string> = {}
      if (!software.name.trim()) fields.name = 'نام نرم‌افزار الزامی است.'
      if (!software.code.trim()) fields.code = 'کد نرم‌افزار الزامی است.'
      if (Object.keys(fields).length) {
        return fail('لطفاً فیلدهای الزامی را تکمیل کنید.', fields)
      }
      const exists = softwares.some((s) => s.id === software.id)
      const ownerUserId = exists
        ? softwares.find((s) => s.id === software.id)!.ownerUserId
        : user.id
      if (exists && ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط مالک نرم‌افزار می‌تواند آن را ویرایش کند.')
      }
      const nextSoft: Software = {
        ...software,
        ownerUserId,
        type: undefined,
        parentId: undefined,
        parentName: undefined,
      }
      if (!activeTenantId || !activeOrganizationId) return fail('محدوده فعال مشخص نیست.')
      try {
        const saved=exists?await catalogApi.updateSoftware(software.id,{tenantId:activeTenantId,organizationId:activeOrganizationId,name:software.name,version:software.rowVersion??0}):await catalogApi.createSoftware({tenantId:activeTenantId,ownerOrganizationId:activeOrganizationId,code:software.code,name:software.name})
        nextSoft.id=saved.id; nextSoft.rowVersion=saved.version; persistSoftwares(exists?softwares.map(s=>s.id===software.id?nextSoft:s):[nextSoft,...softwares])
      } catch(error) { return fail(error instanceof Error?error.message:'ذخیره نرم‌افزار ناموفق بود.') }
      if (!exists) {
        persistMemberships([
          {
            id: `mem-${nextSoft.id}-${user.id}`,
            softwareId: nextSoft.id,
            userId: user.id,
            kind: 'company_owner',
            roleIds: [SOFTWARE_COMPANY_ROLE_ID],
          },
          ...memberships,
        ])
      }
      return { ok: true }
    },
    [user, tier, softwares, memberships, activeTenantId, activeOrganizationId],
  )

  const deleteSoftware = useCallback(
    async (softwareId: string): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      const sw = softwares.find((s) => s.id === softwareId)
      if (!sw) return fail('نرم‌افزار یافت نشد.')
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('اجازه حذف این نرم‌افزار را ندارید.')
      }
      if (!activeTenantId) return fail('محدوده فعال مشخص نیست.')
      try { await catalogApi.deleteSoftware(softwareId,activeTenantId,activeOrganizationId,sw.rowVersion??0) } catch(error){return fail(error instanceof Error?error.message:'حذف نرم‌افزار ناموفق بود.')}
      const removedVersionIds = new Set(
        versions.filter((v) => v.softwareId === softwareId).map((v) => v.id),
      )
      persistSoftwares(softwares.filter((s) => s.id !== softwareId))
      persistVersions(versions.filter((v) => v.softwareId !== softwareId))
      persistDatabases(databases.filter((d) => d.softwareId !== softwareId))
      persistMemberships(memberships.filter((m) => m.softwareId !== softwareId))
      persistApiKeys(apiKeys.filter((k) => k.softwareId !== softwareId))
      if (removedVersionIds.size) {
        persistVersionKnowledges(
          versionKnowledges.filter((k) => !removedVersionIds.has(k.versionId)),
        )
      }
      return { ok: true as const }
    },
    [user, softwares, versions, databases, memberships, apiKeys, versionKnowledges, activeTenantId, activeOrganizationId],
  )

  const versionsForSoftware = useCallback(
    (softwareId: string) => versions.filter((v) => v.softwareId === softwareId),
    [versions],
  )

  const syncSoftwareVersionCount = useCallback((softwareId: string, nextVersions: SoftwareVersion[]) => {
    const count = nextVersions.filter((v) => v.softwareId === softwareId).length
    persistSoftwares(
      softwares.map((s) =>
        s.id === softwareId ? { ...s, versionCount: count } : s,
      ),
    )
  }, [softwares])

  const upsertVersion = useCallback(
    async (ver: SoftwareVersion): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      const sw = softwares.find((s) => s.id === ver.softwareId)
      if (!sw) return fail('نرم‌افزار یافت نشد.', { softwareId: 'نرم‌افزار را انتخاب کنید.' })
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط مالک نرم‌افزار می‌تواند نسخه تعریف کند.')
      }
      const fields: Record<string, string> = {}
      if (!ver.softwareId) fields.softwareId = 'انتخاب نرم‌افزار الزامی است.'
      if (!ver.version.trim()) fields.version = 'شماره نسخه الزامی است.'
      if (Object.keys(fields).length) {
        return fail('لطفاً فیلدهای الزامی را تکمیل کنید.', fields)
      }
      const exists = versions.some((v) => v.id === ver.id)
      const dup = versions.find(
        (v) =>
          v.softwareId === ver.softwareId &&
          v.version.trim() === ver.version.trim() &&
          v.id !== ver.id,
      )
      if (dup) {
        return fail('این شماره نسخه برای نرم‌افزار تکراری است.', {
          version: 'شماره نسخه تکراری است.',
        })
      }
      const rawRef = ver.referencedVersions.map((r) => r.trim()).find(Boolean) ?? ''
      let referencedVersions: string[] = []
      if (rawRef) {
        const canon = canonicalizeVersionReference(
          versions,
          ver.softwareId,
          ver.version.trim(),
          rawRef,
        )
        if (!canon.ok) {
          return fail(canon.message, {
            referencedVersions: canon.message,
          })
        }
        referencedVersions = canon.root ? [canon.root] : []
      }
      const next: SoftwareVersion = {
        ...ver,
        version: ver.version.trim(),
        softwareName: sw.name,
        knowledgeStatus: exists
          ? versions.find((v) => v.id === ver.id)!.knowledgeStatus
          : (ver.knowledgeStatus ?? 'empty'),
        referencedVersions,
        releasedAt: ver.releasedAt || faToday(),
      }
      if (!activeTenantId) return fail('محدوده فعال مشخص نیست.')
      try {
        const saved=exists
          ? await catalogApi.updateVersion(ver.softwareId,ver.id,{tenantId:activeTenantId,organizationId:activeOrganizationId,releaseDate:ver.releasedAt||null,version:ver.rowVersion??0})
          : await catalogApi.createVersion(ver.softwareId,{tenantId:activeTenantId,organizationId:activeOrganizationId,label:ver.version,releaseDate:ver.releasedAt||null})
        next.id=saved.id
        next.rowVersion=saved.version
        if(!exists) for(const dependencyId of referencedVersions) await catalogApi.addDependency(ver.softwareId,saved.id,{tenantId:activeTenantId,organizationId:activeOrganizationId,dependencyId})
      } catch(error){return fail(error instanceof Error?error.message:'ذخیره نسخه ناموفق بود.')}
      const nextVersions = exists
        ? versions.map((v) => (v.id === next.id ? next : v))
        : [next, ...versions]
      persistVersions(nextVersions)
      syncSoftwareVersionCount(ver.softwareId, nextVersions)
      return { ok: true }
    },
    [user, softwares, versions, activeTenantId, activeOrganizationId, syncSoftwareVersionCount],
  )

  const deleteVersion = useCallback(
    async (versionId: string): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      const ver = versions.find((v) => v.id === versionId)
      if (!ver) return fail('نسخه یافت نشد.')
      const sw = softwares.find((s) => s.id === ver.softwareId)
      if (!sw) return fail('نرم‌افزار یافت نشد.')
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('اجازه حذف این نسخه را ندارید.')
      }
      if (!activeTenantId) return fail('محدوده فعال مشخص نیست.')
      try { await catalogApi.retireVersion(ver.softwareId,versionId,{tenantId:activeTenantId,organizationId:activeOrganizationId,version:ver.rowVersion??0}) } catch(error){return fail(error instanceof Error?error.message:'بازنشست‌کردن نسخه ناموفق بود.')}
      const retired = { ...ver, status: 'inactive' as const, rowVersion: (ver.rowVersion ?? 0) + 1 }
      const nextVersions = versions.map((v) => v.id === versionId ? retired : v)
      persistVersions(nextVersions)
      syncSoftwareVersionCount(ver.softwareId, nextVersions)
      return { ok: true as const }
    },
    [user, softwares, versions, activeTenantId, activeOrganizationId, syncSoftwareVersionCount],
  )

  const getVersionKnowledge = useCallback(
    (versionId: string): VersionKnowledgeRecord => {
      return (
        versionKnowledges.find((k) => k.versionId === versionId) ??
        emptyVersionKnowledge(versionId)
      )
    },
    [versionKnowledges],
  )

  const canManageVersionKnowledge = useCallback(
    (versionId: string): { ok: true; version: SoftwareVersion } | Fail => {
      if (!user) return fail('نشست معتبر نیست.')
      const ver = versions.find((v) => v.id === versionId)
      if (!ver) return fail('نسخه یافت نشد.')
      const sw = softwares.find((s) => s.id === ver.softwareId)
      if (!sw) return fail('نرم‌افزار یافت نشد.')
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط مالک نرم‌افزار می‌تواند دانش نسخه را مدیریت کند.')
      }
      return { ok: true, version: ver }
    },
    [user, versions, softwares],
  )

  const applyKnowledgeToVersions = useCallback(
    (record: VersionKnowledgeRecord, status: SoftwareVersion['knowledgeStatus']) => {
      persistVersions(
        versions.map((v) =>
          v.id === record.versionId ? { ...v, knowledgeStatus: status } : v,
        ),
      )
    },
    [versions],
  )

  const upsertVersionKnowledge = useCallback(
    (record: VersionKnowledgeRecord): { ok: true } | Fail => {
      const gate = canManageVersionKnowledge(record.versionId)
      if (!gate.ok) return gate
      const existing = versionKnowledges.find(
        (k) => k.versionId === record.versionId,
      )
      const next: VersionKnowledgeRecord = {
        ...record,
        description: record.description ?? '',
        analysis: record.analysis ?? '',
        selectedDatabaseIds: record.selectedDatabaseIds ?? [],
        databaseDocs: record.databaseDocs ?? [],
        confirmed: existing?.confirmed ?? false,
        confirmedAt: existing?.confirmedAt,
      }
      const status = deriveKnowledgeStatus(next)
      const exists = Boolean(existing)
      persistVersionKnowledges(
        exists
          ? versionKnowledges.map((k) =>
              k.versionId === next.versionId ? next : k,
            )
          : [next, ...versionKnowledges],
      )
      applyKnowledgeToVersions(next, status)
      return { ok: true }
    },
    [
      canManageVersionKnowledge,
      versionKnowledges,
      applyKnowledgeToVersions,
    ],
  )

  const upsertVersionKnowledges = useCallback(
    (records: VersionKnowledgeRecord[]): { ok: true } | Fail => {
      if (!records.length) return { ok: true }
      for (const record of records) {
        const gate = canManageVersionKnowledge(record.versionId)
        if (!gate.ok) return gate
      }

      let nextList = versionKnowledges
      const statusByVersion = new Map<
        string,
        SoftwareVersion['knowledgeStatus']
      >()

      for (const record of records) {
        const existing = nextList.find((k) => k.versionId === record.versionId)
        const next: VersionKnowledgeRecord = {
          ...record,
          description: record.description ?? '',
          analysis: record.analysis ?? '',
          selectedDatabaseIds: record.selectedDatabaseIds ?? [],
          databaseDocs: record.databaseDocs ?? [],
          confirmed: existing?.confirmed ?? false,
          confirmedAt: existing?.confirmedAt,
        }
        statusByVersion.set(next.versionId, deriveKnowledgeStatus(next))
        nextList = existing
          ? nextList.map((k) =>
              k.versionId === next.versionId ? next : k,
            )
          : [next, ...nextList]
      }

      persistVersionKnowledges(nextList)
      persistVersions(
        versions.map((v) => {
          const status = statusByVersion.get(v.id)
          return status ? { ...v, knowledgeStatus: status } : v
        }),
      )
      return { ok: true }
    },
    [canManageVersionKnowledge, versionKnowledges, versions],
  )

  const confirmVersionKnowledge = useCallback(
    (record: VersionKnowledgeRecord): { ok: true } | Fail => {
      const gate = canManageVersionKnowledge(record.versionId)
      if (!gate.ok) return gate
      const ver = gate.version
      const orderedIds = orderedVersionIdsForSoftware(versions, ver.softwareId)
      const inScope = databases.filter(
        (d) =>
          d.softwareId === ver.softwareId &&
          isDatabaseInVersion(d, ver.id, orderedIds),
      )
      const knowledgeForCheck = versionKnowledges.some(
        (k) => k.versionId === record.versionId,
      )
        ? versionKnowledges.map((k) =>
            k.versionId === record.versionId ? record : k,
          )
        : [record, ...versionKnowledges]
      const missing = inScope.filter(
        (d) =>
          !hasEffectiveActiveDocs(
            record,
            d.id,
            orderedIds,
            knowledgeForCheck,
          ),
      )
      if (missing.length) {
        const names = missing.map((d) => d.name).join('، ')
        return fail(
          `قبل از تایید نهایی، هر دیتابیس باید مستند فعال در این نسخه یا نسخهٔ قبلی داشته باشد. بدون مستند: ${names}`,
        )
      }
      const existing = versionKnowledges.find(
        (k) => k.versionId === record.versionId,
      )
      const next: VersionKnowledgeRecord = {
        ...record,
        description: record.description ?? '',
        analysis: record.analysis ?? '',
        selectedDatabaseIds: record.selectedDatabaseIds ?? [],
        databaseDocs: record.databaseDocs ?? [],
        confirmed: true,
        confirmedAt: existing?.confirmed
          ? existing.confirmedAt
          : faToday(),
      }
      const exists = Boolean(existing)
      persistVersionKnowledges(
        exists
          ? versionKnowledges.map((k) =>
              k.versionId === next.versionId ? next : k,
            )
          : [next, ...versionKnowledges],
      )
      applyKnowledgeToVersions(next, 'complete')
      return { ok: true }
    },
    [
      canManageVersionKnowledge,
      versions,
      databases,
      versionKnowledges,
      applyKnowledgeToVersions,
    ],
  )

  const databasesForSoftware = useCallback(
    (softwareId: string) => databases.filter((d) => d.softwareId === softwareId),
    [databases],
  )

  const upsertDatabase = useCallback(
    async (db: SoftwareDatabase): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      if (tier !== 'company' && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط شرکت نرم‌افزاری می‌تواند دیتابیس تعریف کند.')
      }
      const sw = softwares.find((s) => s.id === db.softwareId)
      if (!sw) return fail('نرم‌افزار والد یافت نشد.', { softwareId: 'نرم‌افزار را انتخاب کنید.' })
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط مالک نرم‌افزار می‌تواند دیتابیس آن را مدیریت کند.')
      }
      const fields: Record<string, string> = {}
      if (!db.softwareId) fields.softwareId = 'انتخاب نرم‌افزار الزامی است.'
      if (!db.name.trim()) fields.name = 'نام دیتابیس الزامی است.'
      if (!db.code.trim()) fields.code = 'کد دیتابیس الزامی است.'
      if (
        db.introducedInVersionId &&
        db.removedInVersionId &&
        db.introducedInVersionId === db.removedInVersionId
      ) {
        fields.removedInVersionId =
          'نسخهٔ حذف نمی‌تواند همان نسخهٔ معرفی باشد.'
      }
      if (Object.keys(fields).length) {
        return fail('لطفاً فیلدهای الزامی را تکمیل کنید.', fields)
      }
      const exists = databases.some((d) => d.id === db.id)
      const codeDup = databases.find(
        (d) =>
          d.softwareId === db.softwareId &&
          d.code.trim().toLowerCase() === db.code.trim().toLowerCase() &&
          d.id !== db.id,
      )
      if (codeDup) {
        return fail('کد دیتابیس در این نرم‌افزار تکراری است.', {
          code: 'کد تکراری است.',
        })
      }
      const next: SoftwareDatabase = {
        ...db,
        name: db.name.trim(),
        code: db.code.trim(),
        description: db.description?.trim() || undefined,
        introducedInVersionId: db.introducedInVersionId || undefined,
        removedInVersionId: db.removedInVersionId || undefined,
      }
      if (!activeTenantId) return fail('محدوده فعال مشخص نیست.')
      try { const saved=await catalogApi.saveDatabase(db.softwareId,{tenantId:activeTenantId,organizationId:activeOrganizationId,code:db.code,name:db.name,dialect:db.dialect??'unspecified',introducedVersionId:db.introducedInVersionId,removedVersionId:db.removedInVersionId,active:db.status==='active',version:db.rowVersion??0},exists?db.id:undefined); next.id=saved.id; next.rowVersion=saved.version } catch(error){return fail(error instanceof Error?error.message:'ذخیره دیتابیس ناموفق بود.')}
      persistDatabases(
        exists
          ? databases.map((d) => (d.id === next.id ? next : d))
          : [next, ...databases],
      )
      return { ok: true }
    },
    [user, tier, softwares, databases, activeTenantId, activeOrganizationId],
  )

  const deleteDatabase = useCallback(
    async (databaseId: string): Promise<{ ok: true } | Fail> => {
      if (!user) return fail('نشست معتبر نیست.')
      const db = databases.find((d) => d.id === databaseId)
      if (!db) return fail('دیتابیس یافت نشد.')
      const sw = softwares.find((s) => s.id === db.softwareId)
      if (!sw) return fail('نرم‌افزار والد یافت نشد.')
      if (sw.ownerUserId !== user.id && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('اجازه حذف این دیتابیس را ندارید.')
      }
      if (!activeTenantId) return fail('محدوده فعال مشخص نیست.')
      try { await catalogApi.deleteDatabase(db.softwareId,databaseId,activeTenantId,activeOrganizationId,db.rowVersion??0) } catch(error){return fail(error instanceof Error?error.message:'حذف دیتابیس ناموفق بود.')}
      persistDatabases(databases.filter((d) => d.id !== databaseId))
      return { ok: true as const }
    },
    [user, softwares, databases, activeTenantId, activeOrganizationId],
  )

  const upsertMembership = useCallback(
    (m: SoftwareMembership) => {
      const exists = memberships.some((x) => x.id === m.id)
      const dup = memberships.find(
        (x) =>
          x.softwareId === m.softwareId &&
          x.userId === m.userId &&
          x.kind === m.kind &&
          x.id !== m.id,
      )
      if (dup) return fail('این نقش قبلاً برای این کاربر روی این نرم‌افزار ثبت شده است.')
      persistMemberships(
        exists ? memberships.map((x) => (x.id === m.id ? m : x)) : [m, ...memberships],
      )
      return { ok: true as const }
    },
    [memberships],
  )

  const removeMembership = useCallback(
    (membershipId: string) => {
      const m = memberships.find((x) => x.id === membershipId)
      if (!m) return fail('عضویت یافت نشد.')
      if (m.kind === 'company_owner') {
        const sw = softwares.find((s) => s.id === m.softwareId)
        if (sw?.ownerUserId === m.userId) {
          return fail('نمی‌توان عضویت مالک نرم‌افزار را حذف کرد.')
        }
      }
      if (tier === 'tenant' && m.kind === 'org_member') {
        if (m.parentTenantUserId !== user?.id) {
          return fail('فقط کاربران سازمان خودتان را می‌توانید حذف کنید.')
        }
      }
      persistMemberships(memberships.filter((x) => x.id !== membershipId))
      return { ok: true as const }
    },
    [memberships, softwares, tier, user],
  )

  const assignUserToSoftware = useCallback(
    (input: {
      softwareId: string
      kinds: MembershipKind[]
      name: string
      username: string
      mobile: string
      email: string
      password: string
      organizationName?: string
      linkedUserId?: string
      supportRoleId?: string
    }) => {
      if (!user || !tier) return fail('نشست معتبر نیست.')
      const kinds = [...new Set(input.kinds)]
      if (!kinds.length) {
        return fail('حداقل یک نقش باید انتخاب شود.', {
          kinds: 'حداقل یک نقش را انتخاب کنید.',
        })
      }
      for (const kind of kinds) {
        if (!canAssignMembership(tier, kind)) {
          return fail('در سلسله‌مراتب فعلی اجازهٔ تخصیص این نوع کاربر را ندارید.')
        }
      }
      if (!canActOnSoftware(input.softwareId)) {
        return fail('به این نرم‌افزار دسترسی ندارید.')
      }
      if (
        kinds.includes('company_owner') &&
        tier !== 'software_owner' &&
        tier !== 'platform'
      ) {
        return fail('فقط مالک نرم‌افزار می‌تواند مالک شرکت نرم‌افزاری تعیین کند.')
      }
      if (kinds.includes('software_owner') && tier !== 'platform') {
        return fail('فقط مالک پلتفرم می‌تواند مالک نرم‌افزار تعیین کند.')
      }

      const sw = softwares.find((s) => s.id === input.softwareId)
      const companyOwnerId =
        tier === 'company' ? user.id : (sw?.ownerUserId ?? user.id)

      let resolvedSupportRoleId: string | undefined
      if (kinds.includes('software_support')) {
        if (tier === 'company') {
          if (!input.supportRoleId) {
            return fail('انتخاب نقش پشتیبان شرکت الزامی است.', {
              supportRoleId: 'یک نقش از نقش‌های شرکت خود انتخاب کنید.',
            })
          }
          const companyRole = roles.find(
            (r) => r.id === input.supportRoleId && r.ownerUserId === user.id,
          )
          if (!companyRole) {
            return fail('نقش انتخاب‌شده متعلق به شرکت شما نیست.', {
              supportRoleId: 'نقش نامعتبر است.',
            })
          }
          resolvedSupportRoleId = companyRole.id
        } else {
          resolvedSupportRoleId = input.supportRoleId || SOFTWARE_SUPPORT_ROLE_ID
        }
      }

      const fields: Record<string, string> = {}
      if (input.mobile.trim() && !isValidMobile(input.mobile)) {
        fields.mobile = 'شماره همراه معتبر نیست (مثال: 09000000000).'
      }
      if (Object.keys(fields).length) {
        return fail('خطاهای فرم را برطرف کنید.', fields)
      }

      const existing =
        (input.linkedUserId
          ? users.find((u) => u.id === input.linkedUserId)
          : undefined) ?? findUserByIdentity(input.username, input.mobile)

      const roleIdForKind = (kind: MembershipKind): string => {
        if (kind === 'software_support' && resolvedSupportRoleId) {
          return resolvedSupportRoleId
        }
        return KIND_DEFAULT_ROLE[kind]
      }

      const addMemberships = (userId: string) => {
        const conflicts = kinds.filter((kind) =>
          membershipExists(memberships, input.softwareId, userId, kind),
        )
        if (conflicts.length) {
          return fail(
            'این کاربر قبلاً با نقش انتخاب‌شده به این نرم‌افزار تخصیص داده شده و تخصیص تکراری مجاز نیست.',
            { kinds: 'نقش تکراری — تخصیص مجدد مجاز نیست.' },
          )
        }

        const addedMems: SoftwareMembership[] = []
        for (const kind of kinds) {
          const roleId = roleIdForKind(kind)
          ensureUserHasRole(userId, roleId, {
            create: {
              name: '',
              username: '',
              mobile: '',
              email: '',
              password: '',
              companyOwnerUserId:
                kind === 'company_owner' || kind === 'software_owner'
                  ? undefined
                  : companyOwnerId,
              organizationName:
                input.organizationName || user.organizationName,
              parentTenantUserId: kind === 'org_member' ? user.id : undefined,
            },
          })

          addedMems.push({
            id: `mem-${input.softwareId}-${userId}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            softwareId: input.softwareId,
            userId,
            kind,
            roleIds: [roleId],
            parentTenantUserId:
              kind === 'org_member' ? user.id : undefined,
          })
        }
        if (kinds.includes('company_owner')) {
          persistSoftwares(
            softwares.map((s) =>
              s.id === input.softwareId ? { ...s, ownerUserId: userId } : s,
            ),
          )
        }
        persistMemberships([...addedMems, ...memberships])
        return { ok: true as const, userId, linked: Boolean(existing) }
      }

      if (existing) {
        if (kinds.includes('org_member')) {
          if (
            existing.parentTenantUserId &&
            existing.parentTenantUserId !== user.id
          ) {
            return fail('این کاربر متعلق به سازمان دیگری است.')
          }
        }
        if (
          existing.companyOwnerUserId &&
          existing.companyOwnerUserId !== companyOwnerId &&
          !kinds.includes('company_owner')
        ) {
          return fail(
            'این کاربر متعلق به شرکت نرم‌افزاری دیگری است و قابل تخصیص/ویرایش نیست.',
            { mobile: 'کاربر شرکت دیگر — تخصیص مجاز نیست.' },
          )
        }
        // کاربر بدون شرکت: فقط اگر هنوز به نرم‌افزار شرکت دیگری وصل نباشد
        if (!existing.companyOwnerUserId && !kinds.includes('company_owner')) {
          const onOtherCompany = memberships.some((m) => {
            if (m.userId !== existing.id) return false
            const otherSw = softwares.find((s) => s.id === m.softwareId)
            return Boolean(otherSw && otherSw.ownerUserId !== companyOwnerId)
          })
          if (onOtherCompany) {
            return fail(
              'این کاربر روی نرم‌افزار شرکت دیگری تخصیص دارد و قابل تخصیص اینجا نیست.',
              { mobile: 'کاربر بین‌شرکتی — تخصیص مجاز نیست.' },
            )
          }
        }
        return addMemberships(existing.id)
      }

      if (!input.name.trim()) fields.name = 'نام الزامی است.'
      if (!input.username.trim()) fields.username = 'نام کاربری الزامی است.'
      if (!input.mobile.trim()) fields.mobile = 'شماره همراه الزامی است.'
      if (!input.password.trim()) fields.password = 'رمز عبور الزامی است.'
      if (Object.keys(fields).length) {
        return fail('برای کاربر جدید همه فیلدها الزامی است.', fields)
      }

      const primaryRole = roleIdForKind(kinds[0]!)
      const created = ensureUserHasRole('', primaryRole, {
        create: {
          name: input.name.trim(),
          username: input.username.trim(),
          mobile: input.mobile.trim(),
          email: input.email.trim(),
          password: input.password,
          organizationName:
            input.organizationName || user.organizationName,
          companyOwnerUserId: kinds.includes('company_owner')
            ? undefined
            : companyOwnerId,
          parentTenantUserId: kinds.includes('org_member') ? user.id : undefined,
        },
      })
      if (!created.ok) return created

      const result = addMemberships(created.userId)
      return result.ok
        ? { ok: true as const, userId: created.userId, linked: false }
        : result
    },
    [
      user,
      tier,
      users,
      roles,
      softwares,
      memberships,
      canActOnSoftware,
      findUserByIdentity,
      ensureUserHasRole,
    ],
  )

  const canEditAssignedUser = useCallback(
    (targetUserId: string) => {
      if (!user) return false
      if (user.roleIds.includes(OWNER_ROLE_ID)) return true
      const target = users.find((u) => u.id === targetUserId)
      if (!target) return false
      if (targetUserId === user.id) return true
      if (tier === 'company') {
        // فقط کاربران متعلق به همین شرکت — نه شرکت دیگر
        return target.companyOwnerUserId === user.id
      }
      return false
    },
    [user, users, tier],
  )

  const allocateManagerTokens = useCallback(
    (targetUserId: string, amount: number, note: string) => {
      if (!user) return fail('نشست معتبر نیست.')
      if (tier !== 'platform' && !user.roleIds.includes(OWNER_ROLE_ID)) {
        return fail('فقط پلتفرم می‌تواند به شرکت‌ها توکن تخصیص دهد.')
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return fail('مقدار نامعتبر است.', {
          amount: 'مقدار باید بزرگ‌تر از صفر باشد.',
        })
      }
      if (!isSoftwareManagerUser(targetUserId)) {
        return fail('فقط به شرکت‌هایی با حداقل یک نرم‌افزار می‌توان توکن داد.', {
          userId: 'کاربر مقصد مالک نرم‌افزار نیست.',
        })
      }
      const target = users.find((u) => u.id === targetUserId)
      if (!target) return fail('کاربر یافت نشد.')

      const patched = patchUserBalances(targetUserId, {
        managerTokenBalance: (target.managerTokenBalance ?? 0) + amount,
      })
      if (!patched.ok) return patched

      persistLedger([
        {
          id: `tl-${Date.now()}`,
          userId: targetUserId,
          userName: target.name,
          amount,
          type: 'charge',
          purpose: 'manager',
          date: faToday(),
          note: note.trim() || 'تخصیص توکن به شرکت نرم‌افزاری',
          actorUserId: user.id,
        },
        ...tokenLedger,
      ])
      return { ok: true as const }
    },
    [user, tier, users, isSoftwareManagerUser, patchUserBalances, tokenLedger],
  )

  const selfChargeEndUser = useCallback(
    (amount: number, note: string) => {
      if (!user) return fail('نشست معتبر نیست.')
      if (tier !== 'tenant') return fail('فقط کاربر نهایی (IT سازمان) می‌تواند خودشارژ کند.')
      if (!Number.isFinite(amount) || amount <= 0) {
        return fail('مقدار نامعتبر است.', {
          amount: 'مقدار باید بزرگ‌تر از صفر باشد.',
        })
      }
      const patched = patchUserBalances(user.id, {
        endUserTokenBalance: (user.endUserTokenBalance ?? 0) + amount,
      })
      if (!patched.ok) return patched
      persistLedger([
        {
          id: `tl-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          amount,
          type: 'charge',
          purpose: 'end_user',
          date: faToday(),
          note: note.trim() || 'شارژ از درگاه (دمو)',
          actorUserId: user.id,
        },
        ...tokenLedger,
      ])
      return { ok: true as const }
    },
    [user, tier, patchUserBalances, tokenLedger],
  )

  const chargeSoftwareEndUser = useCallback(
    (
      softwareId: string,
      targetUserId: string,
      amount: number,
      note: string,
    ) => {
      if (!user) return fail('نشست معتبر نیست.')
      const sw = softwares.find((s) => s.id === softwareId)
      if (!sw) return fail('نرم‌افزار یافت نشد.', { softwareId: 'نرم‌افزار را انتخاب کنید.' })
      const owns =
        sw.ownerUserId === user.id || user.roleIds.includes(OWNER_ROLE_ID)
      if (!owns) {
        return fail('فقط مالک نرم‌افزار می‌تواند کاربران آن را شارژ کند.')
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return fail('مقدار نامعتبر است.', {
          amount: 'مقدار باید بزرگ‌تر از صفر باشد.',
        })
      }
      const isEndUser = memberships.some(
        (m) =>
          m.softwareId === softwareId &&
          m.userId === targetUserId &&
          m.kind === 'end_user',
      )
      if (!isEndUser) {
        return fail('کاربر انتخاب‌شده کاربر نهایی این نرم‌افزار نیست.', {
          userId: 'کاربر نامعتبر است.',
        })
      }
      const target = users.find((u) => u.id === targetUserId)
      if (!target) return fail('کاربر یافت نشد.', { userId: 'کاربر را انتخاب کنید.' })

      const patched = patchUserBalances(targetUserId, {
        endUserTokenBalance: (target.endUserTokenBalance ?? 0) + amount,
      })
      if (!patched.ok) return patched

      persistLedger([
        {
          id: `tl-${Date.now()}`,
          userId: targetUserId,
          userName: target.name,
          amount,
          type: 'charge',
          purpose: 'end_user',
          softwareId,
          date: faToday(),
          note: note.trim() || `شارژ توسط مالک «${sw.name}»`,
          actorUserId: user.id,
        },
        ...tokenLedger,
      ])
      return { ok: true as const }
    },
    [user, softwares, memberships, users, patchUserBalances, tokenLedger],
  )

  const createApiKey = useCallback(
    (softwareId: string, forUserId?: string) => {
      if (!user) return fail('نشست معتبر نیست.')

      const isOwnerActor =
        tier === 'platform' ||
        tier === 'software_owner' ||
        tier === 'company'

      if (isOwnerActor) {
        const peers = resolveApiKeyPeerUsers({
          actor: user,
          tier,
          users,
          memberships,
          accessibleSoftwares,
        })
        const targetId = forUserId ?? user.id
        if (!canManageApiKeyForUser(user, tier, targetId, peers)) {
          return fail(
            tier === 'platform' || tier === 'software_owner'
              ? 'فقط برای خودتان یا کاربران هم‌سطح می‌توانید کلید بسازید.'
              : 'در این نقش فقط برای خودتان می‌توانید کلید بسازید.',
          )
        }
        const canAccess = accessibleSoftwares.some((s) => s.id === softwareId)
        if (!canAccess) return fail('به این نرم‌افزار دسترسی ندارید.')
        const target = users.find((u) => u.id === targetId) ?? user
        const raw = `bk_live_${Math.random().toString(36).slice(2, 10)}${Math.random()
          .toString(36)
          .slice(2, 8)}`
        const record: ApiKeyRecord = {
          id: `ak-${Date.now()}`,
          userId: targetId,
          userName: target.name,
          softwareId,
          keyMasked: `${raw.slice(0, 8)}••••••••${raw.slice(-4)}`,
          allocatedTokens: 0,
          createdAt: faToday(),
          lastUsedAt: '—',
          status: 'active',
          createdByTenantUserId: user.id,
        }
        persistApiKeys([record, ...apiKeys])
        return { ok: true as const, keyFull: raw, record }
      }

      if (tier !== 'tenant') {
        return fail('صدور API Key فقط توسط IT سازمان یا مالکین مجاز انجام می‌شود.')
      }
      const targetId = forUserId ?? user.id
      const isSelf = targetId === user.id
      const isOrgChild = memberships.some(
        (m) =>
          m.kind === 'org_member' &&
          m.userId === targetId &&
          m.softwareId === softwareId &&
          m.parentTenantUserId === user.id,
      )
      const tenantOnSoftware = memberships.some(
        (m) =>
          m.userId === user.id &&
          m.softwareId === softwareId &&
          m.kind === 'end_user',
      )
      if (!tenantOnSoftware) return fail('شما عضو این نرم‌افزار نیستید.')
      if (!isSelf && !isOrgChild) {
        return fail('فقط برای کاربران سازمان خودتان می‌توانید کلید بسازید.')
      }
      const target = users.find((u) => u.id === targetId) ?? user
      const raw = `bk_live_${Math.random().toString(36).slice(2, 10)}${Math.random()
        .toString(36)
        .slice(2, 8)}`
      const record: ApiKeyRecord = {
        id: `ak-${Date.now()}`,
        userId: targetId,
        userName: target.name,
        softwareId,
        keyMasked: `${raw.slice(0, 8)}••••••••${raw.slice(-4)}`,
        allocatedTokens: 0,
        createdAt: faToday(),
        lastUsedAt: '—',
        status: 'active',
        createdByTenantUserId: user.id,
      }
      persistApiKeys([record, ...apiKeys])
      return { ok: true as const, keyFull: raw, record }
    },
    [user, tier, memberships, users, apiKeys, accessibleSoftwares],
  )

  const apiKeyPeers = useMemo(() => {
    if (!user || !tier) return []
    return resolveApiKeyPeerUsers({
      actor: user,
      tier,
      users,
      memberships,
      accessibleSoftwares,
    })
  }, [user, tier, users, memberships, accessibleSoftwares])

  const allocateTokensToApiKey = useCallback(
    (apiKeyId: string, amount: number) => {
      if (!user) return fail('نشست معتبر نیست.')
      const isOwnerActor =
        tier === 'platform' ||
        tier === 'software_owner' ||
        tier === 'company'
      if (tier !== 'tenant' && !isOwnerActor) {
        return fail('فقط IT سازمان یا مالکین مجاز می‌توانند توکن اختصاص دهند.')
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return fail('مقدار نامعتبر است.', {
          amount: 'مقدار باید بزرگ‌تر از صفر باشد.',
        })
      }
      const key = apiKeys.find((k) => k.id === apiKeyId)
      if (!key) return fail('کلید یافت نشد.')
      if (tier === 'tenant' && key.createdByTenantUserId !== user.id) {
        return fail('کلید یافت نشد یا متعلق به سازمان شما نیست.')
      }
      if (isOwnerActor) {
        const peers = resolveApiKeyPeerUsers({
          actor: user,
          tier,
          users,
          memberships,
          accessibleSoftwares,
        })
        const inScope =
          canManageApiKeyForUser(user, tier, key.userId, peers) ||
          key.createdByTenantUserId === user.id
        if (!inScope) {
          return fail('کلید در دامنهٔ هم‌سطح شما نیست.')
        }
      }
      if (key.status !== 'active') return fail('کلید فعال نیست.')

      const useManagerBalance =
        isOwnerActor &&
        (tier === 'company' ||
          tier === 'platform' ||
          (user.endUserTokenBalance ?? 0) <= 0)
      const balance = useManagerBalance
        ? (user.managerTokenBalance ?? 0)
        : (user.endUserTokenBalance ?? 0)
      if (amount > balance) {
        return fail('موجودی کیف کافی نیست.', { amount: 'موجودی کافی نیست.' })
      }
      const patched = patchUserBalances(
        user.id,
        useManagerBalance
          ? { managerTokenBalance: balance - amount }
          : { endUserTokenBalance: balance - amount },
      )
      if (!patched.ok) return patched
      persistApiKeys(
        apiKeys.map((k) =>
          k.id === apiKeyId
            ? { ...k, allocatedTokens: k.allocatedTokens + amount }
            : k,
        ),
      )
      persistLedger([
        {
          id: `tl-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          amount,
          type: 'allocate',
          purpose: 'api_key',
          softwareId: key.softwareId,
          apiKeyId,
          date: faToday(),
          note: `اختصاص به ${key.keyMasked}`,
          actorUserId: user.id,
        },
        ...tokenLedger,
      ])
      return { ok: true as const }
    },
    [user, tier, apiKeys, patchUserBalances, tokenLedger, users, memberships, accessibleSoftwares],
  )

  const revokeApiKey = useCallback(
    (apiKeyId: string) => {
      if (!user) return fail('نشست معتبر نیست.')
      const key = apiKeys.find((k) => k.id === apiKeyId)
      if (!key) return fail('کلید یافت نشد.')
      let allowed =
        key.createdByTenantUserId === user.id ||
        key.userId === user.id ||
        user.roleIds.includes(OWNER_ROLE_ID)
      if (
        !allowed &&
        (tier === 'platform' || tier === 'software_owner')
      ) {
        const peers = resolveApiKeyPeerUsers({
          actor: user,
          tier,
          users,
          memberships,
          accessibleSoftwares,
        })
        allowed = canManageApiKeyForUser(user, tier, key.userId, peers)
      }
      if (!allowed) return fail('اجازه ابطال این کلید را ندارید.')
      persistApiKeys(
        apiKeys.map((k) =>
          k.id === apiKeyId ? { ...k, status: 'inactive' as const } : k,
        ),
      )
      return { ok: true as const }
    },
    [user, apiKeys, tier, users, memberships, accessibleSoftwares],
  )

  const assertPlatformOwnerMutate = (): Fail | null => {
    if (!user) return fail('نشست معتبر نیست.')
    if (!user.roleIds.includes(OWNER_ROLE_ID)) {
      return fail('فقط مالک پلتفرم می‌تواند تنظیمات مدل AI را تغییر دهد.')
    }
    return null
  }

  const defaultAiProvider = useMemo(() => {
    const preferred = aiProviders.find((p) => p.isDefault && p.isActive)
    if (preferred) return preferred
    return aiProviders.find((p) => p.isDefault) ?? null
  }, [aiProviders])

  const upsertAiProvider = useCallback(
    (provider: AiProviderConfig): { ok: true } | Fail => {
      const denied = assertPlatformOwnerMutate()
      if (denied) return denied
      const name = provider.name.trim()
      const baseUrl = provider.baseUrl.trim()
      const modelName = provider.modelName.trim()
      if (!name) {
        return fail('نام الزامی است.', { name: 'نام را وارد کنید.' })
      }
      if (!baseUrl) {
        return fail('آدرس پایه الزامی است.', { baseUrl: 'آدرس پایه را وارد کنید.' })
      }
      if (!modelName) {
        return fail('نام مدل الزامی است.', { modelName: 'نام مدل را وارد کنید.' })
      }
      const now = new Date().toISOString()
      const existing = aiProviders.find((p) => p.id === provider.id)
      const isFirst = aiProviders.length === 0
      let nextDefault = Boolean(provider.isDefault) || isFirst
      // اگر تنها ارائه‌دهندهٔ فعال پیش‌فرض را غیرفعال می‌کنیم، پیش‌فرض را نگه دار
      if (!existing && !nextDefault && !aiProviders.some((p) => p.isDefault)) {
        nextDefault = true
      }

      const record: AiProviderConfig = {
        ...provider,
        name,
        baseUrl,
        modelName,
        apiKey: provider.apiKey.trim(),
        isDefault: nextDefault,
        createdAt: existing?.createdAt ?? provider.createdAt ?? now,
        updatedAt: now,
      }

      let next = existing
        ? aiProviders.map((p) => (p.id === record.id ? record : p))
        : [record, ...aiProviders]

      if (record.isDefault) {
        next = next.map((p) =>
          p.id === record.id ? p : { ...p, isDefault: false },
        )
      } else if (!next.some((p) => p.isDefault) && next.length > 0) {
        // همیشه یک پیش‌فرض داشته باشیم
        next = next.map((p, i) => ({ ...p, isDefault: i === 0 }))
      }

      persistAiProviders(next)
      return { ok: true as const }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assertPlatformOwnerMutate بسته به user
    [user, aiProviders],
  )

  const deleteAiProvider = useCallback(
    (providerId: string): { ok: true } | Fail => {
      const denied = assertPlatformOwnerMutate()
      if (denied) return denied
      const target = aiProviders.find((p) => p.id === providerId)
      if (!target) return fail('ارائه‌دهنده یافت نشد.')
      let next = aiProviders.filter((p) => p.id !== providerId)
      if (target.isDefault && next.length > 0 && !next.some((p) => p.isDefault)) {
        const promote =
          next.find((p) => p.isActive)?.id ?? next[0]?.id
        next = next.map((p) => ({ ...p, isDefault: p.id === promote }))
      }
      persistAiProviders(next)
      return { ok: true as const }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, aiProviders],
  )

  const setDefaultAiProvider = useCallback(
    (providerId: string): { ok: true } | Fail => {
      const denied = assertPlatformOwnerMutate()
      if (denied) return denied
      const target = aiProviders.find((p) => p.id === providerId)
      if (!target) return fail('ارائه‌دهنده یافت نشد.')
      if (!target.isActive) {
        return fail('فقط ارائه‌دهندهٔ فعال می‌تواند پیش‌فرض باشد.')
      }
      const now = new Date().toISOString()
      persistAiProviders(
        aiProviders.map((p) => ({
          ...p,
          isDefault: p.id === providerId,
          updatedAt: p.id === providerId ? now : p.updatedAt,
        })),
      )
      return { ok: true as const }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, aiProviders],
  )

  const setAiProviderConnectionStatus = useCallback(
    (
      providerId: string,
      status: NonNullable<AiProviderConfig['status']>,
    ): { ok: true } | Fail => {
      const denied = assertPlatformOwnerMutate()
      if (denied) return denied
      if (!aiProviders.some((p) => p.id === providerId)) {
        return fail('ارائه‌دهنده یافت نشد.')
      }
      const now = new Date().toISOString()
      persistAiProviders(
        aiProviders.map((p) =>
          p.id === providerId ? { ...p, status, updatedAt: now } : p,
        ),
      )
      return { ok: true as const }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, aiProviders],
  )

  const managerLedger = useMemo(
    () => tokenLedger.filter((e) => e.purpose === 'manager'),
    [tokenLedger],
  )

  const endUserLedgerFor = useCallback(
    (userId: string) =>
      tokenLedger.filter(
        (e) =>
          e.userId === userId &&
          (e.purpose === 'end_user' || e.purpose === 'api_key'),
      ),
    [tokenLedger],
  )

  const value = useMemo(
    () => ({
      softwares,
      versions,
      databases,
      memberships,
      tokenLedger,
      apiKeys,
      actorTier: tier,
      ownedSoftwares,
      accessibleSoftwares,
      isSoftwareManagerUser,
      softwareManagers,
      membershipsForSoftware,
      usersOfKindForSoftware,
      databasesForSoftware,
      versionsForSoftware,
      upsertSoftware,
      deleteSoftware,
      upsertVersion,
      deleteVersion,
      versionKnowledges,
      getVersionKnowledge,
      upsertVersionKnowledge,
      upsertVersionKnowledges,
      confirmVersionKnowledge,
      upsertDatabase,
      deleteDatabase,
      upsertMembership,
      removeMembership,
      assignUserToSoftware,
      allocateManagerTokens,
      selfChargeEndUser,
      chargeSoftwareEndUser,
      createApiKey,
      allocateTokensToApiKey,
      revokeApiKey,
      apiKeyPeerUsers: apiKeyPeers,
      managerLedger,
      endUserLedgerFor,
      orgMembersForTenant,
      canEditAssignedUser,
      aiProviders,
      defaultAiProvider,
      upsertAiProvider,
      deleteAiProvider,
      setDefaultAiProvider,
      setAiProviderConnectionStatus,
    }),
    [
      softwares,
      versions,
      databases,
      memberships,
      tokenLedger,
      apiKeys,
      tier,
      ownedSoftwares,
      accessibleSoftwares,
      isSoftwareManagerUser,
      softwareManagers,
      membershipsForSoftware,
      usersOfKindForSoftware,
      databasesForSoftware,
      versionsForSoftware,
      upsertSoftware,
      deleteSoftware,
      upsertVersion,
      deleteVersion,
      versionKnowledges,
      getVersionKnowledge,
      upsertVersionKnowledge,
      upsertVersionKnowledges,
      confirmVersionKnowledge,
      upsertDatabase,
      deleteDatabase,
      upsertMembership,
      removeMembership,
      assignUserToSoftware,
      allocateManagerTokens,
      selfChargeEndUser,
      chargeSoftwareEndUser,
      createApiKey,
      allocateTokensToApiKey,
      revokeApiKey,
      apiKeyPeers,
      managerLedger,
      endUserLedgerFor,
      orgMembersForTenant,
      canEditAssignedUser,
      aiProviders,
      defaultAiProvider,
      upsertAiProvider,
      deleteAiProvider,
      setDefaultAiProvider,
      setAiProviderConnectionStatus,
    ],
  )

  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>
}

export function useDomain() {
  const ctx = useContext(DomainContext)
  if (!ctx) throw new Error('useDomain must be used within DomainProvider')
  return ctx
}
