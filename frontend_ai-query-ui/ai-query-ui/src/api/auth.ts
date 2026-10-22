export type PersonaDto = { code: string; tenantId: string; organizationId?: string | null; softwareId?: string | null }
export type MeDto = { userId: string; username: string; displayName: string; email?: string | null; mobile?: string | null; activePersona?: string | null; activeTenantId?: string | null; activeOrganizationId?: string | null; activeSoftwareId?: string | null; permissions: string[]; availablePersonas: PersonaDto[] }

let csrfToken: string | null = null

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET'
  if (method !== 'GET' && !csrfToken) {
    const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' })
    if (!response.ok) throw new Error('دریافت توکن امنیتی ناموفق بود.')
    csrfToken = (await response.json() as { token: string }).token
  }
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { title?: string } | null
    throw new Error(problem?.title ?? 'درخواست ناموفق بود.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export const authApi = {
  me: () => request<MeDto>('/api/v1/auth/me'),
  login: (username: string, password: string) => request<MeDto>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  selectPersona: (persona: PersonaDto) => request<MeDto>('/api/v1/auth/persona', { method: 'PUT', body: JSON.stringify({ persona: persona.code, tenantId: persona.tenantId, organizationId: persona.organizationId, softwareId: persona.softwareId }) }),
  switchSoftware: (softwareId: string | null) => request<MeDto>('/api/v1/auth/active-software', { method: 'PUT', body: JSON.stringify({ softwareId }) }),
  logout: () => request<void>('/api/v1/auth/logout', { method: 'POST' }),
}
