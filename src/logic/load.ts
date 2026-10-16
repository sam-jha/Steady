// Load: how much work is there compared with the people available to do it?
// Theory: Job Demands–Resources (Bakker & Demerouti, 2007) – burnout rises when demands
// exceed the resources (here: available hours) to meet them.

import { HOURS_PER_FTE, LOAD_HEALTHY_MAX, LOAD_STRETCHED_MAX, LOAD_ZERO_SCORE_AT } from '../config'
import type { OrgData } from '../data/schemas'

export type LoadBand = 'healthy' | 'stretched' | 'overloaded'

export interface TeamLoad {
  demandHours: number // essential + important tasks only
  capacityHours: number // available people only
  ratio: number // demand ÷ capacity (Infinity if nobody is available)
  band: LoadBand
}

export function loadBand(ratio: number): LoadBand {
  if (ratio < LOAD_HEALTHY_MAX) return 'healthy'
  if (ratio <= LOAD_STRETCHED_MAX) return 'stretched'
  return 'overloaded'
}

export function teamLoad(data: OrgData, teamId: string): TeamLoad {
  const demandHours = data.tasks
    .filter((t) => t.teamId === teamId && t.criticality !== 'deferrable')
    .reduce((sum, t) => sum + t.weeklyHours, 0)
  const capacityHours = data.people
    .filter((p) => p.teamId === teamId && p.status === 'available')
    .reduce((sum, p) => sum + p.fte * HOURS_PER_FTE, 0)
  const ratio = capacityHours === 0 ? (demandHours === 0 ? 0 : Infinity) : demandHours / capacityHours
  return { demandHours, capacityHours, ratio, band: loadBand(ratio) }
}

/** 0–100: full marks while healthy, falling in a straight line to 0 at LOAD_ZERO_SCORE_AT. */
export function loadScore(ratio: number): number {
  if (ratio <= LOAD_HEALTHY_MAX) return 100
  if (ratio >= LOAD_ZERO_SCORE_AT) return 0
  return Math.round((100 * (LOAD_ZERO_SCORE_AT - ratio)) / (LOAD_ZERO_SCORE_AT - LOAD_HEALTHY_MAX))
}
