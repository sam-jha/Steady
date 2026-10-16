// The ONE place the app reads and writes data. Today it uses the browser's localStorage.
// To connect a real backend or an HR system later, replace the bodies of these functions;
// the rest of the app does not need to change.

import { buildDemoData } from './demoData'
import { parseJsonBackup } from './backup'
import type { OrgData, Role } from './schemas'

const DATA_KEY = 'steady.orgData.v1'
const ROLE_KEY = 'steady.role.v1'

export function loadData(): OrgData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    // Only trust saved data that has the expected lists; otherwise fall back to the demo data.
    const saved = raw ? parseJsonBackup(raw).data : null
    if (saved) return saved
  } catch {
    // Storage blocked or data corrupted: fall through to the demo data.
  }
  return buildDemoData()
}

export function saveData(data: OrgData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the app keeps working for this session, it just won't remember.
  }
}

export function resetData(): OrgData {
  const fresh = buildDemoData()
  saveData(fresh)
  return fresh
}

export function loadRole(): Role {
  try {
    const raw = localStorage.getItem(ROLE_KEY)
    if (raw === 'hr' || raw === 'team-lead' || raw === 'ceo' || raw === 'employee') return raw
  } catch {
    // ignore
  }
  return 'hr'
}

export function saveRole(role: Role): void {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // ignore
  }
}
