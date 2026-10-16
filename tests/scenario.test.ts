import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../src/data/demoData'
import type { OrgData, Person, Scenario, SkillRating, Task } from '../src/data/schemas'
import { applyScenario, presetScenarios, resolveAffected, runScenario } from '../src/logic/scenario'
import { BURNOUT_RISK_RULES, projectBurnout } from '../src/rules/burnoutRiskRules'

describe('burnout projection rules', () => {
  it('R1: sustained overload (more than 3 weeks) raises the band by one', () => {
    expect(projectBurnout({ baseline: 'low', loadAfter: 1.2, weeks: 4 })).toMatchObject({ outcome: 'raised', projected: 'moderate', ruleId: 'R1-sustained-overload' })
    expect(projectBurnout({ baseline: 'moderate', loadAfter: 1.01, weeks: 8 })).toMatchObject({ projected: 'high' })
  })
  it('R1 boundary: exactly 3 weeks is not "more than 3"', () => {
    expect(projectBurnout({ baseline: 'low', loadAfter: 1.2, weeks: 3 })).toMatchObject({ outcome: 'watch', projected: 'low', ruleId: 'R3-short-overload' })
  })
  it('R2: already High and overloaded is critical, whatever the duration', () => {
    expect(projectBurnout({ baseline: 'high', loadAfter: 1.1, weeks: 1 })).toMatchObject({ outcome: 'critical', projected: 'high' })
    expect(projectBurnout({ baseline: 'high', loadAfter: 1.1, weeks: 12 })).toMatchObject({ outcome: 'critical' })
  })
  it('R4: load at exactly 1.0 or below projects no change', () => {
    expect(projectBurnout({ baseline: 'moderate', loadAfter: 1.0, weeks: 10 })).toMatchObject({ outcome: 'no-change', projected: 'moderate' })
  })
  it('R5: a hidden baseline still reacts to sustained overload, without naming a band', () => {
    expect(projectBurnout({ baseline: null, loadAfter: 1.3, weeks: 6 })).toMatchObject({ outcome: 'raised', projected: null, ruleId: 'R5-hidden-baseline' })
    expect(projectBurnout({ baseline: null, loadAfter: 0.7, weeks: 6 })).toMatchObject({ outcome: 'no-change', projected: null })
  })
  it('documents every rule id it can return', () => {
    const ids = BURNOUT_RISK_RULES.map((r) => r.id)
    const seen = [
      projectBurnout({ baseline: 'low', loadAfter: 1.2, weeks: 9 }), projectBurnout({ baseline: 'high', loadAfter: 1.2, weeks: 9 }),
      projectBurnout({ baseline: 'low', loadAfter: 1.2, weeks: 1 }), projectBurnout({ baseline: 'low', loadAfter: 0.5, weeks: 1 }),
      projectBurnout({ baseline: null, loadAfter: 1.2, weeks: 9 }),
    ].map((p) => p.ruleId)
    for (const id of seen) expect(ids).toContain(id)
  })
})

// ----- a small hand-made organisation -----
const person = (id: string, teamId: string, over: Partial<Person> = {}): Person => ({ id, displayName: id, teamId, role: 'Staff', fte: 1, status: 'available', ...over })
const task = (id: string, teamId: string, hours: number, over: Partial<Task> = {}): Task => ({ id, name: id, teamId, criticality: 'essential', weeklyHours: hours, hasDocumentedProcess: true, ...over })
const skill = (personId: string, taskId: string, level: 0 | 1 | 2 | 3): SkillRating => ({ personId, taskId, level })

// Team A: a1,a2,a3 competent at tA. Team B: b1 (level 1 at tA), b2. Team C: c1 (level 1 at tA), already busy.
const small = (): OrgData => ({
  orgName: 'Small', teams: ['A', 'B', 'C'].map((id) => ({ id, name: id, leadId: id.toLowerCase() + '1', headcount: 3 })),
  people: [person('a1', 'A'), person('a2', 'A'), person('a3', 'A'), person('a4', 'A', { role: 'Lead' }),
    person('b1', 'B'), person('b2', 'B'), person('c1', 'C')],
  tasks: [task('tA', 'A', 60), task('tB', 'B', 20), task('tC', 'C', 36)],
  skills: [skill('a1', 'tA', 2), skill('a2', 'tA', 2), skill('a3', 'tA', 3), skill('a4', 'tA', 1),
    skill('b1', 'tA', 1), skill('c1', 'tA', 1)],
  absences: [], pulses: [], scenarios: [], recommendationStatus: {},
})
const scenario = (over: Partial<Scenario>): Scenario => ({ id: 's', name: 's', absenceType: 'illness', weeks: 2, selector: { kind: 'people', personIds: [] }, ...over })

describe('choosing who is affected', () => {
  const data = buildDemoData(new Date('2025-03-31'))

  it('takes the stated percentage of a team, evenly spread, and only from available people', () => {
    const ids = resolveAffected(data, { kind: 'team-percent', teamId: 'team-netops', percent: 30, worstCase: false })
    const available = data.people.filter((p) => p.teamId === 'team-netops' && p.status === 'available')
    expect(ids).toHaveLength(Math.round(0.3 * available.length))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(available.map((p) => p.id)).toContain(id)
  })

  it('worst case picks the hardest-to-replace people', () => {
    const typical = runScenario(data, scenario({ selector: { kind: 'team-percent', teamId: 'team-security', percent: 25, worstCase: false } }))
    const worst = runScenario(data, scenario({ selector: { kind: 'team-percent', teamId: 'team-security', percent: 25, worstCase: true } }))
    expect(worst.after.teams.find((t) => t.teamId === 'team-security')!.parts.coverage)
      .toBeLessThanOrEqual(typical.after.teams.find((t) => t.teamId === 'team-security')!.parts.coverage)
  })

  it('ignores people who are already absent, and selects by role', () => {
    const d = small()
    d.people[0].status = 'absent'
    expect(resolveAffected(d, { kind: 'people', personIds: ['a1', 'a2'] })).toEqual(['a2'])
    expect(resolveAffected(d, { kind: 'role', role: 'Lead' })).toEqual(['a4'])
  })

  it('never changes the original data', () => {
    const d = small()
    const copy = applyScenario(d, ['a1'])
    expect(copy.people[0].status).toBe('absent')
    expect(d.people[0].status).toBe('available')
  })
})

describe('before vs during', () => {
  it('finds a new single point of failure and the lost coverage', () => {
    const r = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['a1', 'a2'] } }))
    const t = r.tasks.find((c) => c.task.id === 'tA')!
    expect(t.before).toMatchObject({ count: 3, status: 'ok' })
    expect(t.after).toMatchObject({ count: 1, status: 'single-point-of-failure' })
    expect(t.isNewSpof).toBe(true)
    expect(r.after.score).toBeLessThan(r.before.score)
  })

  it('raises load for the affected team and projects burnout from the rules', () => {
    const r = runScenario(small(), scenario({ weeks: 6, selector: { kind: 'people', personIds: ['a1', 'a2', 'a3'] } }))
    const a = r.teams.find((t) => t.teamId === 'A')!
    expect(a.loadAfter.ratio).toBeGreaterThan(a.loadBefore.ratio)
    expect(a.loadAfter.band).toBe('overloaded')
    expect(a.burnout.outcome).toBe('raised') // no pulse data: baseline hidden
    expect(r.teams.find((t) => t.teamId === 'B')!.burnout.outcome).toBe('no-change')
  })
})

describe('who could cover the gap', () => {
  it('lists available people at proficiency 1+ who are not already competent, ranked by level then team room', () => {
    const r = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['a1', 'a2'] } }))
    const gap = r.gaps.find((g) => g.task.id === 'tA')!
    expect(gap.lostCompetent).toBe(2)
    expect(gap.hoursAtStake).toBe(40) // 60 hours × 2 of 3 competent people
    expect(gap.candidates.map((c) => c.personId).sort()).toEqual(['a4', 'b1', 'c1'])
    expect(gap.candidates.map((c) => c.personId)).not.toContain('a3') // already competent
  })

  it('warns when the helper’s team would go over a load ratio of 1.0', () => {
    const r = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['a1', 'a2'] } }))
    const gap = r.gaps.find((g) => g.task.id === 'tA')!
    const c1 = gap.candidates.find((c) => c.personId === 'c1')!
    const b1 = gap.candidates.find((c) => c.personId === 'b1')!
    // 40 hours shared between 3 helpers ≈ 13.3 each. Team C: (36 + 13.3) / 37.5 = 1.31 → warning.
    expect(c1.teamRatioIfTaken).toBeCloseTo(1.316, 2)
    expect(c1.overloadWarning).toBe(true)
    // Team B has two people (75 hours): (20 + 13.3) / 75 = 0.44, no warning.
    expect(b1.overloadWarning).toBe(false)
  })

  it('leaves the ratio alone for same-team cover (the work is already in the team’s demand)', () => {
    const r = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['a1', 'a2'] } }))
    const a4 = r.gaps[0].candidates.find((c) => c.personId === 'a4')!
    expect(a4.sameTeam).toBe(true)
    expect(a4.teamRatioIfTaken).toBeCloseTo(r.teams.find((t) => t.teamId === 'A')!.loadAfter.ratio, 5)
  })

  it('treats thin cover (2 left) as a gap, but reports nothing when no competent person is lost', () => {
    const thin = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['a1'] } }))
    expect(thin.gaps.find((g) => g.task.id === 'tA')?.afterCount).toBe(2)
    const unaffected = runScenario(small(), scenario({ selector: { kind: 'people', personIds: ['b2'] } }))
    expect(unaffected.gaps).toEqual([])
  })
})

describe('presets on the demo data', () => {
  const data = buildDemoData(new Date('2025-03-31'))
  const presets = presetScenarios(data)

  it('has the four scenarios from the brief', () => {
    expect(presets.map((p) => p.id)).toEqual(['preset-reserve', 'preset-flu', 'preset-leavers', 'preset-flood'])
  })

  it('every preset runs, affects people and does not improve the score', () => {
    for (const p of presets) {
      const r = runScenario(data, p)
      expect(r.affectedIds.length).toBeGreaterThan(0)
      expect(r.after.score).toBeLessThanOrEqual(r.before.score)
    }
  })

  it('the reserve call-up pushes Network Operations over a load ratio of 1.0 and flags it critical', () => {
    const r = runScenario(data, presets[0])
    const netops = r.teams.find((t) => t.teamId === 'team-netops')!
    expect(netops.loadAfter.ratio).toBeGreaterThan(1)
    expect(netops.burnout.outcome).toBe('critical') // already High
  })
})
