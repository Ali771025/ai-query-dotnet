import type {
  MenuModule,
  Permission,
  PermissionAction,
  PermissionModule,
} from '../types/rbac'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Coins,
  Settings2,
  BarChart3,
  Activity,
  ScrollText,
  UserRound,
  CreditCard,
  AppWindow,
  GitBranch,
  KeyRound,
  Radar,
  MessageSquareText,
  Star,
  UserCog,
  ShieldCheck,
  Wallet,
  Database,
  History,
  FlaskConical,
  Bot,
} from 'lucide-react'
import type { Workspace } from '../types/rbac'

export const PERMISSION_ACTIONS: { id: PermissionAction; label: string }[] = [
  { id: 'view', label: 'مشاهده' },
  { id: 'create', label: 'ثبت' },
  { id: 'edit', label: 'ویرایش' },
  { id: 'delete', label: 'حذف' },
  { id: 'print', label: 'چاپ' },
]

/**
 * درخت منو: ماژول → قسمت → موجودیت
 *
 * تنها محل ویرایش ساختار منو و دسترسی‌ها.
 * سایدبار (NAV_GROUPS) و تعریف نقش باید فقط از این درخت / توابع مشتق استفاده کنند.
 * لیست موازی برای منو یا نقش نسازید.
 */
export const MENU_MODULES: MenuModule[] = [
  {
    id: 'overview',
    label: 'نمای کلی',
    parts: [
      {
        id: 'overview-main',
        label: 'صفحه اصلی',
        entities: [
          {
            id: 'dashboard',
            label: 'داشبورد',
            to: '/app',
            icon: LayoutDashboard,
            actions: [],
          },
        ],
      },
    ],
  },
  {
    id: 'security',
    label: 'امنیت سامانه',
    parts: [
      {
        id: 'security-accounts',
        label: 'حساب‌ها و نقش‌ها',
        entities: [
          {
            id: 'users',
            label: 'کاربران سیستم',
            to: '/app/system-users',
            icon: UserCog,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'roles',
            label: 'نقش‌ها و دسترسی‌ها',
            to: '/app/roles',
            icon: ShieldCheck,
            actions: ['view', 'create', 'edit', 'delete'],
          },
        ],
      },
    ],
  },
  {
    id: 'billing',
    label: 'توکن و مالی',
    parts: [
      {
        id: 'billing-tokens',
        label: 'شارژ و قوانین',
        entities: [
          {
            id: 'tokens',
            label: 'تخصیص توکن کاربران',
            to: '/app/token-charges',
            icon: Coins,
            actions: ['view', 'create', 'edit'],
          },
          {
            id: 'rules',
            label: 'قوانین مصرف',
            to: '/app/consumption-rules',
            icon: Settings2,
            actions: ['view', 'edit'],
          },
        ],
      },
      {
        id: 'billing-payments',
        label: 'پرداخت',
        entities: [
          {
            id: 'payments',
            label: 'پرداخت آنلاین',
            to: '/app/payments',
            icon: CreditCard,
            actions: ['view', 'create'],
          },
        ],
      },
    ],
  },
  {
    id: 'owner-reports',
    label: 'گزارش و لاگ مالک',
    parts: [
      {
        id: 'owner-reports-stats',
        label: 'گزارش‌ها',
        entities: [
          {
            id: 'reports-stats',
            label: 'گزارش آماری',
            to: '/app/reports/statistics',
            icon: BarChart3,
            actions: ['view', 'print'],
          },
          {
            id: 'reports-performance',
            label: 'گزارش عملکرد',
            to: '/app/reports/performance',
            icon: Activity,
            actions: ['view', 'print'],
          },
        ],
      },
      {
        id: 'owner-reports-logs',
        label: 'لاگ‌ها',
        entities: [
          {
            id: 'logs-security',
            label: 'لاگ امنیتی',
            to: '/app/logs/security',
            icon: ScrollText,
            actions: ['view', 'print'],
          },
          {
            id: 'logs-user',
            label: 'لاگ کاربری',
            to: '/app/logs/user',
            icon: UserRound,
            actions: ['view', 'print'],
          },
        ],
      },
    ],
  },
  {
    id: 'catalog',
    label: 'کاتالوگ نرم‌افزار',
    parts: [
      {
        id: 'catalog-core',
        label: 'نرم‌افزار و نسخه',
        entities: [
          {
            id: 'software',
            label: 'نرم‌افزارها',
            to: '/app/software',
            icon: AppWindow,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'versions',
            label: 'نسخه‌ها',
            to: '/app/versions',
            icon: GitBranch,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'databases',
            label: 'دیتابیس‌ها',
            to: '/app/databases',
            icon: Database,
            actions: ['view', 'create', 'edit', 'delete'],
          },
        ],
      },
    ],
  },
  {
    id: 'app-access',
    label: 'کاربران و کلید دسترسی',
    parts: [
      {
        id: 'app-access-users',
        label: 'کاربران نرم‌افزار',
        entities: [
          {
            id: 'appusers',
            label: 'فهرست کاربران',
            to: '/app/users',
            icon: Users,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'appusers-tokens',
            label: 'شارژ کاربران',
            to: '/app/user-tokens',
            icon: Coins,
            actions: ['view', 'create'],
          },
          {
            id: 'appusers-token-history',
            label: 'تاریخچه شارژ',
            to: '/app/user-token-history',
            icon: History,
            actions: ['view'],
          },
          {
            id: 'company-roles',
            label: 'نقش‌های من',
            to: '/app/company-roles',
            icon: ShieldCheck,
            actions: ['view', 'create', 'edit', 'delete'],
          },
        ],
      },
      {
        id: 'app-access-keys',
        label: 'اتصال',
        entities: [
          {
            id: 'apikeys',
            label: 'API Key',
            to: '/app/api-keys',
            icon: KeyRound,
            actions: ['view', 'create', 'delete'],
          },
        ],
      },
    ],
  },
  {
    id: 'quality',
    label: 'پایش و کیفیت پاسخ',
    parts: [
      {
        id: 'quality-monitor',
        label: 'پایش',
        entities: [
          {
            id: 'requests',
            label: 'مانیتورینگ درخواست‌ها',
            to: '/app/requests',
            icon: Radar,
            actions: ['view'],
          },
          {
            id: 'prompts',
            label: 'لاگ Prompt',
            to: '/app/prompt-logs',
            icon: MessageSquareText,
            actions: ['view', 'print'],
          },
        ],
      },
      {
        id: 'quality-feedback',
        label: 'کیفیت',
        entities: [
          {
            id: 'accuracy',
            label: 'دقت پاسخ',
            to: '/app/accuracy',
            icon: Star,
            actions: ['view', 'edit'],
          },
        ],
      },
    ],
  },
  {
    id: 'mgmt-reporting',
    label: 'گزارش مدیریتی',
    parts: [
      {
        id: 'mgmt-reporting-main',
        label: 'گزارش‌ها',
        entities: [
          {
            id: 'mgmt-reports',
            label: 'گزارش‌های مدیریتی',
            to: '/app/mgmt-reports',
            icon: BarChart3,
            actions: ['view', 'print'],
          },
        ],
      },
    ],
  },
  {
    id: 'sw-owner-reports',
    label: 'گزارش مالک نرم‌افزار',
    parts: [
      {
        id: 'sw-owner-reports-main',
        label: 'گزارش‌های بین‌سطحی',
        entities: [
          {
            id: 'sw-reports-advanced',
            label: 'گزارش پیشرفته بین‌سطحی',
            to: '/app/sw-reports',
            icon: BarChart3,
            actions: ['view', 'print'],
          },
        ],
      },
    ],
  },
  {
    id: 'sw-owner-ai',
    label: 'تست مدل AI',
    parts: [
      {
        id: 'sw-owner-ai-main',
        label: 'آزمایش مدل',
        entities: [
          {
            id: 'ai-model-test',
            label: 'تست مدل AI',
            to: '/app/ai-model-test',
            icon: FlaskConical,
            actions: ['view'],
          },
        ],
      },
    ],
  },
  {
    id: 'owner-api-keys',
    label: 'API Key مالکین',
    parts: [
      {
        id: 'owner-api-keys-main',
        label: 'کلیدهای هم‌سطح',
        entities: [
          {
            id: 'owner-apikeys',
            label: 'API Keyها',
            to: '/app/owner-api-keys',
            icon: KeyRound,
            actions: ['view', 'create', 'edit', 'delete'],
          },
        ],
      },
    ],
  },
  {
    id: 'platform-ai-settings',
    label: 'تنظیمات مدل AI',
    parts: [
      {
        id: 'platform-ai-providers',
        label: 'ارائه‌دهندگان خارجی',
        entities: [
          {
            id: 'ai-providers',
            label: 'مدل‌های AI پلتفرم',
            to: '/app/ai-providers',
            icon: Bot,
            actions: ['view', 'create', 'edit', 'delete'],
          },
        ],
      },
    ],
  },
  {
    id: 'end-user-portal',
    label: 'سازمان من',
    parts: [
      {
        id: 'end-user-main',
        label: 'توکن، کاربران و اتصال',
        entities: [
          {
            id: 'my-wallet',
            label: 'شارژ توکن',
            to: '/app/my-wallet',
            icon: Wallet,
            actions: ['view', 'create'],
          },
          {
            id: 'org-members',
            label: 'کاربران سازمان',
            to: '/app/org-members',
            icon: Users,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'my-apikeys',
            label: 'API Keyها',
            to: '/app/my-api-keys',
            icon: KeyRound,
            actions: ['view', 'create', 'edit', 'delete'],
          },
          {
            id: 'my-apikey-reports',
            label: 'گزارش API Key',
            to: '/app/my-apikey-reports',
            icon: BarChart3,
            actions: ['view', 'print'],
          },
        ],
      },
    ],
  },
]

/** ماژول‌های منو به‌ازای هر workspace / پرسونا */
export const WORKSPACE_MODULE_IDS: Record<Workspace, string[]> = {
  platform: [
    'overview',
    'security',
    'billing',
    'owner-reports',
    'sw-owner-ai',
    'owner-api-keys',
    'platform-ai-settings',
  ],
  software_owner: [
    'overview',
    'catalog',
    'app-access',
    'sw-owner-reports',
    'sw-owner-ai',
    'owner-api-keys',
  ],
  company: [
    'overview',
    'catalog',
    'app-access',
    'quality',
    'mgmt-reporting',
    'sw-owner-ai',
  ],
  /** کاتالوگ/گزارش هم هست تا نقش‌های سفارشی شرکت با فیلتر permission دیده شوند */
  support: ['overview', 'catalog', 'app-access', 'quality', 'mgmt-reporting'],
  /** API Keyهای کاربر نهایی داخل end-user-portal (نه ماژول جدا) */
  tenant: ['overview', 'end-user-portal'],
}

/** پوشش دسترسی نقش‌های سفارشی پلتفرم (پشتیبان کیان و …) */
export const PLATFORM_ENVELOPE_MODULE_IDS = [
  'security',
  'billing',
  'owner-reports',
  'owner-api-keys',
] as const

/** پوشش دسترسی مالک نرم‌افزار (بدون مدیریت نقش‌های شرکت) */
export const SOFTWARE_OWNER_ENVELOPE_MODULE_IDS = [
  'catalog',
  'app-access',
  'sw-owner-reports',
  'sw-owner-ai',
  'owner-api-keys',
] as const

/** ماژول‌های پوشش دسترسی قابل تفویض توسط شرکت نرم‌افزاری */
export const COMPANY_ENVELOPE_MODULE_IDS = [
  'catalog',
  'app-access',
  'quality',
  'mgmt-reporting',
] as const

export function platformAssignablePermissionIds(): string[] {
  return permissionsForMenuModules([...PLATFORM_ENVELOPE_MODULE_IDS])
}

export function softwareOwnerPermissionIds(): string[] {
  return permissionsForMenuModules([...SOFTWARE_OWNER_ENVELOPE_MODULE_IDS]).filter(
    (id) => !id.startsWith('company-roles.'),
  )
}

/**
 * دسترسی‌هایی که شرکت می‌تواند در نقش‌های سفارشی خود بدهد.
 * مدیریت «نقش‌های من» فقط برای خود شرکت است و قابل تفویض نیست.
 */
export function companyAssignablePermissionIds(): string[] {
  return permissionsForMenuModules([...COMPANY_ENVELOPE_MODULE_IDS]).filter(
    (id) => !id.startsWith('company-roles.'),
  )
}

/** ماژول‌هایی که در تعریف نقش نمایش داده می‌شوند (حداقل یک موجودیت با عملیات) */
export function getRoleMenuModules(): MenuModule[] {
  return MENU_MODULES.filter((mod) =>
    mod.parts.some((part) => part.entities.some((entity) => entity.actions.length > 0)),
  ).map((mod) => ({
    ...mod,
    parts: mod.parts
      .map((part) => ({
        ...part,
        entities: part.entities.filter((entity) => entity.actions.length > 0),
      }))
      .filter((part) => part.entities.length > 0),
  }))
}

export function permissionId(entityId: string, action: PermissionAction): string {
  return `${entityId}.${action}`
}

/** موجودیت‌های دارای RBAC — مشتق از درخت */
export const PERMISSION_MODULES: PermissionModule[] = MENU_MODULES.flatMap((mod) =>
  mod.parts.flatMap((part) =>
    part.entities
      .filter((entity) => entity.actions.length > 0)
      .map((entity) => ({
        id: entity.id,
        label: entity.label,
        group: mod.label,
        moduleId: mod.id,
        partId: part.id,
        partLabel: part.label,
        actions: entity.actions,
      })),
  ),
)

export function moduleActions(entityId: string): PermissionAction[] {
  return PERMISSION_MODULES.find((m) => m.id === entityId)?.actions ?? []
}

export const PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap((mod) =>
  mod.actions.map((action) => {
    const actionLabel = PERMISSION_ACTIONS.find((a) => a.id === action)?.label ?? action
    return {
      id: permissionId(mod.id, action),
      label: `${actionLabel} — ${mod.label}`,
      group: mod.group,
      description: `${actionLabel} برای ${mod.label}`,
    }
  }),
)

export const ALL_PERMISSION_IDS = PERMISSIONS.map((p) => p.id)

export function permissionsForModules(entityIds: string[]): string[] {
  return PERMISSION_MODULES.filter((m) => entityIds.includes(m.id)).flatMap((m) =>
    m.actions.map((a) => permissionId(m.id, a)),
  )
}

export function permissionsForMenuModules(moduleIds: string[]): string[] {
  return PERMISSION_MODULES.filter((m) => moduleIds.includes(m.moduleId)).flatMap((m) =>
    m.actions.map((a) => permissionId(m.id, a)),
  )
}

export type AppNavItem = {
  label: string
  to: string
  icon: LucideIcon
  /** بدون مقدار = همیشه برای کاربر لاگین‌شده (مثل داشبورد) */
  permission?: string
}

export type AppNavGroup = {
  title: string
  items: AppNavItem[]
}

/** سایدبار — فقط مشتق از MENU_MODULES؛ دستی نگه ندارید */
export const NAV_GROUPS: AppNavGroup[] = MENU_MODULES.map((mod) => ({
  title: mod.label,
  items: mod.parts.flatMap((part) =>
    part.entities
      .filter((entity): entity is typeof entity & { to: string; icon: LucideIcon } =>
        Boolean(entity.to && entity.icon),
      )
      .map((entity) => ({
        label: entity.label,
        to: entity.to,
        icon: entity.icon,
        permission: entity.actions.includes('view')
          ? permissionId(entity.id, 'view')
          : undefined,
      })),
  ),
})).filter((group) => group.items.length > 0)
