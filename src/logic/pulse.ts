// Scoring the pulse and matching support content. Thresholds live in config.ts and are indicative only.

import { AGREEMENT_OPTIONS, CBI_WORK_ITEMS, FREQUENCY_OPTIONS, JDR_ITEMS } from '../content/pulseItems'
import { burnoutBand, type BurnoutBand } from './wellbeing'

export type Theme = 'workload' | 'sleep' | 'stress' | 'boundaries' | 'uncertainty' | 'returning' | 'manager'

export interface PulseScores {
  burnoutScore: number // 0–100, higher = more burnout risk
  demandsScore: number // 0–100, higher = more demand
  resourcesScore: number // 0–100, higher = more resources
  band: BurnoutBand
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Returns null if any question is missing or has an impossible value. */
export function scorePulse(answers: Record<string, number>): PulseScores | null {
  const ok = (id: string, options: { value: number }[]) => id in answers && options.some((o) => o.value === answers[id])
  if (!CBI_WORK_ITEMS.every((i) => ok(i.id, FREQUENCY_OPTIONS))) return null
  if (!JDR_ITEMS.every((i) => ok(i.id, AGREEMENT_OPTIONS))) return null

  const burnoutScore = Math.round(mean(CBI_WORK_ITEMS.map((i) => (i.reverse ? 100 - answers[i.id] : answers[i.id]))))
  const demandsScore = Math.round(mean(JDR_ITEMS.filter((i) => i.dimension === 'demand').map((i) => answers[i.id])))
  const resourcesScore = Math.round(mean(JDR_ITEMS.filter((i) => i.dimension === 'resource').map((i) => answers[i.id])))
  return { burnoutScore, demandsScore, resourcesScore, band: burnoutBand(burnoutScore) }
}

/** Themes worth suggesting, based on the answers. */
export function themesFor(s: PulseScores): Theme[] {
  const themes = new Set<Theme>()
  if (s.burnoutScore >= 40) { themes.add('stress'); themes.add('sleep') }
  if (s.demandsScore >= 60) { themes.add('workload'); themes.add('boundaries') }
  if (s.resourcesScore <= 40) themes.add('manager')
  if (themes.size === 0) themes.add('stress') // a gentle default
  return [...themes]
}

export interface SupportCardLike { id: string; themes: Theme[]; bands: BurnoutBand[]; audience?: string[] }

/** The best n cards: those tagged for the person's band and matching their themes. */
export function matchSupport<T extends SupportCardLike>(cards: T[], band: BurnoutBand, themes: Theme[], n = 3): T[] {
  return cards
    // Cards written for people returning from an absence are not suggested from the pulse alone.
    .filter((c) => !c.audience?.includes('returning') || themes.includes('returning'))
    .map((c) => ({ c, score: (c.bands.includes(band) ? 2 : 0) + c.themes.filter((t) => themes.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .slice(0, n)
    .map((x) => x.c)
}
