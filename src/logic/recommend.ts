// Turns the rules into the list shown to people: evaluates every rule, attaches warnings,
// sorts by horizon then impact ÷ effort, and attaches the saved status.

import { LOAD_STRETCHED_MAX } from '../config'
import type { OrgData, RecommendationStatus } from '../data/schemas'
import { RULES, type Finding, type Horizon, type Level, type Rule } from '../rules/recommendations'
import { buildContext } from './recommendationContext'

export interface Recommendation {
  key: string // ruleId:subjectId, the id the saved status is stored under
  rule: Rule
  finding: Finding
  /** Shown when the action adds work to a team that is already overloaded. */
  overloadWarning: string | null
  status: RecommendationStatus | null // null = not started
}

export const HORIZON_ORDER: Horizon[] = ['Do now', 'Do next (30–90 days)', 'Build long-term']
const SCORE: Record<Level, number> = { low: 1, med: 2, high: 3 }

export function priority(rule: Rule): number {
  return SCORE[rule.impact] / SCORE[rule.effort]
}

export function generateRecommendations(data: OrgData, today: Date = new Date()): Recommendation[] {
  const ctx = buildContext(data, today)
  const overloaded = ctx.teams.filter((t) => t.metrics.load.ratio > LOAD_STRETCHED_MAX)

  const recs: Recommendation[] = []
  for (const rule of RULES) {
    for (const finding of rule.trigger(ctx)) {
      let overloadWarning: string | null = null
      if (rule.addsWorkload) {
        const affected = finding.teamId ? overloaded.filter((t) => t.id === finding.teamId) : overloaded
        if (affected.length > 0) {
          overloadWarning = `${affected.map((t) => t.name).join(', ')} ${affected.length === 1 ? 'is' : 'are'} already overloaded. This action adds work, so do the lighter option first: ${rule.lighter ?? 'keep it minimal and time-boxed.'}`
        }
      }
      const key = `${rule.id}:${finding.subjectId}`
      recs.push({ key, rule, finding, overloadWarning, status: data.recommendationStatus[key] ?? null })
    }
  }
  return recs.sort(
    (a, b) =>
      HORIZON_ORDER.indexOf(a.rule.horizon) - HORIZON_ORDER.indexOf(b.rule.horizon) ||
      priority(b.rule) - priority(a.rule) ||
      a.rule.id.localeCompare(b.rule.id) ||
      a.finding.subject.localeCompare(b.finding.subject),
  )
}

/** The first n open "Do now" actions, using each rule once so the list is varied. */
export function topDoNow(recs: Recommendation[], n = 3): Recommendation[] {
  const seen = new Set<string>()
  const out: Recommendation[] = []
  for (const r of recs) {
    if (r.rule.horizon !== 'Do now' || r.status === 'done' || r.status === 'not-relevant' || seen.has(r.rule.id)) continue
    seen.add(r.rule.id)
    out.push(r)
    if (out.length === n) break
  }
  return out
}
