// Which pages each role can see, and where each role lands first.
import type { Role } from './data/schemas'

export interface NavItem {
  path: string
  label: string
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/summary', label: 'Executive summary', roles: ['hr', 'ceo'] },
  { path: '/dashboard', label: 'Resilience dashboard', roles: ['hr', 'team-lead'] },
  { path: '/scenarios', label: 'What if…?', roles: ['hr', 'team-lead'] },
  { path: '/recommendations', label: 'Recommendations', roles: ['hr', 'team-lead'] },
  { path: '/data', label: 'Data', roles: ['hr'] },
  { path: '/pulse', label: 'Wellbeing pulse', roles: ['employee'] },
  { path: '/support', label: 'Support library', roles: ['employee'] },
  { path: '/help', label: 'Need support now?', roles: ['employee'] },
  { path: '/about', label: 'About', roles: ['hr', 'team-lead', 'ceo', 'employee'] },
]

export const HOME_FOR_ROLE: Record<Role, string> = {
  hr: '/dashboard',
  'team-lead': '/dashboard',
  ceo: '/summary',
  employee: '/pulse',
}

export const navFor = (role: Role) => NAV_ITEMS.filter((n) => n.roles.includes(role))
