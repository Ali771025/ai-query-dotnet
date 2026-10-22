export type Status = 'active' | 'inactive'

export type EntityFilter = {
  id: string
  label: string
}

export type NavItem = {
  label: string
  to: string
  icon?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}
