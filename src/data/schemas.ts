// The shape of all data in Steady. Everything else in the app is built on these types.

export type Criticality = 'essential' | 'important' | 'deferrable'
export type ProficiencyLevel = 0 | 1 | 2 | 3 // 0 none, 1 supervised, 2 competent, 3 can train others
export type PersonStatus = 'available' | 'absent'

export type AbsenceType =
  | 'reserve-duty'
  | 'illness'
  | 'parental-caring-leave'
  | 'vacancy'
  | 'pandemic'
  | 'natural-disaster'
  | 'other'

export type Certainty = 'confirmed' | 'likely' | 'possible'

export interface Team {
  id: string
  name: string
  leadId: string
  headcount: number
}

export interface Person {
  id: string
  displayName: string // a pseudonym in the demo
  teamId: string
  role: string
  fte: number // 1 = full time
  status: PersonStatus
}

export interface Task {
  id: string
  name: string
  teamId: string // owning team
  criticality: Criticality
  weeklyHours: number // demand per week
  hasDocumentedProcess: boolean
}

export interface SkillRating {
  personId: string
  taskId: string
  level: ProficiencyLevel
}

export interface Absence {
  id: string
  personId: string
  type: AbsenceType
  start: string // ISO date
  end: string | null // null = unknown
  certainty: Certainty
}

/** Anonymous by design: no person id, no name. Only team, time and scores. */
export interface PulseResponse {
  id: string
  teamId: string
  timestamp: string // ISO date
  burnoutScore: number // 0–100
  demandsScore: number // 0–100, our own JD-R items (higher = more demand)
  resourcesScore: number // 0–100 (higher = more resources)
}

export type ScenarioSelector =
  | { kind: 'people'; personIds: string[] }
  | { kind: 'team-percent'; teamId: string | 'all'; percent: number; worstCase: boolean }
  | { kind: 'role'; role: string }

export interface Scenario {
  id: string
  name: string
  absenceType: AbsenceType
  selector: ScenarioSelector
  weeks: number
}

export type RecommendationStatus = 'planned' | 'in-progress' | 'done' | 'not-relevant'

export const STATUS_LABELS: Record<RecommendationStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Done',
  'not-relevant': 'Not relevant',
}

export interface OrgData {
  orgName: string
  teams: Team[]
  people: Person[]
  tasks: Task[]
  skills: SkillRating[]
  absences: Absence[]
  pulses: PulseResponse[]
  scenarios: Scenario[]
  recommendationStatus: Record<string, RecommendationStatus>
}

export type Role = 'hr' | 'team-lead' | 'ceo' | 'employee'

export const ROLE_LABELS: Record<Role, string> = {
  hr: 'HR lead',
  'team-lead': 'Team lead',
  ceo: 'CEO / leadership',
  employee: 'Employee',
}

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  'reserve-duty': 'Reserve / military duty',
  illness: 'Illness',
  'parental-caring-leave': 'Parental / caring leave',
  vacancy: 'Vacancy (not yet replaced)',
  pandemic: 'Pandemic / outbreak',
  'natural-disaster': 'Natural disaster / infrastructure',
  other: 'Other',
}
