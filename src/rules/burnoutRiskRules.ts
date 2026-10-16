// Every rule that projects burnout risk in the scenario simulator lives in THIS file.
// The rules are deliberately simple and readable. They are indicative, not clinical, and not
// validated for this use. Theory: Job Demands–Resources (Bakker & Demerouti, 2007) – when
// demands stay above resources for long enough, burnout risk rises.

import { LOAD_STRETCHED_MAX, OVERLOAD_WEEKS_TO_RAISE_RISK } from '../config'
import { shiftBand, type BurnoutBand } from '../logic/wellbeing'

export type ProjectionOutcome = 'no-change' | 'watch' | 'raised' | 'critical'

export interface BurnoutProjection {
  baseline: BurnoutBand | null // null = hidden (fewer than the minimum number of responses)
  projected: BurnoutBand | null
  outcome: ProjectionOutcome
  ruleId: string
  explanation: string
}

/** The rules in plain English, shown to users ("How are projections made?") and tested. */
export const BURNOUT_RISK_RULES = [
  { id: 'R1-sustained-overload', text: `If a team's load ratio goes above ${LOAD_STRETCHED_MAX} for more than ${OVERLOAD_WEEKS_TO_RAISE_RISK} weeks, its burnout risk rises by one band (Low → Moderate → High).` },
  { id: 'R2-already-high', text: `If a team's burnout risk is already High and its load ratio goes above ${LOAD_STRETCHED_MAX}, it is flagged as critical, whatever the duration.` },
  { id: 'R3-short-overload', text: `If load goes above ${LOAD_STRETCHED_MAX} for ${OVERLOAD_WEEKS_TO_RAISE_RISK} weeks or less, no band change is projected, but the team is flagged to watch: short bursts are survivable if recovery time follows.` },
  { id: 'R4-no-overload', text: `If load stays at or below ${LOAD_STRETCHED_MAX}, no change is projected.` },
  { id: 'R5-hidden-baseline', text: 'If a team’s current wellbeing is hidden (too few responses), the same rules apply to load, but the outcome is described without naming a band.' },
] as const

export function projectBurnout(input: { baseline: BurnoutBand | null; loadAfter: number; weeks: number }): BurnoutProjection {
  const { baseline, loadAfter, weeks } = input
  const overloaded = loadAfter > LOAD_STRETCHED_MAX

  if (!overloaded) {
    return { baseline, projected: baseline, outcome: 'no-change', ruleId: 'R4-no-overload', explanation: 'Load stays within capacity, so no change in burnout risk is projected.' }
  }
  if (baseline === 'high') {
    return { baseline, projected: 'high', outcome: 'critical', ruleId: 'R2-already-high', explanation: 'Burnout risk is already High and the team would be overloaded: this is critical.' }
  }
  if (weeks > OVERLOAD_WEEKS_TO_RAISE_RISK) {
    const projected = baseline === null ? null : shiftBand(baseline, 1)
    return {
      baseline, projected, outcome: 'raised',
      ruleId: baseline === null ? 'R5-hidden-baseline' : 'R1-sustained-overload',
      explanation: `Overloaded for ${weeks} weeks (more than ${OVERLOAD_WEEKS_TO_RAISE_RISK}): burnout risk is projected to rise by one band.`,
    }
  }
  return { baseline, projected: baseline, outcome: 'watch', ruleId: 'R3-short-overload', explanation: `Overloaded, but for ${weeks} week${weeks === 1 ? '' : 's'}: watch closely and protect recovery time afterwards.` }
}
