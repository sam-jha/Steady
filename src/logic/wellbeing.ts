// Wellbeing: team-level burnout risk from anonymous pulse responses.
// Privacy rule: a team/period with fewer than MIN_GROUP_SIZE responses is HIDDEN. We return
// only the response count in that case, never a score, so nothing can leak by accident.

import { BURNOUT_THRESHOLDS, MIN_GROUP_SIZE } from '../config'
import type { PulseResponse } from '../data/schemas'

export type BurnoutBand = 'low' | 'moderate' | 'high'
export const BAND_ORDER: BurnoutBand[] = ['low', 'moderate', 'high']

export function burnoutBand(score: number): BurnoutBand {
  if (score >= BURNOUT_THRESHOLDS.highFrom) return 'high'
  if (score >= BURNOUT_THRESHOLDS.moderateFrom) return 'moderate'
  return 'low'
}

/** Move a band up (positive) or down (negative), staying within low..high. */
export function shiftBand(band: BurnoutBand, steps: number): BurnoutBand {
  const i = Math.max(0, Math.min(BAND_ORDER.length - 1, BAND_ORDER.indexOf(band) + steps))
  return BAND_ORDER[i]
}

/** Monday of the week containing this ISO date (YYYY-MM-DD). Reporting periods are weeks. */
export function weekStart(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d.toISOString().slice(0, 10)
}

export type PeriodResult =
  | { hidden: true; period: string; responses: number }
  | { hidden: false; period: string; responses: number; meanScore: number; band: BurnoutBand }

/** Aggregate one team's responses for one week. */
export function teamPeriod(pulses: PulseResponse[], teamId: string, period: string): PeriodResult {
  const rows = pulses.filter((p) => p.teamId === teamId && weekStart(p.timestamp) === period)
  if (rows.length < MIN_GROUP_SIZE) return { hidden: true, period, responses: rows.length }
  const mean = rows.reduce((sum, r) => sum + r.burnoutScore, 0) / rows.length
  return { hidden: false, period, responses: rows.length, meanScore: Math.round(mean), band: burnoutBand(mean) }
}

/** Every week with data for a team, oldest first. Hidden weeks stay in the list (marked hidden). */
export function teamTrend(pulses: PulseResponse[], teamId: string): PeriodResult[] {
  const periods = [...new Set(pulses.filter((p) => p.teamId === teamId).map((p) => weekStart(p.timestamp)))].sort()
  return periods.map((period) => teamPeriod(pulses, teamId, period))
}

/** The most recent week with data, or null if the team has no responses at all. */
export function latestPeriod(pulses: PulseResponse[], teamId: string): PeriodResult | null {
  const trend = teamTrend(pulses, teamId)
  return trend.length ? trend[trend.length - 1] : null
}

/** How many of the most recent weeks in a row (ending now) were visible AND in the given band. */
export function consecutivePeriodsInBand(pulses: PulseResponse[], teamId: string, band: BurnoutBand): number {
  const trend = teamTrend(pulses, teamId)
  let n = 0
  for (let i = trend.length - 1; i >= 0; i--) {
    const p = trend[i]
    if (p.hidden || p.band !== band) break
    n++
  }
  return n
}
