// Scenario simulator: "what if these people were suddenly unavailable?"
// It copies the organisation data, marks the chosen people absent, recomputes every metric,
// and compares before vs during. Nothing is ever written back to the real data.

import { COMPETENT_LEVEL, COVER_MAX_CANDIDATES, COVER_SHARE_AMONG, CRITICALITY_WEIGHTS, LOAD_STRETCHED_MAX } from '../config'
import type { OrgData, Scenario, ScenarioSelector, Task } from '../data/schemas'
import { projectBurnout, type BurnoutProjection } from '../rules/burnoutRiskRules'
import type { CoverageStatus } from './coverage'
import { taskCoverage } from './coverage'
import { teamLoad, type TeamLoad } from './load'
import { orgMetrics, type OrgMetrics } from './resilienceScore'
import type { PeriodResult } from './wellbeing'

// ---------- choosing who is affected ----------

const availablePeople = (data: OrgData) => data.people.filter((p) => p.status === 'available')

/**
 * How hard someone would be to replace: for every task they are competent in, add the task's
 * weight divided by the number of competent available people. Used for "worst case" picks.
 */
export function irreplaceability(data: OrgData): Map<string, number> {
  const score = new Map<string, number>()
  for (const task of data.tasks) {
    const cover = taskCoverage(data, task)
    for (const id of cover.competentAvailable) {
      score.set(id, (score.get(id) ?? 0) + CRITICALITY_WEIGHTS[task.criticality] / cover.count)
    }
  }
  return score
}

/** Picks n people from the pool: evenly spread (typical) or the hardest to replace (worst case). */
function pick(data: OrgData, pool: string[], n: number, worstCase: boolean): string[] {
  if (n <= 0 || pool.length === 0) return []
  n = Math.min(n, pool.length)
  if (worstCase) {
    const score = irreplaceability(data)
    return [...pool].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a.localeCompare(b)).slice(0, n)
  }
  const sorted = [...pool].sort()
  return Array.from({ length: n }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / n)])
}

/** The ids of the people the scenario takes away (only people who are available today). */
export function resolveAffected(data: OrgData, selector: ScenarioSelector): string[] {
  const available = availablePeople(data)
  switch (selector.kind) {
    case 'people': {
      const ok = new Set(available.map((p) => p.id))
      return selector.personIds.filter((id) => ok.has(id))
    }
    case 'role':
      return available.filter((p) => p.role === selector.role).map((p) => p.id)
    case 'team-percent': {
      const pool = available.filter((p) => selector.teamId === 'all' || p.teamId === selector.teamId).map((p) => p.id)
      let n = Math.round((selector.percent / 100) * pool.length)
      if (selector.percent > 0 && n === 0) n = 1
      return pick(data, pool, n, selector.worstCase)
    }
  }
}

/** A copy of the data with the affected people marked absent. */
export function applyScenario(data: OrgData, affectedIds: string[]): OrgData {
  const gone = new Set(affectedIds)
  return { ...data, people: data.people.map((p) => (gone.has(p.id) ? { ...p, status: 'absent' as const } : p)) }
}

// ---------- the comparison ----------

export interface TaskChange {
  task: Task
  before: { count: number; status: CoverageStatus }
  after: { count: number; status: CoverageStatus }
  isNewSpof: boolean
}

export interface TeamChange {
  teamId: string
  loadBefore: TeamLoad
  loadAfter: TeamLoad
  wellbeing: PeriodResult | null
  burnout: BurnoutProjection
}

export interface CoverCandidate {
  personId: string
  teamId: string
  level: 1 | 2 | 3
  sameTeam: boolean
  hoursShared: number
  /** The candidate's team load ratio if it took on its share of the lost hours. */
  teamRatioIfTaken: number
  overloadWarning: boolean
}

export interface CoverGap {
  task: Task
  lostCompetent: number
  afterCount: number
  hoursAtStake: number
  candidates: CoverCandidate[]
}

export interface ScenarioResult {
  scenario: Scenario
  affectedIds: string[]
  before: OrgMetrics
  after: OrgMetrics
  tasks: TaskChange[]
  teams: TeamChange[]
  gaps: CoverGap[]
}

export function runScenario(data: OrgData, scenario: Scenario): ScenarioResult {
  const affectedIds = resolveAffected(data, scenario.selector)
  const scenarioData = applyScenario(data, affectedIds)
  const before = orgMetrics(data)
  const after = orgMetrics(scenarioData)

  const tasks: TaskChange[] = data.tasks.map((task) => {
    const b = before.coverages.find((c) => c.task.id === task.id)!
    const a = after.coverages.find((c) => c.task.id === task.id)!
    return {
      task,
      before: { count: b.count, status: b.status },
      after: { count: a.count, status: a.status },
      isNewSpof: a.status === 'single-point-of-failure' && b.status !== 'single-point-of-failure',
    }
  })

  const teams: TeamChange[] = data.teams.map((t) => {
    const b = before.teams.find((m) => m.teamId === t.id)!
    const a = after.teams.find((m) => m.teamId === t.id)!
    const baseline = b.wellbeing && !b.wellbeing.hidden ? b.wellbeing.band : null
    return {
      teamId: t.id,
      loadBefore: b.load,
      loadAfter: a.load,
      wellbeing: b.wellbeing,
      burnout: projectBurnout({ baseline, loadAfter: a.load.ratio, weeks: scenario.weeks }),
    }
  })

  return { scenario, affectedIds, before, after, tasks, teams, gaps: coverGaps(scenarioData, tasks) }
}

// ---------- who could cover each gap ----------

/**
 * A gap is a task that LOST competent people and is now thin or a single point of failure.
 * Candidates are available people at proficiency 1 or more who are not already counted as
 * competent (people at 2+ are already in the numbers). Ranked by proficiency, then by how
 * much room their team has. The lost hours are assumed to be shared between the top few
 * candidates; if that pushes a candidate's team over a load ratio of 1.0 we warn, so cover
 * does not simply move burnout from one team to another.
 */
function coverGaps(scenarioData: OrgData, tasks: TaskChange[]): CoverGap[] {
  const teamOf = new Map(scenarioData.people.map((p) => [p.id, p.teamId]))
  const loadNow = new Map(scenarioData.teams.map((t) => [t.id, teamLoad(scenarioData, t.id)]))
  const gaps: CoverGap[] = []

  for (const tc of tasks) {
    const lost = tc.before.count - tc.after.count
    if (lost <= 0 || tc.after.status === 'ok') continue
    const hoursAtStake = (tc.task.weeklyHours * lost) / tc.before.count

    const ranked = scenarioData.skills
      .filter((s) => s.taskId === tc.task.id && s.level >= 1 && s.level < COMPETENT_LEVEL)
      .filter((s) => scenarioData.people.find((p) => p.id === s.personId)?.status === 'available')
      .map((s) => ({ personId: s.personId, teamId: teamOf.get(s.personId)!, level: s.level as 1 | 2 | 3 }))
      .sort((a, b) => b.level - a.level || loadNow.get(a.teamId)!.ratio - loadNow.get(b.teamId)!.ratio || a.personId.localeCompare(b.personId))
      .slice(0, COVER_MAX_CANDIDATES)

    const sharers = Math.min(COVER_SHARE_AMONG, ranked.length)
    const hoursShared = sharers === 0 ? 0 : hoursAtStake / sharers
    const candidates: CoverCandidate[] = ranked.map((c, i) => {
      const load = loadNow.get(c.teamId)!
      const sameTeam = c.teamId === tc.task.teamId
      // Same team: the work is already counted in the team's demand, so the ratio is unchanged.
      // Another team: that team takes on extra hours it did not have before.
      const takes = i < sharers && !sameTeam ? hoursShared : 0
      const ratio = load.capacityHours === 0 ? Infinity : (load.demandHours + takes) / load.capacityHours
      return {
        ...c, sameTeam, hoursShared: i < sharers ? hoursShared : 0, teamRatioIfTaken: ratio,
        overloadWarning: ratio > LOAD_STRETCHED_MAX,
      }
    })
    gaps.push({ task: tc.task, lostCompetent: lost, afterCount: tc.after.count, hoursAtStake, candidates })
  }
  // Essential first, then fewest competent people left.
  const crit = { essential: 0, important: 1, deferrable: 2 } as const
  return gaps.sort((a, b) => crit[a.task.criticality] - crit[b.task.criticality] || a.afterCount - b.afterCount)
}

// ---------- presets ----------

/** Ready-made scenarios from the brief. Ids are stable so they can be told apart from saved ones. */
export function presetScenarios(data: OrgData): Scenario[] {
  const score = irreplaceability(data)
  const seniors = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id)
  return [
    { id: 'preset-reserve', name: 'Reserve call-up: 30% of Network Ops for 8 weeks', absenceType: 'reserve-duty', weeks: 8, selector: { kind: 'team-percent', teamId: 'team-netops', percent: 30, worstCase: false } },
    { id: 'preset-flu', name: 'Flu outbreak: 15% across all teams for 2 weeks', absenceType: 'pandemic', weeks: 2, selector: { kind: 'team-percent', teamId: 'all', percent: 15, worstCase: false } },
    { id: 'preset-leavers', name: 'Two senior leavers, 10-week hiring gap', absenceType: 'vacancy', weeks: 10, selector: { kind: 'people', personIds: seniors } },
    // Sites are not modelled, so "one site" is approximated as about one sixth of every team.
    { id: 'preset-flood', name: 'Regional flooding: one site offline for 1 week', absenceType: 'natural-disaster', weeks: 1, selector: { kind: 'team-percent', teamId: 'all', percent: 17, worstCase: false } },
  ]
}

export function describeSelector(data: OrgData, s: ScenarioSelector): string {
  if (s.kind === 'people') return `${s.personIds.length} named ${s.personIds.length === 1 ? 'person' : 'people'}`
  if (s.kind === 'role') return `everyone with the role “${s.role}”`
  const where = s.teamId === 'all' ? 'across all teams' : `in ${data.teams.find((t) => t.id === s.teamId)?.name ?? s.teamId}`
  return `${s.percent}% ${where}${s.worstCase ? ' (worst case: the hardest to replace)' : ''}`
}
