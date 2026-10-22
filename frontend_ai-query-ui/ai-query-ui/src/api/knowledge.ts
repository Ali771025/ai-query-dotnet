export type KnowledgeScope = { tenantId: string; organizationId: string; softwareId: string; versionId: string }
export type SnapshotDto = { id: string; versionId: string; state: string; manifestHash?: string | null; ingestedHash?: string | null; approvedBy?: string | null; version: number }
export type KnowledgeJobDto = { jobId: string; snapshotId: string; state: string; progress: number; attemptCount: number; maxAttempts: number; lastErrorCode?: string | null; version: number }
export type KnowledgeFileDto = { identityId: string; revisionId: string; path: string; revisionNumber: number; contentHash: string; mediaType: string; sizeBytes: number; isActive: boolean; createdAtUtc: string }

let csrf: string | null = null
async function token() { if (csrf) return csrf; const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' }); if (!response.ok) throw new Error('دریافت توکن امنیتی ناموفق بود.'); csrf = (await response.json() as { token: string }).token; return csrf }
async function call<T>(path: string, init?: RequestInit): Promise<T> { const method = init?.method?.toUpperCase() ?? 'GET'; const headers = new Headers(init?.headers); if (method !== 'GET') headers.set('X-CSRF-TOKEN', await token()); if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json'); const response = await fetch(path, { ...init, headers, credentials: 'include' }); if (!response.ok) { const problem = await response.json().catch(() => null) as { title?: string } | null; throw new Error(problem?.title ?? 'عملیات دانش نسخه ناموفق بود.'); } return response.status === 204 ? undefined as T : response.json() as Promise<T> }
const base = (scope: KnowledgeScope) => `/api/v1/catalog/software/${scope.softwareId}/versions/${scope.versionId}/knowledge`
const query = (values: Record<string, string | number>) => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString()

export const knowledgeApi = {
  latest: (scope: KnowledgeScope) => call<SnapshotDto | null>(`${base(scope)}/snapshots/latest?${query({ tenantId: scope.tenantId, organizationId: scope.organizationId })}`),
  createDraft: (scope: KnowledgeScope) => call<SnapshotDto>(`${base(scope)}/snapshots`, { method: 'POST', body: JSON.stringify({ tenantId: scope.tenantId, organizationId: scope.organizationId, version: 0 }) }),
  upload: (scope: KnowledgeScope, snapshotId: string, files: File[]) => { const data = new FormData(); files.forEach(file => data.append('files', file)); return call<{ snapshot: SnapshotDto; files: KnowledgeFileDto[] }>(`${base(scope)}/snapshots/${snapshotId}/files?${query({ tenantId: scope.tenantId, organizationId: scope.organizationId })}`, { method: 'POST', body: data }) },
  start: (scope: KnowledgeScope, snapshot: SnapshotDto) => call<KnowledgeJobDto>(`${base(scope)}/snapshots/${snapshot.id}/ingestion`, { method: 'POST', body: JSON.stringify({ tenantId: scope.tenantId, organizationId: scope.organizationId, version: snapshot.version, idempotencyKey: `ingest:${snapshot.id}:${snapshot.version}` }) }),
  job: (scope: KnowledgeScope, jobId: string) => call<KnowledgeJobDto>(`${base(scope)}/jobs/${jobId}?${query({ tenantId: scope.tenantId, organizationId: scope.organizationId })}`),
  files: (scope: KnowledgeScope, snapshotId: string, page = 1, folder = '') => call<{ items: KnowledgeFileDto[]; totalCount: number }>(`${base(scope)}/snapshots/${snapshotId}/files?${query({ tenantId: scope.tenantId, organizationId: scope.organizationId, page, pageSize: 100, folder })}`),
  approve: (scope: KnowledgeScope, snapshot: SnapshotDto) => call<SnapshotDto>(`${base(scope)}/snapshots/${snapshot.id}/approve`, { method: 'POST', body: JSON.stringify({ tenantId: scope.tenantId, organizationId: scope.organizationId, version: snapshot.version }) }),
  publish: (scope: KnowledgeScope, snapshot: SnapshotDto, pointerVersion: number) => call(`${base(scope)}/snapshots/${snapshot.id}/publish`, { method: 'POST', body: JSON.stringify({ tenantId: scope.tenantId, organizationId: scope.organizationId, snapshotVersion: snapshot.version, pointerVersion }) }),
}
