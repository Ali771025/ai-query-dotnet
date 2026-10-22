import type { MeDto } from './auth'

export type CatalogPage<T>={items:T[];page:number;pageSize:number;total:number}
export type SoftwareDto={id:string;tenantId:string;ownerOrganizationId:string;code:string;name:string;status:string;versionCount:number;knowledgeStatus:string;version:number}
export type DatabaseDto={id:string;softwareId:string;code:string;name:string;dialect:string;introducedVersionId?:string|null;removedVersionId?:string|null;isActive:boolean;version:number}
export type VersionDto={id:string;softwareId:string;label:string;releaseDate?:string|null;status:string;dependencies:string[];knowledgeStatus:string;version:number}

let csrf:string|null=null
async function call<T>(path:string,init?:RequestInit):Promise<T>{const method=init?.method?.toUpperCase()??'GET';if(method!=='GET'&&!csrf){const r=await fetch('/api/v1/auth/csrf',{credentials:'include'});if(!r.ok)throw new Error('دریافت توکن امنیتی ناموفق بود.');csrf=(await r.json() as {token:string}).token}const r=await fetch(path,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-TOKEN':csrf}:{}),...init?.headers}});if(!r.ok){const p=await r.json().catch(()=>null) as {title?:string;code?:string}|null;const e=new Error(p?.title??'عملیات کاتالوگ ناموفق بود.');Object.assign(e,{code:p?.code,status:r.status});throw e}return r.status===204?undefined as T:r.json() as Promise<T>}
const query=(value:Record<string,string|number|boolean|null|undefined>)=>new URLSearchParams(Object.entries(value).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,String(v)])).toString()
export const catalogApi={
 listSoftware:(scope:Pick<MeDto,'activeTenantId'|'activeOrganizationId'>,page=1,pageSize=50,filter='')=>call<CatalogPage<SoftwareDto>>(`/api/v1/catalog/software?${query({tenantId:scope.activeTenantId,organizationId:scope.activeOrganizationId,page,pageSize,filter,sort:'code',desc:false})}`),
 createSoftware:(body:{tenantId:string;ownerOrganizationId:string;code:string;name:string})=>call<SoftwareDto>('/api/v1/catalog/software',{method:'POST',body:JSON.stringify(body)}),
 updateSoftware:(softwareId:string,body:Record<string,unknown>)=>call<SoftwareDto>(`/api/v1/catalog/software/${softwareId}`,{method:'PUT',body:JSON.stringify(body)}),
 deleteSoftware:(softwareId:string,tenantId:string,organizationId:string|null|undefined,version:number)=>call<SoftwareDto>(`/api/v1/catalog/software/${softwareId}?${query({tenantId,organizationId,version})}`,{method:'DELETE'}),
 listDatabases:(softwareId:string,tenantId:string,organizationId?:string|null)=>call<CatalogPage<DatabaseDto>>(`/api/v1/catalog/software/${softwareId}/databases?${query({tenantId,organizationId,page:1,pageSize:200})}`),
 saveDatabase:(softwareId:string,body:Record<string,unknown>,id?:string)=>call<DatabaseDto>(`/api/v1/catalog/software/${softwareId}/databases${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(body)}),
 deleteDatabase:(softwareId:string,databaseId:string,tenantId:string,organizationId:string|null|undefined,version:number)=>call<DatabaseDto>(`/api/v1/catalog/software/${softwareId}/databases/${databaseId}?${query({tenantId,organizationId,version})}`,{method:'DELETE'}),
 listVersions:(softwareId:string,tenantId:string,organizationId?:string|null)=>call<CatalogPage<VersionDto>>(`/api/v1/catalog/software/${softwareId}/versions?${query({tenantId,organizationId,page:1,pageSize:200})}`),
 createVersion:(softwareId:string,body:Record<string,unknown>)=>call<VersionDto>(`/api/v1/catalog/software/${softwareId}/versions`,{method:'POST',body:JSON.stringify(body)}),
 updateVersion:(softwareId:string,versionId:string,body:Record<string,unknown>)=>call<VersionDto>(`/api/v1/catalog/software/${softwareId}/versions/${versionId}`,{method:'PUT',body:JSON.stringify(body)}),
 addDependency:(softwareId:string,versionId:string,body:Record<string,unknown>)=>call<VersionDto>(`/api/v1/catalog/software/${softwareId}/versions/${versionId}/dependencies`,{method:'POST',body:JSON.stringify(body)}),
 retireVersion:(softwareId:string,versionId:string,body:Record<string,unknown>)=>call<VersionDto>(`/api/v1/catalog/software/${softwareId}/versions/${versionId}/retire`,{method:'PUT',body:JSON.stringify(body)}),
}
