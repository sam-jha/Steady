import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../src/data/demoData'
import { orgWellbeingTrend, scoreLabel } from '../src/logic/resilienceScore'
import { topRisks } from '../src/logic/risks'

const data = buildDemoData(new Date('2025-03-31'))

describe('top risks', () => {
  const risks = topRisks(data, 10)

  it('is sorted most severe first and respects the limit', () => {
    const severities = risks.map((r) => r.severity)
    expect(severities).toEqual([...severities].sort((a, b) => b - a))
    expect(topRisks(data, 3)).toHaveLength(3)
  })

  it('includes high burnout for the stressed teams and the deliberate single points of failure', () => {
    const ids = risks.map((r) => r.id)
    expect(ids).toContain('burnout-team-netops')
    expect(ids).toContain('burnout-team-support')
    expect(risks.some((r) => r.title.includes('Firewall change control'))).toBe(true)
  })

  it('never reports wellbeing for a team under the anonymity threshold', () => {
    expect(risks.some((r) => r.id === 'burnout-team-hr')).toBe(false)
  })

  it('names teams and tasks, never people', () => {
    for (const r of risks) expect(r.title + r.detail).not.toMatch(/\b(NOP|FLD|CSP|SEC|BIL|HRA)-\d/)
  })
})

describe('org wellbeing trend', () => {
  it('has one point per week and falls over the demo period', () => {
    const trend = orgWellbeingTrend(data)
    expect(trend).toHaveLength(12)
    expect(trend[11].wellbeing!).toBeLessThan(trend[0].wellbeing!)
  })
})

describe('score label', () => {
  it('uses 80 and 60 as cut-offs', () => {
    expect(scoreLabel(80)).toBe('Strong')
    expect(scoreLabel(79)).toBe('Fair')
    expect(scoreLabel(60)).toBe('Fair')
    expect(scoreLabel(59)).toBe('At risk')
  })
})
