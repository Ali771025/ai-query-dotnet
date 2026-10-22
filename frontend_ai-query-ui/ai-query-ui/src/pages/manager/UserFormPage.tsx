import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { MultiSelect } from '../../components/ui/MultiSelect'
import { useAuth, isValidMobile } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import { CAN_ASSIGN_KIND, type MembershipKind } from '../../lib/hierarchy'
import type { SystemUser } from '../../types/rbac'

const KIND_OPTIONS: { value: MembershipKind; label: string }[] = [
  { value: 'software_owner', label: 'مالک نرم‌افزار' },
  { value: 'company_owner', label: 'مالک شرکت نرم‌افزاری' },
  { value: 'software_support', label: 'پشتیبان نرم‌افزار' },
  { value: 'end_user', label: 'کاربر نهایی' },
  { value: 'org_member', label: 'کاربر سازمان' },
]

const END_USER_OPTION = 'end_user'
const ROLE_OPTION_PREFIX = 'role:'

function roleOptionValue(roleId: string) {
  return `${ROLE_OPTION_PREFIX}${roleId}`
}

function parseRoleOption(value: string): string | undefined {
  if (!value.startsWith(ROLE_OPTION_PREFIX)) return undefined
  return value.slice(ROLE_OPTION_PREFIX.length)
}

function normalizeMobile(mobile: string) {
  return mobile.trim().replace(/^(\+98|98)/, '0')
}

function usersByMobile(users: SystemUser[], mobile: string) {
  const m = normalizeMobile(mobile)
  if (!m || m.length < 10) return []
  return users.filter((u) => normalizeMobile(u.mobile) === m)
}

/** حداکثر یک نقش شرکت + اختیاری کاربر نهایی */
function clampCompanyAssignment(vals: string[]): string[] {
  const hasEndUser = vals.includes(END_USER_OPTION)
  const roleVals = vals.filter((v) => Boolean(parseRoleOption(v)))
  const lastRole = roleVals.length ? roleVals[roleVals.length - 1] : undefined
  return [...(lastRole ? [lastRole] : []), ...(hasEndUser ? [END_USER_OPTION] : [])]
}

function assignmentToKindsAndSupport(vals: string[]): {
  kinds: MembershipKind[]
  supportRoleId?: string
} {
  const supportRoleId = vals.map(parseRoleOption).find(Boolean)
  const kinds: MembershipKind[] = []
  if (supportRoleId) kinds.push('software_support')
  if (vals.includes(END_USER_OPTION)) kinds.push('end_user')
  return { kinds, supportRoleId }
}

export function UserFormPage() {
  const { id } = useParams()
  const {
    user,
    users,
    roles,
    activeSoftwareId,
    setActiveSoftwareId,
    upsertUser,
  } = useAuth()
  const {
    softwares,
    ownedSoftwares,
    accessibleSoftwares,
    assignUserToSoftware,
    actorTier,
    canEditAssignedUser,
    memberships,
  } = useDomain()
  const existing = users.find((u) => u.id === id)
  const isEdit = Boolean(existing)
  const editForbidden = isEdit && existing && !canEditAssignedUser(existing.id)

  const isCompanyActor = actorTier === 'company'

  const companyOwnerId =
    isCompanyActor && user
      ? user.id
      : softwares.find((s) => s.id === (activeSoftwareId ?? ''))?.ownerUserId

  const companySupportRoles = useMemo(() => {
    if (!user || !isCompanyActor) return []
    return roles.filter((r) => r.ownerUserId === user.id && !r.isSystem)
  }, [roles, user, isCompanyActor])

  const assignableSoftwares = useMemo(() => {
    if (!user) return []
    if (actorTier === 'company') return ownedSoftwares(user.id)
    if (actorTier === 'software_owner') return accessibleSoftwares
    if (actorTier === 'support' || actorTier === 'tenant') return accessibleSoftwares
    if (actorTier === 'platform') return softwares
    return ownedSoftwares(user.id)
  }, [user, actorTier, ownedSoftwares, accessibleSoftwares, softwares])

  const allowedKinds = actorTier ? CAN_ASSIGN_KIND[actorTier] : []
  const kindSelectOptions = KIND_OPTIONS.filter((o) =>
    allowedKinds.includes(o.value),
  )

  const companyAssignmentOptions = useMemo(
    () => [
      ...companySupportRoles.map((r) => ({
        value: roleOptionValue(r.id),
        label: r.name,
      })),
      { value: END_USER_OPTION, label: 'کاربر نهایی / IT سازمان' },
    ],
    [companySupportRoles],
  )

  const defaultSoftwareId =
    (activeSoftwareId &&
    assignableSoftwares.some((s) => s.id === activeSoftwareId)
      ? activeSoftwareId
      : assignableSoftwares[0]?.id) ?? ''

  const defaultKinds = useMemo(() => {
    const both: MembershipKind[] = ['software_support', 'end_user']
    const allowedBoth = both.filter((k) => allowedKinds.includes(k))
    if (allowedBoth.length) return allowedBoth
    return allowedKinds[0] ? [allowedKinds[0]] : []
  }, [allowedKinds])

  const defaultCompanyAssignment = useMemo(() => {
    const vals: string[] = []
    if (companySupportRoles[0]) vals.push(roleOptionValue(companySupportRoles[0].id))
    if (allowedKinds.includes('end_user')) vals.push(END_USER_OPTION)
    return vals
  }, [companySupportRoles, allowedKinds])

  /** پیش‌انتخاب عضویت‌های موجود کاربر در نرم‌افزار فعال (ویرایش) */
  const existingAssignmentValues = useMemo(() => {
    if (!isEdit || !existing || !activeSoftwareId || !isCompanyActor) return [] as string[]
    const mems = memberships.filter(
      (m) => m.softwareId === activeSoftwareId && m.userId === existing.id,
    )
    const vals: string[] = []
    const support = mems.find((m) => m.kind === 'software_support')
    if (support) {
      const companyRoleId = support.roleIds.find((rid) =>
        companySupportRoles.some((r) => r.id === rid),
      )
      if (companyRoleId) vals.push(roleOptionValue(companyRoleId))
    }
    if (mems.some((m) => m.kind === 'end_user')) vals.push(END_USER_OPTION)
    return vals
  }, [
    isEdit,
    existing,
    activeSoftwareId,
    isCompanyActor,
    memberships,
    companySupportRoles,
  ])

  const [softwareId, setSoftwareId] = useState(defaultSoftwareId)
  const [kinds, setKinds] = useState<MembershipKind[]>(defaultKinds)
  const [companyAssignment, setCompanyAssignment] = useState<string[]>(
    () => defaultCompanyAssignment,
  )
  const [name, setName] = useState(existing?.name ?? '')
  const [username, setUsername] = useState(existing?.username ?? '')
  const [mobile, setMobile] = useState(existing?.mobile ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState(
    existing?.organizationName ?? '',
  )
  const [linkedUserId, setLinkedUserId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  const resolvedAssignment = isCompanyActor
    ? assignmentToKindsAndSupport(companyAssignment)
    : { kinds, supportRoleId: undefined as string | undefined }

  const needsSupportRole =
    isCompanyActor && resolvedAssignment.kinds.includes('software_support')

  useEffect(() => {
    if (!isEdit || !existingAssignmentValues.length) return
    setCompanyAssignment(existingAssignmentValues)
  }, [isEdit, existingAssignmentValues])

  useEffect(() => {
    if (!isCompanyActor) return
    if (!companySupportRoles.length) return
    const selectedRole = companyAssignment.map(parseRoleOption).find(Boolean)
    if (selectedRole && !companySupportRoles.some((r) => r.id === selectedRole)) {
      setCompanyAssignment((prev) =>
        clampCompanyAssignment([
          ...prev.filter((v) => !parseRoleOption(v)),
          roleOptionValue(companySupportRoles[0].id),
        ]),
      )
    }
  }, [isCompanyActor, companySupportRoles, companyAssignment])

  const mobileMatchesAll = useMemo(
    () => (!isEdit ? usersByMobile(users, mobile) : []),
    [users, mobile, isEdit],
  )

  const foreignCompanyMatch = useMemo(() => {
    if (!companyOwnerId) return undefined
    return mobileMatchesAll.find(
      (u) => u.companyOwnerUserId && u.companyOwnerUserId !== companyOwnerId,
    )
  }, [mobileMatchesAll, companyOwnerId])

  const mobileMatches = useMemo(() => {
    if (!companyOwnerId) return mobileMatchesAll
    return mobileMatchesAll.filter(
      (u) => !u.companyOwnerUserId || u.companyOwnerUserId === companyOwnerId,
    )
  }, [mobileMatchesAll, companyOwnerId])

  const alreadyAssignedKinds = useMemo(() => {
    if (!linkedUserId || !softwareId) return [] as MembershipKind[]
    return resolvedAssignment.kinds.filter((kind) =>
      memberships.some(
        (m) =>
          m.softwareId === softwareId &&
          m.userId === linkedUserId &&
          m.kind === kind,
      ),
    )
  }, [linkedUserId, softwareId, resolvedAssignment.kinds, memberships])

  const linkedUser = mobileMatches.find((u) => u.id === linkedUserId)
  const isLinkedMode = Boolean(linkedUser)

  const [initial] = useState(() => ({
    softwareId: defaultSoftwareId,
    kinds: defaultKinds,
    companyAssignment: defaultCompanyAssignment,
    name: existing?.name ?? '',
    username: existing?.username ?? '',
    mobile: existing?.mobile ?? '',
    email: existing?.email ?? '',
    password: '',
    organizationName: existing?.organizationName ?? '',
    linkedUserId: '',
  }))

  const dirty = isFormDirty(
    isEdit
      ? { name, username, mobile, email, password, organizationName }
      : {
          softwareId,
          kinds: [...kinds].sort(),
          companyAssignment: [...companyAssignment].sort(),
          name,
          username,
          mobile,
          email,
          password,
          organizationName,
          linkedUserId,
        },
    isEdit
      ? {
          name: initial.name,
          username: initial.username,
          mobile: initial.mobile,
          email: initial.email,
          password: initial.password,
          organizationName: initial.organizationName,
        }
      : {
          ...initial,
          kinds: [...initial.kinds].sort(),
          companyAssignment: [...initial.companyAssignment].sort(),
        },
  )
  const { bypassAndLeave, confirmAndLeave } = useUnsavedChangesGuard(
    !editForbidden && dirty,
  )

  const software = softwares.find((s) => s.id === softwareId)

  const applyLinkedUser = (u: SystemUser | undefined) => {
    if (!u) {
      setLinkedUserId('')
      return
    }
    setLinkedUserId(u.id)
    setName(u.name)
    setUsername(u.username)
    setEmail(u.email)
    setOrganizationName(u.organizationName ?? '')
    setPassword('')
    setErrors({})
  }

  const onMobileChange = (value: string) => {
    setMobile(value)
    const all = usersByMobile(users, value)
    const sameCompany = companyOwnerId
      ? all.filter(
          (u) => !u.companyOwnerUserId || u.companyOwnerUserId === companyOwnerId,
        )
      : all
    if (sameCompany.length === 1) {
      applyLinkedUser(sameCompany[0])
    } else if (sameCompany.length === 0) {
      if (linkedUserId) {
        setLinkedUserId('')
        setName('')
        setUsername('')
        setEmail('')
        setOrganizationName('')
        setPassword('')
      }
    } else if (linkedUserId && !sameCompany.some((u) => u.id === linkedUserId)) {
      setLinkedUserId('')
    }
  }

  const onSoftwareChange = (value: string) => {
    setSoftwareId(value)
    setActiveSoftwareId(value || null)
  }

  const onCompanyAssignmentChange = (vals: string[]) => {
    setCompanyAssignment(clampCompanyAssignment(vals))
    setErrors((prev) => {
      if (!prev.kinds && !prev.supportRoleId) return prev
      const next = { ...prev }
      delete next.kinds
      delete next.supportRoleId
      return next
    })
  }

  if (editForbidden) {
    return (
      <div>
        <PageHeader
          title="ویرایش مجاز نیست"
          description="کاربر متعلق به شرکت دیگر است یا خارج از محدودهٔ مدیریت شماست"
          actions={
            <Button variant="outline" onClick={() => bypassAndLeave('/app/users')}>
              بازگشت
            </Button>
          }
        />
        <p className="rounded-xl border border-border bg-panel p-6 text-sm text-muted">
          نمی‌توان کاربری که به شرکت دیگر تعلق دارد را ویرایش کرد.
        </p>
      </div>
    )
  }

  if (isEdit && id && !existing) {
    return <Navigate to="/app/users" replace />
  }

  const save = () => {
    if (isEdit && existing) {
      if (!canEditAssignedUser(existing.id)) {
        setMessage('ویرایش این کاربر مجاز نیست.')
        return
      }
      const result = upsertUser({
        ...existing,
        name,
        username,
        mobile,
        email,
        password: password || existing.password,
        organizationName,
      })
      if (!result.ok) {
        setErrors(result.fields ?? {})
        setMessage(result.message)
        return
      }
      bypassAndLeave('/app/users')
      return
    }

    const { kinds: submitKinds, supportRoleId: submitSupportRoleId } =
      resolvedAssignment

    if (!softwareId) {
      setMessage('انتخاب نرم‌افزار الزامی است.')
      setErrors({ softwareId: 'نرم‌افزار را انتخاب کنید.' })
      return
    }
    if (!submitKinds.length) {
      setMessage('حداقل یک نقش را انتخاب کنید.')
      setErrors({ kinds: 'حداقل یک نقش را انتخاب کنید.' })
      return
    }
    if (needsSupportRole && !submitSupportRoleId) {
      setMessage('نقش پشتیبان شرکت را انتخاب کنید.')
      setErrors({ kinds: 'یک نقش از نقش‌های شرکت خود انتخاب کنید.' })
      return
    }
    if (foreignCompanyMatch) {
      setErrors({
        mobile: 'این شماره متعلق به کاربر شرکت دیگر است و قابل تخصیص نیست.',
      })
      setMessage('تخصیص کاربر شرکت دیگر مجاز نیست.')
      return
    }
    if (mobile.trim() && !isValidMobile(mobile)) {
      setErrors({ mobile: 'شماره همراه معتبر نیست (مثال: 09000000000).' })
      setMessage('خطاهای فرم را برطرف کنید.')
      return
    }
    if (mobileMatches.length > 1 && !linkedUserId) {
      setErrors({ linkedUserId: 'کاربر موجود را از لیست انتخاب کنید.' })
      setMessage('شماره همراه تکراری است — کاربر را انتخاب کنید.')
      return
    }
    if (alreadyAssignedKinds.length) {
      setErrors({ kinds: 'نقش تکراری — تخصیص مجدد مجاز نیست.' })
      setMessage(
        'این کاربر قبلاً با نقش انتخاب‌شده به این نرم‌افزار تخصیص داده شده است.',
      )
      return
    }

    const result = assignUserToSoftware({
      softwareId,
      kinds: submitKinds,
      name,
      username,
      mobile,
      email,
      password,
      organizationName,
      linkedUserId: linkedUserId || undefined,
      supportRoleId: needsSupportRole ? submitSupportRoleId : undefined,
    })
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    setActiveSoftwareId(softwareId)
    bypassAndLeave('/app/users')
  }

  const assignmentError = errors.kinds || errors.supportRoleId

  return (
    <div>
      <PageHeader
        title={isEdit ? 'ویرایش کاربر' : 'تخصیص / ایجاد کاربر'}
        description={
          isEdit
            ? 'ویرایش مشخصات کاربر'
            : isCompanyActor
              ? 'یک نقش شرکت (اختیاری) و/یا کاربر نهایی را انتخاب کنید'
              : 'می‌توانید هم‌زمان نقش پشتیبان و کاربر نهایی را به یک نفر بدهید'
        }
        actions={
          <Button variant="outline" onClick={() => void confirmAndLeave('/app/users')}>
            بازگشت
          </Button>
        }
      />

      <form
        className="max-w-2xl space-y-4 rounded-xl border border-border bg-panel p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {!isEdit && foreignCompanyMatch ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-ink">
            این شماره همراه متعلق به کاربر شرکت دیگری است و قابل تخصیص یا ویرایش نیست.
          </div>
        ) : null}

        {!isEdit && isLinkedMode ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-ink">
            کاربر موجود با این شماره همراه انتخاب شده و مشخصات قابل ویرایش نیست.
            در صورت اشتباه بودن مشخصات با مالک نرم‌افزار تماس بگیرید.
          </div>
        ) : null}

        {!isEdit && alreadyAssignedKinds.length ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-ink">
            این کاربر قبلاً با نقش انتخاب‌شده به این نرم‌افزار تخصیص داده شده — تخصیص تکراری مجاز نیست.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit ? (
            <Select
              label="نرم‌افزار"
              value={softwareId}
              error={errors.softwareId}
              onChange={(e) => onSoftwareChange(e.target.value)}
              options={assignableSoftwares.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              hint={
                assignableSoftwares.length
                  ? software
                    ? `تخصیص به «${software.name}»`
                    : undefined
                  : 'نرم‌افزاری برای تخصیص در دسترس نیست'
              }
            />
          ) : null}

          {!isEdit && isCompanyActor ? (
            <MultiSelect
              label="نقش‌ها در نرم‌افزار"
              value={companyAssignment}
              error={assignmentError}
              onChange={onCompanyAssignmentChange}
              options={companyAssignmentOptions}
              placeholder="نقش شرکت و/یا کاربر نهایی..."
              hint={
                companySupportRoles.length
                  ? 'حداکثر یک نقش شرکت + کاربر نهایی (ثابت، خارج از نقش‌های من)'
                  : 'ابتدا از «نقش‌های من» نقش بسازید؛ کاربر نهایی همیشه قابل انتخاب است'
              }
            />
          ) : null}

          {!isEdit && !isCompanyActor ? (
            <MultiSelect
              label="نقش‌ها در نرم‌افزار"
              value={kinds}
              error={errors.kinds}
              onChange={(vals) => setKinds(vals as MembershipKind[])}
              options={kindSelectOptions}
              placeholder="پشتیبان و/یا کاربر نهایی..."
              hint="می‌توانید هر دو نقش را هم‌زمان انتخاب کنید"
            />
          ) : null}

          {isEdit && isCompanyActor && existingAssignmentValues.length ? (
            <MultiSelect
              label="نقش‌ها در نرم‌افزار"
              value={existingAssignmentValues}
              options={companyAssignmentOptions}
              onChange={() => {}}
              disabled
              hint="نقش‌های فعلی — از این صفحه قابل تغییر نیست"
            />
          ) : null}

          <Input
            label="شماره همراه"
            value={mobile}
            error={errors.mobile}
            onChange={(e) => onMobileChange(e.target.value)}
            hint={
              !isEdit && mobileMatches.length
                ? `${mobileMatches.length.toLocaleString('fa-IR')} کاربر با این شماره یافت شد`
                : undefined
            }
          />

          {!isEdit && mobileMatches.length > 0 ? (
            <Select
              label="کاربر موجود"
              value={linkedUserId}
              error={errors.linkedUserId}
              onChange={(e) => {
                const u = mobileMatches.find((x) => x.id === e.target.value)
                applyLinkedUser(u)
              }}
              options={[
                { value: '', label: 'انتخاب کنید...' },
                ...mobileMatches.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.username})`,
                })),
              ]}
              hint="با انتخاب، مشخصات از حساب موجود پر می‌شود"
            />
          ) : null}

          <Input
            label="نام"
            value={name}
            error={errors.name}
            disabled={isLinkedMode}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="نام کاربری"
            value={username}
            error={errors.username}
            disabled={isLinkedMode}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="ایمیل"
            value={email}
            disabled={isLinkedMode}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="سازمان"
            value={organizationName}
            disabled={isLinkedMode}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
          {!isEdit && !isLinkedMode ? (
            <Input
              label="رمز عبور"
              type="password"
              value={password}
              error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          {isEdit ? (
            <Input
              label="رمز جدید (اختیاری)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
        </div>
        {message ? <p className="text-sm text-rose-500">{message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void confirmAndLeave('/app/users')}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            disabled={
              !isEdit &&
              (!softwareId ||
                Boolean(foreignCompanyMatch) ||
                alreadyAssignedKinds.length > 0 ||
                !resolvedAssignment.kinds.length ||
                (needsSupportRole && !resolvedAssignment.supportRoleId))
            }
          >
            {isEdit ? 'ذخیره' : isLinkedMode ? 'لینک و تخصیص' : 'ثبت تخصیص'}
          </Button>
        </div>
      </form>
    </div>
  )
}
