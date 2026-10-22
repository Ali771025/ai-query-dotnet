import type { Status } from './common'

export type SoftwareManager = {
  id: string
  name: string
  email: string
  organization: string
  status: Status
  tokenBalance: number
  createdAt: string
}

export type ManagerAccess = {
  managerId: string
  managerName: string
  dataAccess: boolean
  otherManagersAccess: boolean
  securityControl: boolean
}

export type TokenCharge = {
  id: string
  managerId: string
  managerName: string
  amount: number
  type: 'charge' | 'consume' | 'adjust'
  date: string
  note: string
}

export type ConsumptionRule = {
  id: string
  name: string
  unit: string
  costPerUnit: number
  description: string
  active: boolean
}

export type SecurityLog = {
  id: string
  timestamp: string
  event: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  ip: string
  actor: string
  detail: string
}

export type UserLog = {
  id: string
  timestamp: string
  user: string
  entity: string
  action: string
  detail: string
}

export type PaymentTransaction = {
  id: string
  date: string
  managerName: string
  packageName: string
  amount: number
  status: 'success' | 'pending' | 'failed'
}
