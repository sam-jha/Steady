// Overall resilience score (0–100) = weighted blend of coverage, load and wellbeing.
// Theory: organisational resilience is planned in advance (Lengnick-Hall et al., 2011;
// Burnard et al., 2018). The three parts map to the three pillars: adaptability (coverage),
// crisis preparedness (capacity vs demand) and wellbeing.

import { SCORE_WEIGHTS } from '../config'
import type { OrgData } from '../data/schemas'
import { coverageForTasks, coverageScore, type TaskCoverage } from './coverage'
import { loadScore, teamLoad, type TeamLoad } from './load'
import { latestPeriod, teamPeriod, teamTrend, type PeriodResult } from './wellbeing'

export interface ScoreParts {
  coverage: number
  load: number
  /** null when the anonymity threshold is not met: wellbeing is then left out of the blend. */
  wellbeing: number | null
}

export function blendScore(parts: ScoreParts): number {
  const entries: Array<[number, number]> = [
    [parts.coverage, SCORE_WEIGHTS.coverage],
    [parts.load, SCORE_WEIGHTS.load],
  ]
  if (parts.wellbeing !== null) entries.push([parts.wellbeing, SCORE_WEIGHTS.wellbeing])
  // If wellbeing is hidden, the remaining weights are scaled up to add to 100% (not treated as zero).
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0)
  return Math.round(entries.reduce((s, [v, w]) => s + v * w, 0) / totalWeight)
}

export interface TeamMetrics {
  teamId: string
  coverages: TaskCoverage[]
  load: TeamLoad
  wellbeing: PeriodResult | null
  parts: ScoreParts
  score: number
}

export function teamMetrics(data: OrgData, teamId: string): TeamMetrics {
  const coverages = coverageForTasks(data, teamId)
  const load = teamLoad(data, teamId)
  const wellbeing = latestPeriod(data.pulses, teamId)
  const parts: ScoreParts = {
    coverage: coverageScore(coverages),
    load: loadScore(load.ratio),
    // Wellbeing score is the opposite of burnout: 100 - mean burnout.
    wellbeing: wellbeing && !wellbeing.hidden ? 100 - wellbeing.meanScore : null,
  }
  return { teamId, coverages, load, wellbeing, parts, score: blendScore(parts) }
}

export interface OrgMetrics {
  teams: TeamMetrics[]
  coverages: TaskCoverage[]
  parts: ScoreParts
  score: number
}

export function orgMetrics(data: OrgData): OrgMetrics {
  const teams = data.teams.map((t) => teamMetrics(data, t.id))
  const coverages = teams.flatMap((t) => t.coverages)

  // Load: each team's load score, weighted by how much work it carries, so one overloaded
  // team pulls the organisation down instead of being averaged away.
  const demandTotal = teams.reduce((s, t) => s + t.load.demandHours, 0)
  const load = demandTotal === 0 ? 100 : Math.round(teams.reduce((s, t) => s + loadScore(t.load.ratio) * t.load.demandHours, 0) / demandTotal)

  // Wellbeing: average of the teams whose results are visible, weighted by response count.
  const visible = teams.filter((t) => t.wellbeing && !t.wellbeing.hidden)
  const responses = visible.reduce((s, t) => s + t.wellbeing!.responses, 0)
  const wellbeing = responses === 0 ? null : Math.round(visible.reduce((s, t) => s + (t.parts.wellbeing as number) * t.wellbeing!.responses, 0) / responses)

  const parts: ScoreParts = { coverage: coverageScore(coverages), load, wellbeing }
  return { teams, coverages, parts, score: blendScore(parts) }
}

export type ScoreLabel = 'Strong' | 'Fair' | 'At risk'
export function scoreLabel(score: number): ScoreLabel {
  if (score >= 80) return 'Strong'
  if (score >= 60) return 'Fair'
  return 'At risk'
}

/**
 * Organisation wellbeing over time (100 - burnout), one point per week, using only teams whose
 * results are visible that week and weighting by response count. Null if no team is visible.
 */
export function orgWellbeingTrend(data: OrgData): Array<{ period: string; wellbeing: number | null }> {
  const periods = [...new Set(data.teams.flatMap((t) => teamTrend(data.pulses, t.id).map((p) => p.period)))].sort()
  return periods.map((period) => {
    const visible = data.teams
      .map((t) => teamPeriod(data.pulses, t.id, period))
      .filter((p): p is Extract<PeriodResult, { hidden: false }> => !p.hidden)
    const responses = visible.reduce((s, p) => s + p.responses, 0)
    if (responses === 0) return { period, wellbeing: null }
    const burnout = visible.reduce((s, p) => s + p.meanScore * p.responses, 0) / responses
    return { period, wellbeing: Math.round(100 - burnout) }
  })
}
