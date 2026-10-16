// Coverage: for each task, how many AVAILABLE people are competent (proficiency 2 or 3)?
// Theory: Resource-Based View (Abrams & Berge, 2010) – resilience depends on how flexibly
// human capital can be redeployed, and no critical task should depend on one or two people.

import { COMPETENT_LEVEL, COVERAGE_POINTS, CRITICALITY_WEIGHTS, SPOF_MAX_COMPETENT, THIN_COVERAGE } from '../config'
import type { OrgData, Task } from '../data/schemas'

export type CoverageStatus = 'single-point-of-failure' | 'thin' | 'ok'

export interface TaskCoverage {
  task: Task
  competentAvailable: string[] // person ids
  count: number
  status: CoverageStatus
}

export function coverageStatus(count: number): CoverageStatus {
  if (count <= SPOF_MAX_COMPETENT) return 'single-point-of-failure' // includes 0 people
  if (count === THIN_COVERAGE) return 'thin'
  return 'ok'
}

export function taskCoverage(data: OrgData, task: Task): TaskCoverage {
  const available = new Set(data.people.filter((p) => p.status === 'available').map((p) => p.id))
  const competentAvailable = data.skills
    .filter((s) => s.taskId === task.id && s.level >= COMPETENT_LEVEL && available.has(s.personId))
    .map((s) => s.personId)
  return { task, competentAvailable, count: competentAvailable.length, status: coverageStatus(competentAvailable.length) }
}

/** Coverage of every task owned by a team (or of the whole organisation if teamId is omitted). */
export function coverageForTasks(data: OrgData, teamId?: string): TaskCoverage[] {
  return data.tasks.filter((t) => !teamId || t.teamId === teamId).map((t) => taskCoverage(data, t))
}

/** 0–100. Each task earns points by how many competent people are available, weighted by criticality. */
export function coverageScore(coverages: TaskCoverage[]): number {
  if (coverages.length === 0) return 100 // nothing to cover
  let earned = 0
  let possible = 0
  for (const c of coverages) {
    const w = CRITICALITY_WEIGHTS[c.task.criticality]
    earned += w * COVERAGE_POINTS[Math.min(c.count, COVERAGE_POINTS.length - 1)]
    possible += w * 100
  }
  return Math.round((earned / possible) * 100)
}
