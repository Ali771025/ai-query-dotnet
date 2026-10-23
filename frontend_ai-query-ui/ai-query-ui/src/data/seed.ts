import type { Role, SystemUser } from '../types/rbac'
import {
  ALL_PERMISSION_IDS,
  companyAssignablePermissionIds,
  permissionsForMenuModules,
} from './permissions'

export const OWNER_ROLE_ID = 'role-owner'
export const PLATFORM_SUPPORT_ROLE_ID = 'role-platform-support'
export const SOFTWARE_OWNER_ROLE_ID = 'role-software-owner'
export const SOFTWARE_COMPANY_ROLE_ID = 'role-software-company'
/** سازگاری با کد قبلی — همان مالک شرکت نرم‌افزاری */
export const SOFTWARE_MANAGER_ROLE_ID = SOFTWARE_COMPANY_ROLE_ID
export const SOFTWARE_SUPPORT_ROLE_ID = 'role-software-support'
export const END_USER_ROLE_ID = 'role-end-user'
export const ORG_MEMBER_ROLE_ID = 'role-org-member'
/** نقش سفارشی دمو برای پشتیبان نمونه — seed صریح، نه auto-default */
export const COMPANY_DEMO_SUPPORT_ROLE_ID = 'role-behsaz-support-full'
/** شناسه قدیمی نقش پیش‌فرض «پشتیبان کامل» شرکت نمونه */
export const LEGACY_BEHSAZ_DEFAULT_FULL_ROLE_ID = 'role-co-user-manager-full'

export const RBAC_SCHEMA_VERSION = 24
export const DOMAIN_SCHEMA_VERSION = 9

export const OWNER_TRANSFER_DEMO_OTP = 'demo-otp'

export const seedRoles: Role[] = [
  {
    id: OWNER_ROLE_ID,
    name: 'مالک پلتفرم',
    description: 'ستون ثابت سلسله — دسترسی کامل پلتفرم نمونه',
    permissionIds: [...ALL_PERMISSION_IDS],
    isSystem: true,
  },
  {
    id: PLATFORM_SUPPORT_ROLE_ID,
    name: 'پشتیبان پلتفرم (نمونه)',
    description:
      'نقش سفارشی پلتفرم — توسط مالک پلتفرم در envelope پلتفرم ساخته/ویرایش می‌شود',
    permissionIds: permissionsForMenuModules(['security', 'owner-reports']),
    isSystem: false,
    createdByUserId: 'user-owner',
  },
  {
    id: SOFTWARE_OWNER_ROLE_ID,
    name: 'مالک نرم‌افزار',
    description:
      'ستون ثابت سلسله — مالک خط محصول؛ مدیریت مالک شرکت نرم‌افزاری و گزارش بین‌سطحی',
    permissionIds: permissionsForMenuModules([
      'catalog',
      'app-access',
      'sw-owner-reports',
      'sw-owner-ai',
      'owner-api-keys',
    ]).filter((id) => !id.startsWith('company-roles.')),
    isSystem: true,
  },
  {
    id: SOFTWARE_COMPANY_ROLE_ID,
    name: 'مالک شرکت نرم‌افزاری',
    description:
      'ستون ثابت سلسله — نرم‌افزارهای خود، کاربران نهایی و نقش‌های سفارشی شرکت',
    permissionIds: permissionsForMenuModules([
      'catalog',
      'app-access',
      'quality',
      'mgmt-reporting',
      'sw-owner-ai',
    ]),
    isSystem: true,
  },
  {
    id: SOFTWARE_SUPPORT_ROLE_ID,
    name: 'پشتیبان نرم‌افزار (قدیمی)',
    description:
      'نقش سیستمی قدیمی — شرکت‌ها از نقش‌های سفارشی خود استفاده می‌کنند',
    permissionIds: permissionsForMenuModules(['app-access', 'quality']).filter(
      (id) => !id.startsWith('company-roles.'),
    ),
    isSystem: true,
  },
  {
    id: END_USER_ROLE_ID,
    name: 'کاربر نهایی',
    description:
      'ستون ثابت سلسله — شارژ توکن، کاربران سازمان، API Key و گزارش (غیرقابل ویرایش در نقش‌های شرکت)',
    permissionIds: permissionsForMenuModules(['end-user-portal']),
    isSystem: true,
  },
  {
    id: ORG_MEMBER_ROLE_ID,
    name: 'کاربر سازمان',
    description: 'مصرف از طریق API Key — بدون پنل مدیریتی',
    permissionIds: [],
    isSystem: true,
  },
  {
    id: COMPANY_DEMO_SUPPORT_ROLE_ID,
    name: 'پشتیبان کامل نمونه',
    description: 'نقش سفارشی دمو — تمام دسترسی‌های قابل تفویض شرکت نمونه',
    permissionIds: [...companyAssignablePermissionIds()],
    isSystem: false,
    ownerUserId: 'user-manager',
    createdByUserId: 'user-manager',
  },
]

/**
 * حذف نقش‌های پیش‌فرض شرکت و ساخت نگاشت جایگزینی شناسه.
 * ستون‌های ثابت سلسله (مالک پلتفرم/نرم‌افزار/شرکت، کاربر نهایی، …) دست نخورده می‌مانند.
 */
export function purgeCompanyDefaultRoles(roles: Role[]): {
  roles: Role[]
  purgedIds: Set<string>
} {
  const legacyDefaultIdRe = /^role-co-.+-(versions|charge|monitor|full)$/
  const purgedIds = new Set<string>()
  for (const r of roles) {
    if (r.isCompanyDefault === true || legacyDefaultIdRe.test(r.id)) {
      purgedIds.add(r.id)
    }
  }
  purgedIds.add(LEGACY_BEHSAZ_DEFAULT_FULL_ROLE_ID)
  return {
    roles: roles.filter((r) => !purgedIds.has(r.id)),
    purgedIds,
  }
}

/** جایگزینی شناسه نقش پیش‌فرض حذف‌شده برای کاربران / عضویت‌ها */
export function remapPurgedCompanyDefaultRoleId(
  roleId: string,
  purgedIds: Set<string>,
): string {
  if (roleId === LEGACY_BEHSAZ_DEFAULT_FULL_ROLE_ID) {
    return COMPANY_DEMO_SUPPORT_ROLE_ID
  }
  if (!purgedIds.has(roleId)) return roleId
  return SOFTWARE_SUPPORT_ROLE_ID
}

export const seedUsers: SystemUser[] = [
  {
    id: 'user-owner',
    username: 'owner',
    password: '',
    name: 'کاربر نمونه 1',
    email: 'demo-user-1@example.invalid',
    mobile: '09000000000',
    roleIds: [OWNER_ROLE_ID],
    status: 'active',
    createdAt: '1403/01/01',
    managerTokenBalance: 0,
    endUserTokenBalance: 0,
    organizationName: 'روش پژوهان نمونه',
  },
  {
    id: 'user-platform-support',
    username: 'support',
    password: '',
    name: 'کاربر نمونه 2',
    email: 'demo-user-2@example.invalid',
    mobile: '09000000000',
    roleIds: [PLATFORM_SUPPORT_ROLE_ID],
    status: 'active',
    createdAt: '1403/02/01',
    managerTokenBalance: 0,
    endUserTokenBalance: 0,
    organizationName: 'روش پژوهان نمونه',
  },
  {
    id: 'user-software-owner',
    username: 'swowner',
    password: '',
    name: 'کاربر نمونه 3',
    email: 'demo-user-3@example.invalid',
    mobile: '09000000000',
    roleIds: [SOFTWARE_OWNER_ROLE_ID, END_USER_ROLE_ID],
    status: 'active',
    createdAt: '1403/03/01',
    managerTokenBalance: 0,
    endUserTokenBalance: 500,
    organizationName: 'خط محصول نمونه',
  },
  {
    id: 'user-manager',
    username: 'manager',
    password: '',
    name: 'کاربر نمونه 4',
    email: 'demo-user-4@example.invalid',
    mobile: '09000000000',
    roleIds: [SOFTWARE_COMPANY_ROLE_ID],
    status: 'active',
    createdAt: '1403/08/12',
    managerTokenBalance: 125000,
    endUserTokenBalance: 0,
    organizationName: 'نمونه',
  },
  {
    id: 'user-manager-b',
    username: 'managerb',
    password: '',
    name: 'کاربر نمونه 5',
    email: 'demo-user-5@example.invalid',
    mobile: '09000000000',
    roleIds: [SOFTWARE_COMPANY_ROLE_ID],
    status: 'active',
    createdAt: '1403/08/15',
    managerTokenBalance: 40000,
    endUserTokenBalance: 0,
    organizationName: 'شرکت نمونه دیگر',
  },
  {
    id: 'user-sw-support',
    username: 'swsupport',
    password: '',
    name: 'کاربر نمونه 6',
    email: 'demo-user-6@example.invalid',
    mobile: '09000000000',
    roleIds: [COMPANY_DEMO_SUPPORT_ROLE_ID],
    status: 'active',
    createdAt: '1403/09/01',
    managerTokenBalance: 0,
    endUserTokenBalance: 0,
    organizationName: 'نمونه',
    companyOwnerUserId: 'user-manager',
  },
  {
    id: 'user-end-1',
    username: 'fatemeh',
    password: '',
    name: 'کاربر نمونه 7',
    email: 'demo-user-7@example.invalid',
    mobile: '09000000000',
    roleIds: [END_USER_ROLE_ID],
    status: 'active',
    createdAt: '1403/10/01',
    managerTokenBalance: 0,
    endUserTokenBalance: 4200,
    organizationName: 'سازمان منطقه ۵',
    companyOwnerUserId: 'user-manager',
  },
  {
    id: 'user-end-2',
    username: 'mohammad',
    password: '',
    name: 'کاربر نمونه 8',
    email: 'demo-user-8@example.invalid',
    mobile: '09000000000',
    roleIds: [END_USER_ROLE_ID],
    status: 'active',
    createdAt: '1403/11/05',
    managerTokenBalance: 0,
    endUserTokenBalance: 1800,
    organizationName: 'واحد مالی',
    companyOwnerUserId: 'user-manager',
  },
  {
    id: 'user-end-b',
    username: 'otheruser',
    password: '',
    name: 'کاربر نمونه 9',
    email: 'demo-user-9@example.invalid',
    mobile: '09000000000',
    roleIds: [END_USER_ROLE_ID],
    status: 'active',
    createdAt: '1403/11/20',
    managerTokenBalance: 0,
    endUserTokenBalance: 900,
    organizationName: 'سازمان شرکت دیگر',
    companyOwnerUserId: 'user-manager-b',
  },
  {
    id: 'user-org-1',
    username: 'operator1',
    password: '',
    name: 'کاربر نمونه 10',
    email: 'demo-user-10@example.invalid',
    mobile: '09000000000',
    roleIds: [ORG_MEMBER_ROLE_ID],
    status: 'active',
    createdAt: '1404/01/10',
    managerTokenBalance: 0,
    endUserTokenBalance: 0,
    organizationName: 'سازمان منطقه ۵',
    parentTenantUserId: 'user-end-1',
    companyOwnerUserId: 'user-manager',
  },
]
