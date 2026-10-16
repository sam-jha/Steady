import { describe, expect, it } from 'vitest'
import { MIN_GROUP_SIZE } from '../src/config'
import { buildDemoData } from '../src/data/demoData'
import type { OrgData, Person, PulseResponse, SkillRating, Task } from '../src/data/schemas'
import { coverageScore, coverageStatus, taskCoverage } from '../src/logic/coverage'
import { loadBand, loadScore, teamLoad } from '../src/logic/load'
import { blendScore, orgMetrics, teamMetrics } from '../src/logic/resilienceScore'
import {
  burnoutBand,
  consecutivePeriodsInBand,
  latestPeriod,
  shiftBand,
  teamPeriod,
  teamTrend,
  weekStart,
} from '../src/logic/wellbeing'

// ----- a tiny hand-made organisation so every expected number can be checked by hand -----
const person = (id: string, over: Partial<Person> = {}): Person => ({
  id, displayName: id, teamId: 'A', role: 'Staff', fte: 1, status: 'available', ...over,
})
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, name: id, teamId: 'A', criticality: 'essential', weeklyHours: 30, hasDocumentedProcess: true, ...over,
})
const skill = (personId: string, taskId: string, level: 0 | 1 | 2 | 3): SkillRating => ({ personId, taskId, level })
const pulse = (n: number, burnoutScore: number, timestamp = '2025-03-03', teamId = 'A'): PulseResponse[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${teamId}-${timestamp}-${burnoutScore}-${i}`, teamId, timestamp, burnoutScore, demandsScore: 50, resourcesScore: 50 }))

const org = (over: Partial<OrgData> = {}): OrgData => ({
  orgName: 'Test', teams: [{ id: 'A', name: 'A', leadId: 'p1', headcount: 3 }],
  people: [], tasks: [], skills: [], absences: [], pulses: [], scenarios: [], recommendationStatus: {}, ...over,
})

describe('coverage', () => {
  it('classifies counts: 0-1 single point of failure, 2 thin, 3+ ok', () => {
    expect(coverageStatus(0)).toBe('single-point-of-failure')
    expect(coverageStatus(1)).toBe('single-point-of-failure')
    expect(coverageStatus(2)).toBe('thin')
    expect(coverageStatus(3)).toBe('ok')
  })

  it('counts only AVAILABLE people at proficiency 2 or above', () => {
    const data = org({
      people: [person('p1'), person('p2'), person('p3', { status: 'absent' }), person('p4'), person('p5')],
      tasks: [task('t1')],
      skills: [skill('p1', 't1', 2), skill('p2', 't1', 3), skill('p3', 't1', 3), skill('p4', 't1', 1), skill('p5', 't1', 0)],
    })
    const c = taskCoverage(data, data.tasks[0])
    expect(c.competentAvailable.sort()).toEqual(['p1', 'p2'])
    expect(c.status).toBe('thin')
  })

  it('flags a single point of failure when the other competent people are absent', () => {
    const data = org({
      people: [person('p1'), person('p2', { status: 'absent' })],
      tasks: [task('t1')],
      skills: [skill('p1', 't1', 2), skill('p2', 't1', 2)],
    })
    expect(taskCoverage(data, data.tasks[0]).status).toBe('single-point-of-failure')
  })

  it('scores coverage weighted by criticality', () => {
    const mk = (criticality: Task['criticality'], count: number) =>
      ({ task: task('x', { criticality }), competentAvailable: [], count, status: coverageStatus(count) })
    expect(coverageScore([mk('essential', 3)])).toBe(100)
    expect(coverageScore([mk('essential', 0)])).toBe(0)
    // essential (weight 3) with 1 person = 30 points; deferrable (weight 1) with 3 = 100 → (90+100)/400 = 47.5 → 48
    expect(coverageScore([mk('essential', 1), mk('deferrable', 3)])).toBe(48)
    expect(coverageScore([])).toBe(100)
  })
})

describe('load', () => {
  it('uses band edges 0.85 and 1.0', () => {
    expect(loadBand(0.84)).toBe('healthy')
    expect(loadBand(0.85)).toBe('stretched')
    expect(loadBand(1.0)).toBe('stretched')
    expect(loadBand(1.01)).toBe('overloaded')
  })

  it('divides essential + important demand by available capacity, ignoring deferrable work and absent people', () => {
    const data = org({
      people: [person('p1'), person('p2', { fte: 0.5 }), person('p3', { status: 'absent' })],
      tasks: [task('t1', { weeklyHours: 30 }), task('t2', { criticality: 'important', weeklyHours: 10 }), task('t3', { criticality: 'deferrable', weeklyHours: 50 })],
    })
    const l = teamLoad(data, 'A')
    expect(l.demandHours).toBe(40)
    expect(l.capacityHours).toBe(56.25) // (1 + 0.5) × 37.5
    expect(l.ratio).toBeCloseTo(0.711, 3)
    expect(l.band).toBe('healthy')
  })

  it('treats a team with work but nobody available as overloaded', () => {
    const data = org({ people: [person('p1', { status: 'absent' })], tasks: [task('t1')] })
    expect(teamLoad(data, 'A').band).toBe('overloaded')
  })

  it('scores load from 100 (healthy) down to 0 at 1.3', () => {
    expect(loadScore(0.5)).toBe(100)
    expect(loadScore(0.85)).toBe(100)
    expect(loadScore(1.075)).toBe(50)
    expect(loadScore(1.3)).toBe(0)
    expect(loadScore(2)).toBe(0)
  })
})

describe('wellbeing and the anonymity threshold', () => {
  it('bands scores at 40 and 60', () => {
    expect(burnoutBand(39)).toBe('low')
    expect(burnoutBand(40)).toBe('moderate')
    expect(burnoutBand(59)).toBe('moderate')
    expect(burnoutBand(60)).toBe('high')
  })

  it('shifts bands without leaving the range', () => {
    expect(shiftBand('low', 1)).toBe('moderate')
    expect(shiftBand('high', 1)).toBe('high')
    expect(shiftBand('moderate', -5)).toBe('low')
  })

  it('finds the Monday of a week', () => {
    expect(weekStart('2025-03-03')).toBe('2025-03-03') // a Monday
    expect(weekStart('2025-03-09')).toBe('2025-03-03') // the Sunday before the next Monday
  })

  it('hides a period with fewer than the minimum responses, and exposes no score', () => {
    const r = teamPeriod(pulse(MIN_GROUP_SIZE - 1, 80), 'A', '2025-03-03')
    expect(r).toEqual({ hidden: true, period: '2025-03-03', responses: MIN_GROUP_SIZE - 1 })
    expect('meanScore' in r).toBe(false)
  })

  it('shows a period at exactly the minimum, with the mean and band', () => {
    const r = teamPeriod(pulse(MIN_GROUP_SIZE, 70), 'A', '2025-03-03')
    expect(r).toMatchObject({ hidden: false, meanScore: 70, band: 'high' })
  })

  it('does not combine small weeks to get past the threshold', () => {
    const pulses = [...pulse(3, 80, '2025-03-03'), ...pulse(3, 80, '2025-03-10')]
    expect(teamTrend(pulses, 'A').every((p) => p.hidden)).toBe(true)
  })

  it('ignores other teams and returns null when there is no data', () => {
    expect(latestPeriod([], 'A')).toBeNull()
    expect(teamPeriod(pulse(6, 70, '2025-03-03', 'B'), 'A', '2025-03-03')).toMatchObject({ hidden: true, responses: 0 })
  })

  it('counts consecutive visible weeks in a band, stopping at the first break', () => {
    const pulses = [...pulse(5, 30, '2025-03-03'), ...pulse(5, 70, '2025-03-10'), ...pulse(5, 75, '2025-03-17')]
    expect(consecutivePeriodsInBand(pulses, 'A', 'high')).toBe(2)
    const withHidden = [...pulses, ...pulse(2, 80, '2025-03-24')]
    expect(consecutivePeriodsInBand(withHidden, 'A', 'high')).toBe(0) // latest week is hidden
  })
})

describe('resilience score', () => {
  it('blends with the stated weights', () => {
    // 100×0.4 + 50×0.35 + 0×0.25 = 57.5 → 58
    expect(blendScore({ coverage: 100, load: 50, wellbeing: 0 })).toBe(58)
  })

  it('re-scales the weights when wellbeing is hidden instead of counting it as zero', () => {
    // (100×0.4 + 50×0.35) / 0.75 = 76.67 → 77
    expect(blendScore({ coverage: 100, load: 50, wellbeing: null })).toBe(77)
  })

  it('uses the latest visible wellbeing as 100 minus burnout', () => {
    const data = org({
      people: [person('p1'), person('p2'), person('p3')],
      tasks: [task('t1', { weeklyHours: 30 })],
      skills: [skill('p1', 't1', 2), skill('p2', 't1', 2), skill('p3', 't1', 3)],
      pulses: pulse(5, 30),
    })
    const m = teamMetrics(data, 'A')
    expect(m.parts).toEqual({ coverage: 100, load: 100, wellbeing: 70 })
    expect(m.score).toBe(Math.round(100 * 0.4 + 100 * 0.35 + 70 * 0.25))
  })
})

describe('Meridian Networks demo data', () => {
  const data = buildDemoData(new Date('2025-03-31'))
  const org = orgMetrics(data)
  const team = (id: string) => org.teams.find((t) => t.teamId === id)!

  it('has the deliberate single points of failure', () => {
    const spofs = org.coverages.filter((c) => c.status === 'single-point-of-failure').map((c) => c.task.name)
    expect(spofs).toContain('Core network monitoring')
    expect(spofs).toContain('Firewall change control')
  })

  it('shows Network Operations and Customer Support trending to High, with others lower', () => {
    expect(team('team-netops').wellbeing).toMatchObject({ hidden: false, band: 'high' })
    expect(team('team-support').wellbeing).toMatchObject({ hidden: false, band: 'high' })
    expect(team('team-billing').wellbeing).toMatchObject({ hidden: false, band: 'low' })
  })

  it('hides HR & Admin wellbeing', () => {
    expect(team('team-hr').wellbeing).toMatchObject({ hidden: true })
    expect(team('team-hr').parts.wellbeing).toBeNull()
  })

  it('puts the stressed teams below the stable ones', () => {
    expect(team('team-netops').score).toBeLessThan(team('team-billing').score)
    expect(team('team-support').score).toBeLessThan(team('team-billing').score)
    expect(org.score).toBeGreaterThan(0)
    expect(org.score).toBeLessThan(100)
  })
})
