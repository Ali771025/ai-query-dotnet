import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  PasswordReset,
  Role,
  Session,
  SystemUser,
  Workspace,
} from '../types/rbac'
import {
  seedRoles,
  seedUsers,
  OWNER_ROLE_ID,
  PLATFORM_SUPPORT_ROLE_ID,
  SOFTWARE_COMPANY_ROLE_ID,
  SOFTWARE_OWNER_ROLE_ID,
  END_USER_ROLE_ID,
  RBAC_SCHEMA_VERSION,
  OWNER_TRANSFER_DEMO_OTP,
  purgeCompanyDefaultRoles,
  remapPurgedCompanyDefaultRoleId,
} from '../data/seed'
import {
  ALL_PERMISSION_IDS,
  companyAssignablePermissionIds,
  platformAssignablePermissionIds,
  softwareOwnerPermissionIds,
} from '../data/permissions'
import { loadJson, removeKey, saveJson } from '../lib/storage'
import {
  defaultPersona,
  normalizeWorkspace,
  personasForUser,
  roleIdsForPersona,
} from '../lib/personas'
import { authApi, type MeDto, type PersonaDto } from '../api/auth'

export function userHasOwnerRole(u: SystemUser): boolean {
  return u.roleIds.includes(OWNER_ROLE_ID)
}

export function countActiveOwners(users: SystemUser[]): number {
  return users.filter((u) => u.status === 'active' && userHasOwnerRole(u)).length
}

function uniqueRoleIds(roleIds: string[]): string[] {
  return [...new Set(roleIds)]
}

/** موبایل ایران: 09xxxxxxxxx */
export function isValidMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(mobile.trim())
}

function withBalances(u: SystemUser): SystemUser {
  return {
    ...u,
    managerTokenBalance: u.managerTokenBalance ?? 0,
    endUserTokenBalance: u.endUserTokenBalance ?? 0,
  }
}

function ensureAtLeastOneOwner(users: SystemUser[]): SystemUser[] {
  if (countActiveOwners(users) >= 1) return users
  const fallback =
    users.find((u) => u.id === 'user-owner') ?? users.find((u) => u.status === 'active')
  if (!fallback) return users
  return users.map((u) =>
    u.id === fallback.id
      ? {
          ...withBalances(u),
          status: 'active' as const,
          roleIds: u.roleIds.includes(OWNER_ROLE_ID)
            ? u.roleIds
            : [...u.roleIds, OWNER_ROLE_ID],
        }
      : withBalances(u),
  )
}

type AuthFail = {
  ok: false
  message: string
  field?: string
  fields?: Record<string, string>
}

type LoginOk =
  | { ok: true }
  | {
      ok: true
      requiresPersonaSelection: true
      personas: Workspace[]
      pendingUserId: string
    }

type AuthContextValue = {
  user: SystemUser | null
  roles: Role[]
  users: SystemUser[]
  permissions: string[]
  isAuthenticated: boolean
  activeWorkspace: Workspace
  activeSoftwareId: string | null
  activeTenantId: string | null
  activeOrganizationId: string | null
  availableWorkspaces: Workspace[]
  /** نقش‌های مؤثر نشست (پس از انتخاب پرسونا) */
  sessionRoleIds: string[]
  setWorkspace: (ws: Workspace) => void
  setActiveSoftwareId: (id: string | null) => void
  login: (username: string, password: string) => Promise<LoginOk | AuthFail>
  selectLoginPersona: (workspace: Workspace) => Promise<{ ok: true } | AuthFail>
  cancelPersonaSelection: () => void
  pendingPersonaUserId: string | null
  logout: () => Promise<void>
  hasPermission: (permissionId: string) => boolean
  requestPasswordReset: (
    usernameOrMobile: string,
  ) => { ok: true; message: string; demoToken?: string }
  resetPassword: (token: string, newPassword: string) => { ok: true } | AuthFail
  upsertUser: (user: SystemUser) => { ok: true } | AuthFail
  deleteUser: (userId: string) => { ok: true } | AuthFail
  upsertRole: (role: Role) => { ok: true } | AuthFail
  deleteRole: (roleId: string) => { ok: true } | { ok: false; message: string }
  getRoleNames: (roleIds: string[]) => string[]
  transferOwnership: (
    targetUserId: string,
    password: string,
    otp: string,
  ) => { ok: true } | AuthFail
  patchUserBalances: (
    userId: string,
    patch: Partial<Pick<SystemUser, 'managerTokenBalance' | 'endUserTokenBalance'>>,
  ) => { ok: true } | AuthFail
  findUserByIdentity: (username: string, mobile: string) => SystemUser | undefined
  ensureUserHasRole: (
    userId: string,
    roleId: string,
    opts?: {
      create?: {
        name: string
        username: string
        mobile: string
        email: string
        password: string
        organizationName?: string
        companyOwnerUserId?: string
        parentTenantUserId?: string
      }
    },
  ) => { ok: true; userId: string } | AuthFail
  /** آیا نقش برای ویرایش توسط کاربر جاری مجاز است */
  canEditRole: (role: Role) => boolean
  /** مجوزهای قابل تفویض توسط کاربر جاری */
  grantablePermissionIds: string[]
  /** آیا کاربر هدف در محدودهٔ مدیریت شرکت جاری است */
  canManageSystemUser: (targetUserId: string) => boolean
  /** کاربران قابل‌نمایش/مدیریت برای کاربر جاری */
  manageableUsers: SystemUser[]
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * افزودن حساب‌های seed گم‌شده بر اساس id — بدون wipe کاربران موجود.
 * برای دمو چندنقشی، نقش‌های SOFTWARE_OWNER + END_USER را روی user-software-owner تضمین می‌کند.
 */
function ensureSeedUsersMerged(users: SystemUser[]): {
  users: SystemUser[]
  changed: boolean
} {
  let changed = false
  let next = users.map(withBalances)

  for (const seedUser of seedUsers) {
    if (!next.some((u) => u.id === seedUser.id)) {
      next.push(withBalances(seedUser))
      changed = true
    }
  }

  next = next.map((u) => {
    if (u.id !== 'user-software-owner') return u
    const roleIds = uniqueRoleIds([
      ...u.roleIds,
      SOFTWARE_OWNER_ROLE_ID,
      END_USER_ROLE_ID,
    ])
    if (roleIds.some((id) => !u.roleIds.includes(id))) {
      changed = true
      return { ...u, roleIds }
    }
    return u
  })

  const ensured = ensureAtLeastOneOwner(next)
  if (ensured !== next) changed = true
  return { users: ensured, changed }
}

function ensureSeed() {
  const schemaVersion = loadJson<number>('rbacSchemaVersion', 0)

  // فقط اگر کلید وجود نداشته باشد seed کن — آرایهٔ خالی عمدی کاربر را دست نزن
  let users = loadJson<SystemUser[] | null>('users', null)
  if (users === null) {
    users = seedUsers
    saveJson('users', users)
  } else {
    // حتی وقتی اسکیما از قبل جاری است، حساب‌های seed گم‌شده (مثل swowner) را ادغام کن
    const merged = ensureSeedUsersMerged(users)
    users = merged.users
    if (merged.changed) saveJson('users', users)
  }

  let roles = loadJson<Role[] | null>('roles', null)
  if (roles === null) {
    roles = seedRoles
    saveJson('roles', roles)
    saveJson('rbacSchemaVersion', RBAC_SCHEMA_VERSION)
    removeKey('companyRolesBootstrapped')
    return
  }

  // فقط هنگام ارتقای اسکیما، نقش‌های سیستمی را یک‌بار هم‌تراز کن — نه در هر رفرش
  if (schemaVersion < RBAC_SCHEMA_VERSION) {
    const seedById = new Map(seedRoles.map((r) => [r.id, r]))
    let nextRoles = roles.map((r) => {
      if (r.id === OWNER_ROLE_ID) {
        return { ...r, permissionIds: [...ALL_PERMISSION_IDS], isSystem: true }
      }
      const seed = seedById.get(r.id)
      if (seed) {
        if (seed.isSystem) {
          return {
            ...r,
            ...seed,
            permissionIds: withSplitMenuPermissions(
              seed.permissionIds.filter((id) => ALL_PERMISSION_IDS.includes(id)),
            ),
          }
        }
        // نقش سفارشی پلتفرم (مثل پشتیبان کیان) — هم‌تراز نام/توضیح seed بدون اجبار isSystem
        if (r.id === PLATFORM_SUPPORT_ROLE_ID) {
          return {
            ...r,
            name: seed.name,
            description: seed.description,
            isSystem: false,
            createdByUserId: r.createdByUserId ?? seed.createdByUserId,
            permissionIds: withSplitMenuPermissions(
              (r.permissionIds.length ? r.permissionIds : seed.permissionIds).filter(
                (id) => ALL_PERMISSION_IDS.includes(id),
              ),
            ),
          }
        }
        // نقش سفارشی شرکت در seed (مثل پشتیبان دمو نمونه)
        if (seed.ownerUserId) {
          return {
            ...r,
            ...seed,
            permissionIds: withSplitMenuPermissions(
              seed.permissionIds.filter((id) => ALL_PERMISSION_IDS.includes(id)),
            ),
          }
        }
      }
      return {
        ...r,
        permissionIds: withSplitMenuPermissions(
          r.permissionIds.filter((id) => ALL_PERMISSION_IDS.includes(id)),
        ),
        ownerUserId: r.ownerUserId,
      }
    })
    for (const seed of seedRoles) {
      if (!nextRoles.some((r) => r.id === seed.id)) nextRoles.push(seed)
    }

    const purged = purgeCompanyDefaultRoles(nextRoles)
    nextRoles = purged.roles
    const { purgedIds } = purged

    let { users: nextUsers } = ensureSeedUsersMerged(users)
    nextUsers = nextUsers.map((u) => ({
      ...u,
      roleIds: uniqueRoleIds(
        u.roleIds.map((id) => remapPurgedCompanyDefaultRoleId(id, purgedIds)),
      ),
    }))

    const memberships = loadJson<{ id: string; roleIds: string[] }[] | null>(
      'memberships',
      null,
    )
    if (memberships !== null) {
      saveJson(
        'memberships',
        memberships.map((m) => ({
          ...m,
          roleIds: m.roleIds.map((id) =>
            remapPurgedCompanyDefaultRoleId(id, purgedIds),
          ),
        })),
      )
    }

    saveJson('users', nextUsers)
    saveJson('roles', nextRoles)
    saveJson('rbacSchemaVersion', RBAC_SCHEMA_VERSION)
    removeKey('companyRolesBootstrapped')
  }
}

/** وقتی منویی جدا می‌شود، نقش‌هایی که دسترسی قبلی را داشتند دسترسی جدید را هم بگیرند */
function withSplitMenuPermissions(permissionIds: string[]): string[] {
  const next = [...permissionIds]
  if (
    next.includes('appusers-tokens.view') &&
    !next.includes('appusers-token-history.view') &&
    ALL_PERMISSION_IDS.includes('appusers-token-history.view')
  ) {
    next.push('appusers-token-history.view')
  }
  // منوی تست مدل AI برای مالک نرم‌افزار (بعد از sw-owner-reports)
  if (
    next.includes('sw-reports-advanced.view') &&
    !next.includes('ai-model-test.view') &&
    ALL_PERMISSION_IDS.includes('ai-model-test.view')
  ) {
    next.push('ai-model-test.view')
  }
  // منوی تست مدل AI برای مالک شرکت (نه پشتیبان/نهایی — company-roles فقط برای مالک شرکت)
  if (
    next.includes('company-roles.view') &&
    !next.includes('ai-model-test.view') &&
    ALL_PERMISSION_IDS.includes('ai-model-test.view')
  ) {
    next.push('ai-model-test.view')
  }
  // نقش‌هایی که تست مدل داشتند، منوی جداگانهٔ API Key مالکین را هم بگیرند
  if (next.includes('ai-model-test.view')) {
    for (const action of ['view', 'create', 'edit', 'delete'] as const) {
      const id = `owner-apikeys.${action}`
      if (!next.includes(id) && ALL_PERMISSION_IDS.includes(id)) {
        next.push(id)
      }
    }
  }
  return next
}

ensureSeed()

function rolePermissionsSubset(rolePerms: string[], grantorPerms: string[]): boolean {
  return rolePerms.every((p) => grantorPerms.includes(p))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<SystemUser[]>(() => loadJson('users', []))
  const [roles, setRoles] = useState<Role[]>(() => loadJson('roles', []))
  const [session, setSession] = useState<Session | null>(null)
  const [serverPermissions, setServerPermissions] = useState<string[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [pendingPersonaOptions, setPendingPersonaOptions] = useState<PersonaDto[]>([])
  const [pendingPersonaUserId, setPendingPersonaUserId] = useState<string | null>(null)

  const user = useMemo(
    () => users.find((u) => u.id === session?.userId && u.status === 'active') ?? null,
    [users, session],
  )

  const allPersonas = useMemo(() => personasForUser(user, roles), [user, roles])

  const activeWorkspace: Workspace = useMemo(() => {
    const ws = normalizeWorkspace(session?.activeWorkspace)
    if (ws && allPersonas.includes(ws)) return ws
    return defaultPersona(allPersonas)
  }, [session?.activeWorkspace, allPersonas])

  const sessionRoleIds = useMemo(() => {
    if (!user) return []
    if (session?.loginRoleIds?.length) return session.loginRoleIds
    return roleIdsForPersona(user, roles, activeWorkspace)
  }, [user, roles, session?.loginRoleIds, activeWorkspace])

  const permissions = serverPermissions

  /** پس از ورود، فقط پرسونای انتخاب‌شده در نشست فعال است (جلوگیری از دور زدن) */
  const availableWorkspaces = useMemo((): Workspace[] => {
    if (!user || !session) return []
    const locked = normalizeWorkspace(session.activeWorkspace)
    if (locked && allPersonas.includes(locked)) return [locked]
    return allPersonas
  }, [user, session, allPersonas])

  const activeSoftwareId = session?.activeSoftwareId ?? null

  const sessionHasOwner = sessionRoleIds.includes(OWNER_ROLE_ID)
  const sessionHasSoftwareOwner = sessionRoleIds.includes(SOFTWARE_OWNER_ROLE_ID)
  const sessionHasCompany = sessionRoleIds.includes(SOFTWARE_COMPANY_ROLE_ID)
  const sessionHasPlatformSupport = sessionRoleIds.includes(PLATFORM_SUPPORT_ROLE_ID)

  const persistUsers = (next: SystemUser[]) => {
    setUsers(next)
    saveJson('users', next)
  }

  const persistRoles = (next: Role[]) => {
    setRoles(next)
    saveJson('roles', next)
  }

  const persistSession = (next: Session | null) => {
    setSession(next)
  }

  const applyServerMe = useCallback((me: MeDto) => {
    const mapped: SystemUser = { id: me.userId, username: me.username, password: '', name: me.displayName, email: me.email ?? '', mobile: me.mobile ?? '', roleIds: [], status: 'active', createdAt: '', managerTokenBalance: 0, endUserTokenBalance: 0 }
    setUsers((current) => [mapped, ...current.filter((item) => item.id !== mapped.id)])
    setServerPermissions(me.permissions)
    setActiveTenantId(me.activeTenantId ?? null)
    setActiveOrganizationId(me.activeOrganizationId ?? null)
    const workspace = (me.activePersona ?? undefined) as Workspace | undefined
    setSession({ userId: me.userId, loggedInAt: new Date().toISOString(), activeWorkspace: workspace, activeSoftwareId: me.activeSoftwareId ?? null, loginRoleIds: [] })
    setPendingPersonaOptions(me.availablePersonas)
    return mapped
  }, [])

  useEffect(() => {
    authApi.me().then(applyServerMe).catch(() => { setSession(null); setServerPermissions([]) })
  }, [applyServerMe])

  const setWorkspace = useCallback(
    (ws: Workspace) => {
      if (!session || !user) return
      // قفل پرسونای ورود — تعویض mid-session فقط اگر همان پرسونا باشد
      if (session.activeWorkspace && session.activeWorkspace !== ws) return
      const next: Session = {
        ...session,
        activeWorkspace: ws,
        loginRoleIds: roleIdsForPersona(user, roles, ws),
      }
      persistSession(next)
    },
    [session, user, roles],
  )

  const setActiveSoftwareId = useCallback(
    (id: string | null) => {
      if (!session) return
      persistSession({ ...session, activeSoftwareId: id })
    },
    [session],
  )

  const login = useCallback(
    async (username: string, password: string): Promise<LoginOk | AuthFail> => {
      const fields: Record<string, string> = {}
      if (!username.trim()) fields.username = 'نام کاربری الزامی است.'
      if (!password) fields.password = 'رمز عبور الزامی است.'
      if (Object.keys(fields).length > 0) {
        return {
          ok: false as const,
          message: 'لطفاً فیلدهای الزامی را تکمیل کنید.',
          fields,
        }
      }
      let me: MeDto
      try { me = await authApi.login(username.trim(), password) } catch (error) {
        return {
          ok: false as const,
          message: error instanceof Error ? error.message : 'نام کاربری یا رمز عبور اشتباه است.',
          fields: {
            username: 'نام کاربری یا رمز عبور اشتباه است.',
            password: 'نام کاربری یا رمز عبور اشتباه است.',
          },
        }
      }
      const found = applyServerMe(me)
      const personas = me.availablePersonas.map((item) => item.code as Workspace)
      if (personas.length === 0) {
        return {
          ok: false as const,
          message: 'برای این حساب هیچ نقش ورود معتبری تعریف نشده است.',
        }
      }
      if (personas.length === 1) {
        setPendingPersonaUserId(null)
        if (!me.activePersona) {
          const selected = me.availablePersonas[0]!
          applyServerMe(await authApi.selectPersona(selected))
        }
        return { ok: true as const }
      }
      setPendingPersonaUserId(found.id)
      return {
        ok: true as const,
        requiresPersonaSelection: true,
        personas,
        pendingUserId: found.id,
      }
    },
    [applyServerMe],
  )

  const selectLoginPersona = useCallback(
    async (workspace: Workspace) => {
      if (!pendingPersonaUserId) {
        return { ok: false as const, message: 'ابتدا وارد شوید.' }
      }
      const selected = pendingPersonaOptions.find((item) => item.code === workspace)
      if (!selected) {
        return { ok: false as const, message: 'این نقش برای شما در دسترس نیست.' }
      }
      try { applyServerMe(await authApi.selectPersona(selected)) } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : 'انتخاب نقش ناموفق بود.' } }
      setPendingPersonaUserId(null)
      return { ok: true as const }
    },
    [pendingPersonaUserId, pendingPersonaOptions, applyServerMe],
  )

  const cancelPersonaSelection = useCallback(() => {
    setPendingPersonaUserId(null)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined)
    setPendingPersonaUserId(null)
    persistSession(null)
    setServerPermissions([])
  }, [])

  const hasPermission = useCallback(
    (permissionId: string) => permissions.includes(permissionId),
    [permissions],
  )

  const grantablePermissionIds = useMemo(() => {
    if (!user) return []
    if (sessionHasOwner) return [...ALL_PERMISSION_IDS]
    if (sessionHasSoftwareOwner) {
      return softwareOwnerPermissionIds().filter((id) => permissions.includes(id))
    }
    if (sessionHasCompany) {
      return companyAssignablePermissionIds().filter((id) => permissions.includes(id))
    }
    if (sessionHasPlatformSupport || activeWorkspace === 'platform') {
      return platformAssignablePermissionIds().filter((id) => permissions.includes(id))
    }
    return permissions
  }, [
    user,
    permissions,
    sessionHasOwner,
    sessionHasSoftwareOwner,
    sessionHasCompany,
    sessionHasPlatformSupport,
    activeWorkspace,
  ])

  const canEditRole = useCallback(
    (role: Role) => {
      if (!user) return false
      if (role.id === OWNER_ROLE_ID) return false
      if (role.isSystem) return false
      if (sessionHasOwner) {
        // مالک پلتفرم نقش‌های سفارشی شرکت را از صفحه پلتفرم ویرایش نمی‌کند
        return !role.ownerUserId
      }
      if (sessionHasCompany && role.ownerUserId === user.id) {
        return true
      }
      if (role.createdByUserId === user.id && !role.ownerUserId) return true
      return (
        !role.ownerUserId && rolePermissionsSubset(role.permissionIds, permissions)
      )
    },
    [user, permissions, sessionHasOwner, sessionHasCompany],
  )

  const requestPasswordReset = useCallback(
    (usernameOrMobile: string) => {
      const q = usernameOrMobile.trim()
      const found = users.find(
        (u) =>
          u.username.toLowerCase() === q.toLowerCase() ||
          u.mobile === q ||
          u.mobile === q.replace(/^(\+98|98)/, '0'),
      )
      const generic =
        'اگر حسابی با این مشخصات وجود داشته باشد، پیامک بازیابی به شماره همراه ثبت‌شده ارسال می‌شود.'
      if (!found || found.status !== 'active') {
        return { ok: true as const, message: generic }
      }
      if (!isValidMobile(found.mobile)) {
        return { ok: true as const, message: generic }
      }
      const token = `rst_${Math.random().toString(36).slice(2, 10)}`
      const resets = loadJson<PasswordReset[]>('resets', [])
      const entry: PasswordReset = {
        token,
        userId: found.id,
        username: found.username,
        expiresAt: Date.now() + 1000 * 60 * 30,
      }
      saveJson('resets', [...resets.filter((r) => r.userId !== found.id), entry])
      const masked = `${found.mobile.slice(0, 4)}***${found.mobile.slice(-2)}`
      return {
        ok: true as const,
        message: `${generic} (نمونه: ارسال به ${masked})`,
        demoToken: token,
      }
    },
    [users],
  )

  const resetPassword = useCallback(
    (token: string, newPassword: string) => {
      if (newPassword.length < 8) {
        return {
          ok: false as const,
          message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
          field: 'password',
        }
      }
      const resets = loadJson<PasswordReset[]>('resets', [])
      const entry = resets.find((r) => r.token === token)
      if (!entry || entry.expiresAt < Date.now()) {
        return { ok: false as const, message: 'لینک بازیابی نامعتبر یا منقضی است.' }
      }
      persistUsers(
        users.map((u) => (u.id === entry.userId ? { ...u, password: newPassword } : u)),
      )
      saveJson(
        'resets',
        resets.filter((r) => r.token !== token),
      )
      return { ok: true as const }
    },
    [users],
  )

  const canManageSystemUser = useCallback(
    (targetUserId: string) => {
      if (!user) return false
      if (sessionHasOwner || sessionHasPlatformSupport) {
        return true
      }
      if (targetUserId === user.id) return true
      if (sessionHasSoftwareOwner) {
        const target = users.find((u) => u.id === targetUserId)
        // مالک نرم‌افزار فقط مالک شرکت و پایین‌تر را می‌بیند (نه مالک پلتفرم)
        if (!target) return false
        if (userHasOwnerRole(target)) return false
        return (
          target.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID) ||
          target.roleIds.includes(SOFTWARE_OWNER_ROLE_ID) ||
          Boolean(target.companyOwnerUserId) ||
          target.roleIds.includes(END_USER_ROLE_ID)
        )
      }
      if (sessionHasCompany) {
        const target = users.find((u) => u.id === targetUserId)
        return target?.companyOwnerUserId === user.id
      }
      return false
    },
    [
      user,
      users,
      sessionHasOwner,
      sessionHasPlatformSupport,
      sessionHasSoftwareOwner,
      sessionHasCompany,
    ],
  )

  const manageableUsers = useMemo(() => {
    if (!user) return []
    if (sessionHasOwner || sessionHasPlatformSupport) {
      return users
    }
    if (sessionHasSoftwareOwner) {
      return users.filter(
        (u) =>
          u.id === user.id ||
          (!userHasOwnerRole(u) &&
            (u.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID) ||
              u.roleIds.includes(SOFTWARE_OWNER_ROLE_ID) ||
              Boolean(u.companyOwnerUserId) ||
              u.roleIds.includes(END_USER_ROLE_ID))),
      )
    }
    if (sessionHasCompany) {
      return users.filter(
        (u) => u.id === user.id || u.companyOwnerUserId === user.id,
      )
    }
    return users.filter((u) => u.id === user.id)
  }, [
    user,
    users,
    sessionHasOwner,
    sessionHasPlatformSupport,
    sessionHasSoftwareOwner,
    sessionHasCompany,
  ])

  const upsertUser = useCallback(
    (nextUser: SystemUser) => {
      if (!user) {
        return { ok: false as const, message: 'نشست معتبر نیست.' }
      }
      const fields: Record<string, string> = {}
      const exists = users.some((u) => u.id === nextUser.id)
      const isOwnerGrantor = sessionHasOwner
      const isCompanyActor = sessionHasCompany && !isOwnerGrantor
      const isSoftwareOwnerActor = sessionHasSoftwareOwner && !isOwnerGrantor

      if (exists && !canManageSystemUser(nextUser.id)) {
        return {
          ok: false as const,
          message: 'فقط کاربران شرکت خودتان را می‌توانید مدیریت کنید.',
        }
      }

      if (!nextUser.name.trim()) fields.name = 'نام الزامی است.'
      if (!nextUser.username.trim()) fields.username = 'نام کاربری الزامی است.'

      const mobile = nextUser.mobile.trim()
      if (!mobile) fields.mobile = 'شماره همراه الزامی است.'
      else if (!isValidMobile(mobile)) {
        fields.mobile = 'شماره همراه معتبر نیست (مثال: 09000000000).'
      }

      if (!exists && !nextUser.password.trim()) {
        fields.password = 'رمز عبور الزامی است.'
      }

      let roleIds = uniqueRoleIds(nextUser.roleIds)
      if (isCompanyActor) {
        // شرکت نمی‌تواند نقش پلتفرم/مالک نرم‌افزار/شرکت بدهد
        const blocked = new Set([
          OWNER_ROLE_ID,
          PLATFORM_SUPPORT_ROLE_ID,
          SOFTWARE_OWNER_ROLE_ID,
          SOFTWARE_COMPANY_ROLE_ID,
        ])
        roleIds = roleIds.filter((id) => !blocked.has(id))
        if (!roleIds.length) {
          fields.roleIds = 'حداقل یک نقش مجاز برای شرکت انتخاب کنید.'
        }
      }
      if (isSoftwareOwnerActor) {
        const blocked = new Set([OWNER_ROLE_ID, PLATFORM_SUPPORT_ROLE_ID, SOFTWARE_OWNER_ROLE_ID])
        roleIds = roleIds.filter((id) => !blocked.has(id))
      }
      if (roleIds.includes(OWNER_ROLE_ID) && !isOwnerGrantor) {
        fields.roleIds = 'تفویض نقش مالک مجاز نیست.'
      }
      if (roleIds.includes(SOFTWARE_OWNER_ROLE_ID) && !isOwnerGrantor) {
        fields.roleIds = 'تفویض نقش مالک نرم‌افزار فقط توسط مالک پلتفرم مجاز است.'
      }
      if (!isOwnerGrantor) {
        for (const rid of roleIds) {
          const role = roles.find((r) => r.id === rid)
          if (!role) continue
          if (role.id === OWNER_ROLE_ID) continue
          if (!rolePermissionsSubset(role.permissionIds, permissions)) {
            fields.roleIds =
              'نمی‌توانید نقشی با دسترسی فراتر از دسترسی خودتان تخصیص دهید.'
            break
          }
        }
      }

      if (Object.keys(fields).length > 0) {
        return {
          ok: false as const,
          message: 'لطفاً فیلدهای الزامی را تکمیل کنید.',
          fields,
        }
      }

      const prev = exists ? users.find((u) => u.id === nextUser.id) : undefined
      const sanitized: SystemUser = withBalances({
        ...nextUser,
        mobile,
        roleIds,
        managerTokenBalance: nextUser.managerTokenBalance ?? prev?.managerTokenBalance ?? 0,
        endUserTokenBalance: nextUser.endUserTokenBalance ?? prev?.endUserTokenBalance ?? 0,
        organizationName:
          nextUser.organizationName ??
          (isCompanyActor ? user.organizationName : prev?.organizationName),
        companyOwnerUserId: isCompanyActor
          ? user.id
          : (nextUser.companyOwnerUserId ?? prev?.companyOwnerUserId),
        parentTenantUserId: nextUser.parentTenantUserId ?? prev?.parentTenantUserId,
      })

      const duplicate = users.find(
        (u) =>
          u.username.toLowerCase() === sanitized.username.toLowerCase() &&
          u.id !== sanitized.id,
      )
      if (duplicate) fields.username = 'این نام کاربری قبلاً ثبت شده است.'
      const duplicateMobile = users.find(
        (u) => u.mobile === sanitized.mobile && u.id !== sanitized.id,
      )
      if (duplicateMobile) fields.mobile = 'این شماره همراه قبلاً ثبت شده است.'

      if (Object.keys(fields).length > 0) {
        return {
          ok: false as const,
          message: 'لطفاً خطاهای فرم را برطرف کنید.',
          fields,
        }
      }

      const nextUsers = exists
        ? users.map((u) => (u.id === sanitized.id ? sanitized : u))
        : [sanitized, ...users]

      if (countActiveOwners(nextUsers) < 1) {
        return {
          ok: false as const,
          message:
            'حداقل یک کاربر فعال با نقش مالک باید در سامانه بماند. ابتدا مالک دیگری تعیین کنید.',
          fields: {
            roleIds:
              'حداقل یک کاربر فعال با نقش مالک باید در سامانه بماند. ابتدا مالک دیگری تعیین کنید.',
          },
        }
      }

      persistUsers(nextUsers)

      return { ok: true as const }
    },
    [
      users,
      user,
      roles,
      permissions,
      canManageSystemUser,
      sessionHasOwner,
      sessionHasCompany,
      sessionHasSoftwareOwner,
    ],
  )

  const deleteUser = useCallback(
    (userId: string) => {
      if (userId === user?.id) {
        return { ok: false as const, message: 'امکان حذف کاربر جاری وجود ندارد.' }
      }
      if (!canManageSystemUser(userId)) {
        return {
          ok: false as const,
          message: 'فقط کاربران شرکت خودتان را می‌توانید حذف کنید.',
        }
      }
      const target = users.find((u) => u.id === userId)
      if (!target) return { ok: false as const, message: 'کاربر یافت نشد.' }

      const nextUsers = users.filter((u) => u.id !== userId)
      if (countActiveOwners(nextUsers) < 1) {
        return {
          ok: false as const,
          message:
            'نمی‌توان آخرین مالک فعال را حذف کرد. ابتدا نقش مالک را به کاربر دیگری بدهید.',
        }
      }

      persistUsers(nextUsers)
      return { ok: true as const }
    },
    [users, user, canManageSystemUser],
  )

  const upsertRole = useCallback(
    (role: Role) => {
      if (!user) return { ok: false as const, message: 'نشست معتبر نیست.' }
      if (!role.name.trim()) {
        return {
          ok: false as const,
          message: 'نام نقش الزامی است.',
          fields: { name: 'نام نقش الزامی است.' },
          field: 'name',
        }
      }
      if (role.id === OWNER_ROLE_ID) {
        return {
          ok: false as const,
          message: 'نقش مالک سامانه‌ای است و قابل ویرایش نیست.',
        }
      }

      const exists = roles.some((r) => r.id === role.id)
      const prev = exists ? roles.find((r) => r.id === role.id)! : undefined
      if (prev && !canEditRole(prev)) {
        return { ok: false as const, message: 'اجازه ویرایش این نقش را ندارید.' }
      }

      const isCompanyActor = sessionHasCompany && !sessionHasOwner
      const isCompanyRoleScope = Boolean(
        role.ownerUserId === user.id ||
          prev?.ownerUserId === user.id ||
          (isCompanyActor && (role.ownerUserId === undefined || role.ownerUserId === user.id)),
      )

      if (!exists) {
        const canCreatePlatform = permissions.includes('roles.create')
        const canCreateCompany =
          isCompanyActor && permissions.includes('company-roles.create')
        if (!sessionHasOwner && !canCreatePlatform && !canCreateCompany) {
          return { ok: false as const, message: 'اجازه ایجاد نقش ندارید.' }
        }
      }

      const envelope = companyAssignablePermissionIds()
      const platformEnvelope = platformAssignablePermissionIds()
      let permissionIds = [...new Set(role.permissionIds)].filter((id) =>
        ALL_PERMISSION_IDS.includes(id),
      )

      if (isCompanyActor && isCompanyRoleScope) {
        const illegal = permissionIds.filter((p) => !envelope.includes(p))
        if (illegal.length) {
          return {
            ok: false as const,
            message: 'فقط دسترسی‌های داخل محدودهٔ شرکت قابل تخصیص است.',
          }
        }
        permissionIds = permissionIds.filter((p) => envelope.includes(p))
      } else if (sessionHasOwner && !role.ownerUserId) {
        // مالک پلتفرم برای نقش‌های سفارشی پلتفرم — envelope پلتفرم توصیه می‌شود ولی مالک می‌تواند همه را بدهد
        permissionIds = permissionIds.filter((p) => ALL_PERMISSION_IDS.includes(p))
      } else if (!sessionHasOwner) {
        const allowed = sessionHasPlatformSupport ? platformEnvelope : permissions
        const illegal = permissionIds.filter((p) => !allowed.includes(p))
        if (illegal.length) {
          return {
            ok: false as const,
            message: 'نمی‌توانید دسترسی فراتر از دسترسی خودتان بدهید.',
          }
        }
        permissionIds = permissionIds.filter((p) => allowed.includes(p))
      }

      const nextRole: Role = {
        ...role,
        permissionIds,
        isSystem: prev?.isSystem ?? false,
        createdByUserId: prev?.createdByUserId ?? (exists ? undefined : user.id),
        ownerUserId: isCompanyActor
          ? user.id
          : (prev?.ownerUserId ?? role.ownerUserId),
      }

      if (isCompanyActor && nextRole.ownerUserId !== user.id) {
        return { ok: false as const, message: 'فقط نقش‌های شرکت خودتان را می‌توانید مدیریت کنید.' }
      }

      persistRoles(
        exists ? roles.map((r) => (r.id === nextRole.id ? nextRole : r)) : [nextRole, ...roles],
      )
      return { ok: true as const }
    },
    [
      roles,
      user,
      permissions,
      canEditRole,
      sessionHasOwner,
      sessionHasCompany,
      sessionHasPlatformSupport,
    ],
  )

  const deleteRole = useCallback(
    (roleId: string) => {
      const role = roles.find((r) => r.id === roleId)
      if (!role) return { ok: false as const, message: 'نقش یافت نشد.' }
      if (role.isSystem || roleId === OWNER_ROLE_ID) {
        return { ok: false as const, message: 'نقش سیستمی قابل حذف نیست.' }
      }
      if (user && !canEditRole(role)) {
        return { ok: false as const, message: 'اجازه حذف این نقش را ندارید.' }
      }
      const assigned = users.some((u) => u.roleIds.includes(roleId))
      if (assigned) {
        return { ok: false as const, message: 'این نقش به کاربرانی تخصیص داده شده است.' }
      }
      persistRoles(roles.filter((r) => r.id !== roleId))
      return { ok: true as const }
    },
    [roles, users, user, canEditRole],
  )

  const getRoleNames = useCallback(
    (roleIds: string[]) =>
      roles.filter((r) => roleIds.includes(r.id)).map((r) => r.name),
    [roles],
  )

  const transferOwnership = useCallback(
    (targetUserId: string, password: string, otp: string) => {
      if (!user) {
        return { ok: false as const, message: 'نشست معتبر نیست.' }
      }
      if (!userHasOwnerRole(user)) {
        return { ok: false as const, message: 'فقط مالک می‌تواند مالکیت را منتقل کند.' }
      }

      const fields: Record<string, string> = {}
      if (!targetUserId) fields.targetUserId = 'کاربر مقصد را انتخاب کنید.'
      if (!password) fields.password = 'رمز عبور فعلی الزامی است.'
      else if (user.password !== password) fields.password = 'رمز عبور فعلی نادرست است.'
      if (!otp.trim()) fields.otp = 'کد تأیید الزامی است.'
      else if (otp.trim() !== OWNER_TRANSFER_DEMO_OTP) {
        fields.otp = `کد تأیید نامعتبر است. در نسخهٔ دمو از «${OWNER_TRANSFER_DEMO_OTP}» استفاده کنید.`
      }

      if (Object.keys(fields).length > 0) {
        return {
          ok: false as const,
          message: 'لطفاً فیلدهای الزامی را تکمیل کنید.',
          fields,
        }
      }

      if (targetUserId === user.id) {
        return {
          ok: false as const,
          message: 'نمی‌توانید مالکیت را به خودتان منتقل کنید.',
          fields: { targetUserId: 'نمی‌توانید مالکیت را به خودتان منتقل کنید.' },
        }
      }
      const target = users.find((u) => u.id === targetUserId)
      if (!target || target.status !== 'active') {
        return {
          ok: false as const,
          message: 'کاربر مقصد معتبر یا فعال نیست.',
          fields: { targetUserId: 'کاربر مقصد معتبر یا فعال نیست.' },
        }
      }

      const nextUsers = users.map((u) => {
        if (u.id === user.id) {
          return {
            ...u,
            roleIds: u.roleIds.filter((id) => id !== OWNER_ROLE_ID),
          }
        }
        if (u.id === target.id) {
          return {
            ...u,
            roleIds: u.roleIds.includes(OWNER_ROLE_ID)
              ? u.roleIds
              : [...u.roleIds, OWNER_ROLE_ID],
          }
        }
        return u
      })

      if (countActiveOwners(nextUsers) < 1) {
        return { ok: false as const, message: 'حداقل یک مالک فعال باید در سامانه بماند.' }
      }

      persistUsers(ensureAtLeastOneOwner(nextUsers))
      return { ok: true as const }
    },
    [user, users],
  )

  const patchUserBalances = useCallback(
    (
      userId: string,
      patch: Partial<Pick<SystemUser, 'managerTokenBalance' | 'endUserTokenBalance'>>,
    ) => {
      const target = users.find((u) => u.id === userId)
      if (!target) return { ok: false as const, message: 'کاربر یافت نشد.' }
      persistUsers(
        users.map((u) =>
          u.id === userId
            ? withBalances({
                ...u,
                ...patch,
              })
            : u,
        ),
      )
      return { ok: true as const }
    },
    [users],
  )

  const findUserByIdentity = useCallback(
    (username: string, mobile: string) => {
      const u = username.trim().toLowerCase()
      const m = mobile.trim()
      return users.find(
        (x) =>
          (u && x.username.toLowerCase() === u) ||
          (m && (x.mobile === m || x.mobile === m.replace(/^(\+98|98)/, '0'))),
      )
    },
    [users],
  )

  const ensureUserHasRole = useCallback(
    (
      userId: string,
      roleId: string,
      opts?: {
        create?: {
          name: string
          username: string
          mobile: string
          email: string
          password: string
          organizationName?: string
          companyOwnerUserId?: string
          parentTenantUserId?: string
        }
      },
    ) => {
      if (opts?.create && !userId) {
        const c = opts.create
        const fields: Record<string, string> = {}
        if (!c.name.trim()) fields.name = 'نام الزامی است.'
        if (!c.username.trim()) fields.username = 'نام کاربری الزامی است.'
        if (!isValidMobile(c.mobile)) {
          fields.mobile = 'شماره همراه معتبر نیست.'
        }
        if (!c.password.trim()) fields.password = 'رمز عبور الزامی است.'
        if (
          users.some((u) => u.username.toLowerCase() === c.username.trim().toLowerCase())
        ) {
          fields.username = 'این نام کاربری قبلاً ثبت شده است.'
        }
        if (users.some((u) => u.mobile === c.mobile.trim())) {
          fields.mobile = 'این شماره همراه قبلاً ثبت شده است.'
        }
        if (Object.keys(fields).length) {
          return { ok: false as const, message: 'خطا در ایجاد کاربر.', fields }
        }
        const id = `user-${Date.now()}`
        const created: SystemUser = {
          id,
          name: c.name.trim(),
          username: c.username.trim(),
          mobile: c.mobile.trim(),
          email: c.email.trim(),
          password: c.password,
          roleIds: [roleId],
          status: 'active',
          createdAt: new Date().toLocaleDateString('fa-IR'),
          managerTokenBalance: 0,
          endUserTokenBalance: 0,
          organizationName: c.organizationName,
          companyOwnerUserId: c.companyOwnerUserId,
          parentTenantUserId: c.parentTenantUserId,
        }
        persistUsers([created, ...users])
        return { ok: true as const, userId: id }
      }

      const target = users.find((u) => u.id === userId)
      if (!target) return { ok: false as const, message: 'کاربر یافت نشد.' }
      const patches: Partial<SystemUser> = {}
      if (!target.roleIds.includes(roleId)) {
        patches.roleIds = uniqueRoleIds([...target.roleIds, roleId])
      }
      if (opts?.create?.companyOwnerUserId && !target.companyOwnerUserId) {
        patches.companyOwnerUserId = opts.create.companyOwnerUserId
      }
      if (opts?.create?.organizationName && !target.organizationName) {
        patches.organizationName = opts.create.organizationName
      }
      if (Object.keys(patches).length) {
        persistUsers(users.map((u) => (u.id === userId ? { ...u, ...patches } : u)))
      }
      return { ok: true as const, userId }
    },
    [users],
  )

  const value = useMemo(
    () => ({
      user,
      roles,
      users,
      permissions,
      isAuthenticated: Boolean(user),
      activeWorkspace,
      activeSoftwareId,
      activeTenantId,
      activeOrganizationId,
      availableWorkspaces,
      sessionRoleIds,
      setWorkspace,
      setActiveSoftwareId,
      login,
      selectLoginPersona,
      cancelPersonaSelection,
      pendingPersonaUserId,
      logout,
      hasPermission,
      requestPasswordReset,
      resetPassword,
      upsertUser,
      deleteUser,
      upsertRole,
      deleteRole,
      getRoleNames,
      transferOwnership,
      patchUserBalances,
      findUserByIdentity,
      ensureUserHasRole,
      canEditRole,
      grantablePermissionIds,
      canManageSystemUser,
      manageableUsers,
    }),
    [
      user,
      roles,
      users,
      permissions,
      activeWorkspace,
      activeSoftwareId,
      activeTenantId,
      activeOrganizationId,
      availableWorkspaces,
      sessionRoleIds,
      setWorkspace,
      setActiveSoftwareId,
      login,
      selectLoginPersona,
      cancelPersonaSelection,
      pendingPersonaUserId,
      logout,
      hasPermission,
      requestPasswordReset,
      resetPassword,
      upsertUser,
      deleteUser,
      upsertRole,
      deleteRole,
      getRoleNames,
      transferOwnership,
      patchUserBalances,
      findUserByIdentity,
      ensureUserHasRole,
      canEditRole,
      grantablePermissionIds,
      canManageSystemUser,
      manageableUsers,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
