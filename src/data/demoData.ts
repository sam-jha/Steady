// Fictional demo organisation: "Meridian Networks". Nothing here is real.
// The data is generated from a fixed random seed, so it is the same every time,
// but dates are relative to "today" so the absences always look current.

import { HOURS_PER_FTE } from '../config'
import type {
  Absence,
  AbsenceType,
  Certainty,
  Criticality,
  OrgData,
  Person,
  ProficiencyLevel,
  PulseResponse,
  SkillRating,
  Task,
  Team,
} from './schemas'

// ---------- tiny helpers ----------

/** Small seeded random number generator, so the demo is repeatable. */
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dayMs = 24 * 60 * 60 * 1000
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * dayMs)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// ---------- what the organisation looks like ----------

interface TaskSpec {
  name: string
  criticality: Criticality
  /** Share of the team's total demand (shares in a team are scaled to add up). */
  share: number
  documented: boolean
  /**
   * Which team members (by position, 0 = team lead) are competent (level 2–3).
   * Everyone else is level 0–1. Short lists create deliberate thin spots.
   */
  competent: number[]
}

interface TeamSpec {
  id: string
  name: string
  code: string
  headcount: number
  roles: string[] // cycled through for the people in the team
  targetLoad: number // load ratio when everyone is present
  tasks: TaskSpec[]
}

/** Positions 0..n-1 as a list, optionally skipping some. */
const range = (n: number, skip: number[] = []) =>
  Array.from({ length: n }, (_, i) => i).filter((i) => !skip.includes(i))

const TEAM_SPECS: TeamSpec[] = [
  {
    id: 'team-netops',
    name: 'Network Operations',
    code: 'NOP',
    headcount: 24,
    roles: ['Network Engineer', 'NOC Analyst', 'Network Architect'],
    targetLoad: 0.8,
    tasks: [
      // Deliberate single point of failure once reserve duty starts: only #1 (on reserve duty) and #2.
      { name: 'Core network monitoring', criticality: 'essential', share: 0.26, documented: false, competent: [1, 2] },
      { name: 'Fault escalation & triage', criticality: 'essential', share: 0.22, documented: true, competent: [0, 4, 5, 6, 9] },
      { name: 'Capacity planning', criticality: 'important', share: 0.14, documented: true, competent: range(8, [1, 4]) },
      { name: 'Change management', criticality: 'important', share: 0.18, documented: true, competent: range(12) },
      { name: 'Routine config backups', criticality: 'deferrable', share: 0.08, documented: true, competent: range(20) },
      { name: 'Vendor reporting', criticality: 'deferrable', share: 0.06, documented: false, competent: [0, 3] },
    ],
  },
  {
    id: 'team-field',
    name: 'Field Engineering',
    code: 'FLD',
    headcount: 26,
    roles: ['Field Technician', 'Senior Field Engineer', 'Site Surveyor'],
    targetLoad: 0.72,
    tasks: [
      { name: 'Fibre fault repair', criticality: 'essential', share: 0.3, documented: true, competent: range(18) },
      { name: 'Emergency site attendance', criticality: 'essential', share: 0.2, documented: true, competent: range(10, [2]) },
      { name: 'New site installation', criticality: 'important', share: 0.24, documented: true, competent: range(14) },
      { name: 'Equipment audits', criticality: 'deferrable', share: 0.1, documented: true, competent: range(16) },
      { name: 'Site safety inspections', criticality: 'important', share: 0.16, documented: false, competent: [0, 3, 7] },
    ],
  },
  {
    id: 'team-support',
    name: 'Customer Support',
    code: 'CSP',
    headcount: 30,
    roles: ['Support Agent', 'Senior Agent', 'Support Specialist'],
    targetLoad: 0.82,
    tasks: [
      { name: 'Inbound enquiries', criticality: 'essential', share: 0.34, documented: true, competent: range(26) },
      { name: 'Outage communications', criticality: 'essential', share: 0.16, documented: false, competent: [0, 3, 8, 12] },
      { name: 'Complaint resolution', criticality: 'important', share: 0.22, documented: true, competent: range(14, [3, 6]) },
      { name: 'Enterprise account queries', criticality: 'important', share: 0.16, documented: true, competent: [0, 1, 6, 9] },
      { name: 'Knowledge base updates', criticality: 'deferrable', share: 0.07, documented: true, competent: range(10) },
      { name: 'Customer satisfaction surveys', criticality: 'deferrable', share: 0.05, documented: true, competent: range(8) },
    ],
  },
  {
    id: 'team-security',
    name: 'IT Security',
    code: 'SEC',
    headcount: 12,
    roles: ['Security Analyst', 'Security Engineer', 'Compliance Officer'],
    targetLoad: 0.7,
    tasks: [
      { name: 'Security incident response', criticality: 'essential', share: 0.3, documented: true, competent: [0, 1, 4] },
      // Deliberate single point of failure even with everyone present.
      { name: 'Firewall change control', criticality: 'essential', share: 0.2, documented: false, competent: [2] },
      { name: 'Vulnerability scanning', criticality: 'important', share: 0.24, documented: true, competent: range(6) },
      { name: 'Access reviews', criticality: 'important', share: 0.14, documented: true, competent: range(8) },
      { name: 'Security awareness training', criticality: 'deferrable', share: 0.12, documented: true, competent: [0, 5, 6] },
    ],
  },
  {
    id: 'team-billing',
    name: 'Billing & Finance',
    code: 'BIL',
    headcount: 24,
    roles: ['Billing Analyst', 'Finance Officer', 'Credit Controller'],
    targetLoad: 0.68,
    tasks: [
      { name: 'Monthly billing run', criticality: 'essential', share: 0.32, documented: true, competent: range(8) },
      { name: 'Payroll processing', criticality: 'essential', share: 0.2, documented: false, competent: [0, 2] },
      { name: 'Payment reconciliation', criticality: 'important', share: 0.24, documented: true, competent: range(14) },
      { name: 'Credit control', criticality: 'important', share: 0.14, documented: true, competent: range(10, [1]) },
      { name: 'Management reporting', criticality: 'deferrable', share: 0.1, documented: true, competent: [0, 4, 5] },
    ],
  },
  {
    id: 'team-hr',
    name: 'HR & Admin',
    code: 'HRA',
    headcount: 4,
    roles: ['HR Partner', 'HR Administrator', 'Office Coordinator'],
    targetLoad: 0.65,
    tasks: [
      { name: 'Employee queries & case handling', criticality: 'essential', share: 0.4, documented: true, competent: [0, 1, 2] },
      { name: 'Recruitment coordination', criticality: 'important', share: 0.3, documented: true, competent: [0, 3] },
      { name: 'Workforce records', criticality: 'important', share: 0.2, documented: false, competent: [1] },
      { name: 'Office administration', criticality: 'deferrable', share: 0.1, documented: true, competent: [2, 3] },
    ],
  },
]


// Absences: which team member (by position) is away, why, and for how long.
interface AbsenceSpec {
  teamId: string
  position: number
  type: AbsenceType
  startDaysAgo: number
  endDaysFromNow: number | null
  certainty: Certainty
}

const ABSENCE_SPECS: AbsenceSpec[] = [
  { teamId: 'team-netops', position: 1, type: 'reserve-duty', startDaysAgo: 18, endDaysFromNow: 38, certainty: 'confirmed' },
  { teamId: 'team-netops', position: 4, type: 'reserve-duty', startDaysAgo: 18, endDaysFromNow: 38, certainty: 'confirmed' },
  { teamId: 'team-field', position: 2, type: 'reserve-duty', startDaysAgo: 10, endDaysFromNow: 46, certainty: 'likely' },
  { teamId: 'team-support', position: 3, type: 'parental-caring-leave', startDaysAgo: 60, endDaysFromNow: 120, certainty: 'confirmed' },
  { teamId: 'team-support', position: 6, type: 'illness', startDaysAgo: 25, endDaysFromNow: null, certainty: 'possible' },
]

// Vacancies: a placeholder "person" who is not yet hired. They have no skills.
const VACANCY_SPECS = [
  { teamId: 'team-netops', role: 'Vacancy: Network Engineer', startDaysAgo: 35, endDaysFromNow: 40 },
  { teamId: 'team-security', role: 'Vacancy: Security Analyst', startDaysAgo: 50, endDaysFromNow: 25 },
]

// ---------- builders ----------

export function buildDemoData(today: Date = new Date()): OrgData {
  const rng = makeRng(20240611)
  const teams: Team[] = []
  const people: Person[] = []
  const tasks: Task[] = []
  const skills: SkillRating[] = []
  const absences: Absence[] = []

  // Remember who sits at each position in each team, so absences and skills can point at them.
  const membersByTeam: Record<string, Person[]> = {}

  for (const spec of TEAM_SPECS) {
    const members: Person[] = []
    for (let i = 0; i < spec.headcount; i++) {
      const id = `${spec.code}-${String(i + 1).padStart(2, '0')}`
      // Part-time staff are about 1 in 6. Team leads are always full time.
      const fte = i > 0 && rng() < 0.17 ? 0.6 : 1
      members.push({
        id,
        displayName: id, // pseudonym
        teamId: spec.id,
        role: i === 0 ? 'Team Lead' : spec.roles[i % spec.roles.length],
        fte,
        status: 'available',
      })
    }
    membersByTeam[spec.id] = members
    people.push(...members)
    teams.push({ id: spec.id, name: spec.name, leadId: members[0].id, headcount: spec.headcount })

    // Scale task hours so the team's essential + important demand matches its target load.
    const capacity = members.reduce((sum, p) => sum + p.fte * HOURS_PER_FTE, 0)
    const counted = spec.tasks.filter((t) => t.criticality !== 'deferrable')
    const countedShare = counted.reduce((sum, t) => sum + t.share, 0)
    const targetDemand = capacity * spec.targetLoad
    spec.tasks.forEach((t, ti) => {
      const hours =
        t.criticality === 'deferrable'
          ? Math.round(capacity * t.share * 0.4) // deferrable work sits on top of the target
          : Math.round((t.share / countedShare) * targetDemand)
      const taskId = `${spec.code}-T${ti + 1}`
      tasks.push({
        id: taskId,
        name: t.name,
        teamId: spec.id,
        criticality: t.criticality,
        weeklyHours: hours,
        hasDocumentedProcess: t.documented,
      })

      // Skills for the owning team: listed people are competent, others are 0 or 1.
      members.forEach((p, pi) => {
        let level: ProficiencyLevel
        if (t.competent.includes(pi)) {
          level = rng() < 0.3 ? 3 : 2
        } else {
          level = rng() < 0.35 ? 1 : 0
        }
        skills.push({ personId: p.id, taskId, level })
      })
    })
  }

  // A few cross-team skills, so the scenario tool can suggest cover from other teams.
  const crossSkills: Array<[string, number, string, ProficiencyLevel]> = [
    ['team-field', 5, 'NOP-T4', 2], // field engineer who also understands change management
    ['team-field', 6, 'NOP-T1', 1], // some monitoring exposure
    ['team-field', 9, 'NOP-T2', 1],
    ['team-security', 3, 'NOP-T1', 1],
    ['team-support', 2, 'CSP-T2', 2],
    ['team-netops', 8, 'CSP-T2', 1], // network engineer can help with outage comms
    ['team-hr', 1, 'BIL-T2', 1], // HR admin has payroll exposure
  ]
  for (const [teamId, pos, taskId, level] of crossSkills) {
    const person = membersByTeam[teamId][pos]
    const existing = skills.find((s) => s.personId === person.id && s.taskId === taskId)
    if (existing) existing.level = level
    else skills.push({ personId: person.id, taskId, level })
  }

  // Current absences.
  ABSENCE_SPECS.forEach((a, i) => {
    const person = membersByTeam[a.teamId][a.position]
    person.status = 'absent'
    absences.push({
      id: `abs-${i + 1}`,
      personId: person.id,
      type: a.type,
      start: isoDate(addDays(today, -a.startDaysAgo)),
      end: a.endDaysFromNow === null ? null : isoDate(addDays(today, a.endDaysFromNow)),
      certainty: a.certainty,
    })
  })

  // Vacancies (placeholder people with no skills).
  VACANCY_SPECS.forEach((v, i) => {
    const code = TEAM_SPECS.find((t) => t.id === v.teamId)!.code
    const id = `${code}-VAC${i + 1}`
    people.push({ id, displayName: id, teamId: v.teamId, role: v.role, fte: 1, status: 'absent' })
    absences.push({
      id: `abs-vac-${i + 1}`,
      personId: id,
      type: 'vacancy',
      start: isoDate(addDays(today, -v.startDaysAgo)),
      end: isoDate(addDays(today, v.endDaysFromNow)),
      certainty: 'likely',
    })
  })

  // 12 weeks of anonymous pulse responses.
  const pulses = buildPulseHistory(today, teams, rng)

  return {
    orgName: 'Meridian Networks',
    teams,
    people,
    tasks,
    skills,
    absences,
    pulses,
    scenarios: [],
    recommendationStatus: {},
  }
}

/**
 * Weekly aggregated pulse history. Network Ops and Customer Support drift upwards
 * towards "High"; the other teams stay stable. HR & Admin only ever has 3 responses a
 * week, which is under the anonymity threshold, so its results stay hidden.
 */
function buildPulseHistory(today: Date, teams: Team[], rng: () => number): PulseResponse[] {
  const WEEKS = 12
  // [score at start, score at end] on the 0–100 burnout scale.
  const trend: Record<string, [number, number]> = {
    'team-netops': [34, 68],
    'team-support': [38, 64],
    'team-field': [30, 40],
    'team-security': [32, 36],
    'team-billing': [28, 31],
    'team-hr': [30, 34],
  }
  const responses: PulseResponse[] = []
  for (let w = 0; w < WEEKS; w++) {
    const date = addDays(today, -(WEEKS - 1 - w) * 7)
    for (const team of teams) {
      const [from, to] = trend[team.id]
      const base = from + ((to - from) * w) / (WEEKS - 1)
      const count = team.id === 'team-hr' ? 3 : Math.max(5, Math.round(team.headcount * 0.6))
      for (let r = 0; r < count; r++) {
        const burnout = clamp(Math.round(base + (rng() - 0.5) * 24), 0, 100)
        responses.push({
          id: `pulse-${team.id}-${w}-${r}`,
          teamId: team.id,
          timestamp: isoDate(date), // one date per week keeps every response in its own reporting week
          burnoutScore: burnout,
          demandsScore: clamp(Math.round(burnout * 0.8 + 15 + (rng() - 0.5) * 20), 0, 100),
          resourcesScore: clamp(Math.round(85 - burnout * 0.6 + (rng() - 0.5) * 20), 0, 100),
        })
      }
    }
  }
  return responses
}
