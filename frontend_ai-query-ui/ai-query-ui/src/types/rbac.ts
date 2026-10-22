export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'print'

export type Permission = {
  id: string
  label: string
  group: string
  description: string
}

export type PermissionModule = {
  id: string
  label: string
  group: string
  moduleId: string
  partId: string
  partLabel: string
  actions: PermissionAction[]
}

export type MenuEntity = {
  id: string
  label: string
  to?: string
  icon?: import('lucide-react').LucideIcon
  actions: PermissionAction[]
}

export type MenuPart = {
  id: string
  label: string
  entities: MenuEntity[]
}

export type MenuModule = {
  id: string
  label: string
  parts: MenuPart[]
}

/**
 * پرسونای ورود / پنل نشست (هر کدام فقط دسترسی همان سطح):
 * platform        = مالک پلتفرم (+ نقش سفارشی پشتیبان کیان)
 * software_owner  = مالک نرم‌افزار
 * company         = مالک شرکت نرم‌افزاری
 * support         = نقش سفارشی شرکت (پشتیبان نسخه/شارژ/…)
 * tenant          = کاربر نهایی
 */
export type Workspace =
  | 'platform'
  | 'software_owner'
  | 'company'
  | 'support'
  | 'tenant'

export type Role = {
  id: string
  name: string
  description: string
  permissionIds: string[]
  isSystem: boolean
  createdByUserId?: string
  /** مالک شرکت نرم‌افزاری که این نقش سفارشی متعلق به اوست (سراسری شرکت) */
  ownerUserId?: string
  /**
   * منسوخ — نقش‌های پیش‌فرض شرکت دیگر ساخته نمی‌شوند.
   * فقط برای مهاجرت localStorage (purge در RBAC schema bump) خوانده می‌شود.
   */
  isCompanyDefault?: boolean
}

export type SystemUser = {
  id: string
  username: string
  password: string
  name: string
  email: string
  mobile: string
  roleIds: string[]
  status: 'active' | 'inactive'
  createdAt: string
  managerTokenBalance: number
  endUserTokenBalance: number
  /** سازمان نمایشی برای tenant / org_member */
  organizationName?: string
  /** اگر org_member باشد، IT سازمان والد */
  parentTenantUserId?: string
  /** شرکت نرم‌افزاری مسئول مدیریت این حساب (پشتیبان/مستأجر زیر آن شرکت) */
  companyOwnerUserId?: string
}

export type Session = {
  userId: string
  loggedInAt: string
  /** پرسونای انتخاب‌شده در ورود — مجوزهای نشست فقط از این سطح */
  activeWorkspace?: Workspace
  /** زیر‌مجموعهٔ roleIds مؤثر برای این نشست (بر اساس پرسونا) */
  loginRoleIds?: string[]
  activeSoftwareId?: string | null
}

export type PasswordReset = {
  token: string
  userId: string
  username: string
  expiresAt: number
}
