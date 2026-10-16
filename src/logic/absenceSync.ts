import type { OrgData } from '../data/schemas'

/**
 * Keeps each person's available/absent status in line with their absence records.
 * Anyone with at least one absence record is "absent" if one is in progress today, otherwise
 * "available". People with no absence records keep whatever status they have.
 */
export function syncStatuses(data: OrgData, today: Date = new Date()): OrgData {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const ms = (iso: string) => new Date(iso + 'T00:00:00').getTime()
  const withRecords = new Set(data.absences.map((a) => a.personId))
  const activeNow = new Set(data.absences.filter((a) => ms(a.start) <= t && (a.end === null || ms(a.end) >= t)).map((a) => a.personId))
  return {
    ...data,
    people: data.people.map((p) => (withRecords.has(p.id) ? { ...p, status: activeNow.has(p.id) ? ('absent' as const) : ('available' as const) } : p)),
  }
}
