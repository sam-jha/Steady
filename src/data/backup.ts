// Small helpers kept separate from the spreadsheet code, so the main app bundle stays light.
import type { OrgData } from './schemas'

export function parseJsonBackup(text: string): { data: OrgData | null; error: string | null } {
  let obj: unknown
  try { obj = JSON.parse(text) } catch { return { data: null, error: 'That file is not valid JSON.' } }
  const o = obj as Partial<OrgData>
  const lists = ['teams', 'people', 'tasks', 'skills', 'absences', 'pulses', 'scenarios'] as const
  const bad = lists.filter((k) => !Array.isArray(o?.[k]))
  if (!o || typeof o !== 'object' || bad.length > 0) return { data: null, error: `This does not look like a Steady export. Missing lists: ${bad.join(', ') || 'all'}.` }
  const full = o as OrgData
  return { data: { ...full, orgName: typeof full.orgName === 'string' ? full.orgName : 'Imported organisation', recommendationStatus: full.recommendationStatus ?? {} }, error: null }
}

export function emptyOrg(): OrgData {
  return { orgName: 'My organisation', teams: [], people: [], tasks: [], skills: [], absences: [], pulses: [], scenarios: [], recommendationStatus: {} }
}

