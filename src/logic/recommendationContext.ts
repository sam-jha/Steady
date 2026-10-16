// Everything the recommendation rules need to know, computed once from the data.
// Rules read this "context" and never touch raw data themselves, which keeps them short.

import { LONG_ABSENCE_DAYS, RETURNING_SOON_DAYS, TREND_RISE_POINTS, TREND_WEEKS } from '../config'
import { ABSENCE_LABELS, type Absence, type OrgData, type Task } from '../data/schemas'
import { taskCoverage } from './coverage'
import { orgMetrics, type OrgMetrics, type TeamMetrics } from './resilienceScore'
import { consecutivePeriodsInBand, teamTrend, type BurnoutBand } from './wellbeing'

const DAY = 86400000

export interface TeamContext {
  id: string
  name: string
  metrics: TeamMetrics
  band: BurnoutBand | null // null when hidden or no data
  wellbeingHidden: boolean
  latestResponses: number
  highStreak: number
  moderateStreak: number
  /** Rise in the team burnout score over the last TREND_WEEKS weeks (visible weeks only), or null. */
  burnoutRise: number | null
  deferrable: Task[]
  undocumentedEssential: Task[]
  /** Absences in progress today. */
  activeAbsences: Absence[]
  openVacancies: number
  longTermAbsences: number
  noEndDateAbsences: number
  returningSoon: number
}

/** Everything a team lead needs to know about one current absence: what is left undone, and who to tell. */
export interface AbsenceBrief {
  absence: Absence
  personId: string
  role: string
  teamId: string
  typeLabel: string
  isVacancy: boolean
  isLongTerm: boolean
  returningSoon: boolean
  /** Tasks this person is competent at, with how many competent people are still available. */
  tasks: Array<{ task: Task; competentLeft: number }>
}

export interface Contact {
  id: string
  teamName: string
  /** True if this person is themselves absent right now. */
  away: boolean
}

export interface RuleContext {
  data: OrgData
  today: Date
  org: OrgMetrics
  teams: TeamContext[]
  teamName: (id: string) => string
  team: (id: string) => TeamContext
  /** Current absences in a team, with the tasks each leaves behind. */
  absenceBriefs: (teamId: string) => AbsenceBrief[]
  /** The team lead of a team. */
  leadOf: (teamId: string) => Contact
  /** The HR contact (lead of the HR team), or null if the organisation has no HR team. */
  hrContact: () => Contact | null
  /** Total number of people (available or not) competent at the task: the structural depth. */
  trainedCount: (taskId: string) => number
  /** Available people at proficiency 1 on a task (could shadow), same team first. */
  shadowCandidates: (taskId: string) => string[]
}

const isoToMs = (iso: string) => new Date(iso + 'T00:00:00').getTime()

export function buildContext(data: OrgData, today: Date = new Date()): RuleContext {
  const org = orgMetrics(data)
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const personTeam = new Map(data.people.map((p) => [p.id, p.teamId]))

  const teams: TeamContext[] = data.teams.map((t) => {
    const metrics = org.teams.find((m) => m.teamId === t.id)!
    const wb = metrics.wellbeing
    const visible = teamTrend(data.pulses, t.id).filter((p): p is Extract<typeof p, { hidden: false }> => !p.hidden)
    const recent = visible.slice(-(TREND_WEEKS + 1))
    const burnoutRise = recent.length === TREND_WEEKS + 1 ? recent[recent.length - 1].meanScore - recent[0].meanScore : null

    const absences = data.absences.filter((a) => personTeam.get(a.personId) === t.id)
    const active = absences.filter((a) => isoToMs(a.start) <= todayMs && (a.end === null || isoToMs(a.end) >= todayMs))
    const durationDays = (a: Absence) => (a.end === null ? Infinity : (isoToMs(a.end) - isoToMs(a.start)) / DAY)

    return {
      id: t.id,
      name: t.name,
      metrics,
      band: wb && !wb.hidden ? wb.band : null,
      wellbeingHidden: !wb || wb.hidden,
      latestResponses: wb?.responses ?? 0,
      highStreak: consecutivePeriodsInBand(data.pulses, t.id, 'high'),
      moderateStreak: consecutivePeriodsInBand(data.pulses, t.id, 'moderate'),
      burnoutRise: burnoutRise !== null && burnoutRise >= TREND_RISE_POINTS ? burnoutRise : null,
      deferrable: data.tasks.filter((k) => k.teamId === t.id && k.criticality === 'deferrable' && k.weeklyHours > 0),
      undocumentedEssential: data.tasks.filter((k) => k.teamId === t.id && k.criticality === 'essential' && !k.hasDocumentedProcess),
      activeAbsences: active,
      openVacancies: active.filter((a) => a.type === 'vacancy').length,
      longTermAbsences: active.filter((a) => a.type !== 'vacancy' && durationDays(a) > LONG_ABSENCE_DAYS).length,
      noEndDateAbsences: active.filter((a) => a.end === null).length,
      returningSoon: active.filter((a) => a.type !== 'vacancy' && a.end !== null && isoToMs(a.end) - todayMs <= RETURNING_SOON_DAYS * DAY).length,
    }
  })

  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const personById = new Map(data.people.map((p) => [p.id, p]))
  const contactFor = (teamId: string): Contact => {
    const team = data.teams.find((t) => t.id === teamId)!
    return { id: team.leadId, teamName: team.name, away: personById.get(team.leadId)?.status === 'absent' }
  }
  const absenceBriefs = (teamId: string): AbsenceBrief[] =>
    teamMap.get(teamId)!.activeAbsences.map((a) => {
      const person = personById.get(a.personId)!
      const duration = a.end === null ? Infinity : (isoToMs(a.end) - isoToMs(a.start)) / DAY
      return {
        absence: a, personId: a.personId, role: person.role, teamId, typeLabel: ABSENCE_LABELS[a.type],
        isVacancy: a.type === 'vacancy',
        isLongTerm: a.type !== 'vacancy' && duration > LONG_ABSENCE_DAYS,
        returningSoon: a.type !== 'vacancy' && a.end !== null && isoToMs(a.end) - todayMs <= RETURNING_SOON_DAYS * DAY,
        tasks: data.skills
          .filter((s) => s.personId === a.personId && s.level >= 2)
          .map((s) => data.tasks.find((k) => k.id === s.taskId)!)
          .filter(Boolean)
          .map((task) => ({ task, competentLeft: taskCoverage(data, task).count }))
          .sort((x, y) => x.competentLeft - y.competentLeft),
      }
    })
  return {
    data, today, org, teams, absenceBriefs, leadOf: contactFor,
    hrContact: () => {
      const hr = data.teams.find((t) => /\bHR\b|human resources|people/i.test(t.name))
      return hr ? contactFor(hr.id) : null
    },
    teamName: (id) => teamMap.get(id)?.name ?? id,
    team: (id) => teamMap.get(id)!,
    trainedCount: (taskId) => data.skills.filter((s) => s.taskId === taskId && s.level >= 2).length,
    shadowCandidates: (taskId) => {
      const task = data.tasks.find((k) => k.id === taskId)
      const available = new Set(data.people.filter((p) => p.status === 'available').map((p) => p.id))
      return data.skills
        .filter((s) => s.taskId === taskId && s.level === 1 && available.has(s.personId))
        .map((s) => s.personId)
        .sort((a, b) => Number(personTeam.get(b) === task?.teamId) - Number(personTeam.get(a) === task?.teamId) || a.localeCompare(b))
    },
  }
}
