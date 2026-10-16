import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../src/data/demoData'
import type { Absence, OrgData, Person, PulseResponse, SkillRating, Task } from '../src/data/schemas'
import { generateRecommendations, HORIZON_ORDER, priority, topDoNow } from '../src/logic/recommend'
import { RULES } from '../src/rules/recommendations'

const TODAY = new Date('2025-03-31T12:00:00')
const DAY = 86400000
const iso = (offsetDays: number) => new Date(new Date('2025-03-31T00:00:00Z').getTime() + offsetDays * DAY).toISOString().slice(0, 10)

// ----- A calm, well-covered, two-team organisation where NO rule should fire -----
function calm(): OrgData {
  const people: Person[] = []
  const skills: SkillRating[] = []
  for (const [team, code] of [['A', 'a'], ['B', 'b']]) {
    for (let i = 1; i <= 4; i++) people.push({ id: `${code}${i}`, displayName: `${code}${i}`, teamId: team, role: 'Staff', fte: 1, status: 'available' })
  }
  const task = (id: string, teamId: string, criticality: Task['criticality'], weeklyHours: number): Task => ({ id, name: id, teamId, criticality, weeklyHours, hasDocumentedProcess: true })
  const tasks = [task('tE', 'A', 'essential', 90), task('tI', 'A', 'important', 30), task('tD', 'A', 'deferrable', 10), task('tB', 'B', 'essential', 60)]
  for (const t of tasks) for (const p of people.filter((p) => p.teamId === t.teamId)) skills.push({ personId: p.id, taskId: t.id, level: 3 })
  const d: OrgData = {
    orgName: 'Calm', teams: [{ id: 'A', name: 'Team A', leadId: 'a1', headcount: 4 }, { id: 'B', name: 'Team B', leadId: 'b1', headcount: 4 }],
    people, tasks, skills, absences: [], pulses: [], scenarios: [], recommendationStatus: {},
  }
  return withPulses(withPulses(d, 'A', [20]), 'B', [20])
}

/** Replace a team's pulses: one entry per week, oldest first, ending this week. */
function withPulses(d: OrgData, teamId: string, weeklyScores: number[], count = 5): OrgData {
  const rows: PulseResponse[] = []
  weeklyScores.forEach((score, w) => {
    const date = iso(-(weeklyScores.length - 1 - w) * 7)
    for (let i = 0; i < count; i++) rows.push({ id: `${teamId}-${w}-${i}`, teamId, timestamp: date, burnoutScore: score, demandsScore: 50, resourcesScore: 50 })
  })
  return { ...d, pulses: [...d.pulses.filter((p) => p.teamId !== teamId), ...rows] }
}
const setHours = (d: OrgData, taskId: string, hours: number): OrgData => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, weeklyHours: hours } : t)) })
const setSkill = (d: OrgData, taskId: string, levels: Record<string, 0 | 1 | 2 | 3>): OrgData => ({
  ...d, skills: d.skills.map((s) => (s.taskId === taskId && s.personId in levels ? { ...s, level: levels[s.personId] } : s)),
})
const addAbsence = (d: OrgData, personId: string, over: Partial<Absence> = {}): OrgData => ({
  ...d,
  people: d.people.map((p) => (p.id === personId ? { ...p, status: 'absent' as const } : p)),
  absences: [...d.absences, { id: `abs-${d.absences.length}`, personId, type: 'illness', start: iso(-10), end: iso(30), certainty: 'confirmed', ...over }],
})
const ids = (d: OrgData) => generateRecommendations(d, TODAY).map((r) => r.rule.id)
const fired = (d: OrgData, id: string) => generateRecommendations(d, TODAY).filter((r) => r.rule.id === id)

describe('rule catalogue', () => {
  it('has 20–30 rules with unique ids covering every pillar and horizon', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(20)
    expect(RULES.length).toBeLessThanOrEqual(30)
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length)
    expect(new Set(RULES.map((r) => r.pillar)).size).toBe(3)
    expect(new Set(RULES.map((r) => r.horizon)).size).toBe(3)
    for (const r of RULES) for (const f of [r.title, r.action, r.why, r.theory]) expect(f.length).toBeGreaterThan(10)
  })

  it('every rule that adds workload offers a lighter alternative', () => {
    for (const r of RULES.filter((r) => r.addsWorkload)) expect(r.lighter, r.id).toBeTruthy()
  })

  it('the calm organisation triggers nothing', () => {
    expect(ids(calm())).toEqual([])
  })
})

describe('Do now rules', () => {
  it('now-spof-shadow: one competent person on an essential task, and names who could shadow', () => {
    const d = setSkill(calm(), 'tE', { a1: 3, a2: 1, a3: 0, a4: 0 })
    const f = fired(d, 'now-spof-shadow')
    expect(f).toHaveLength(1)
    expect(f[0].finding.evidence.join(' ')).toContain('‘tE’ has 1 competent person available')
    expect(f[0].finding.evidence.join(' ')).toContain('a2')
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).not.toContain('now-spof-shadow') // 2 left
  })

  it('now-no-cover: an essential task with nobody competent', () => {
    expect(ids(setSkill(calm(), 'tE', { a1: 0, a2: 0, a3: 0, a4: 0 }))).toContain('now-no-cover')
  })

  it('now-defer-work lists deferrable tasks when overloaded; now-reduce-scope applies when there are none', () => {
    const over = setHours(calm(), 'tE', 200) // demand 230 vs 150 hours
    const f = fired(over, 'now-defer-work')
    expect(f).toHaveLength(1)
    expect(f[0].finding.evidence.join(' ')).toContain('‘tD’')
    expect(ids(over)).not.toContain('now-reduce-scope')

    const noDeferrable = { ...over, tasks: over.tasks.filter((t) => t.id !== 'tD') }
    expect(ids(noDeferrable)).toContain('now-reduce-scope')
    expect(ids(noDeferrable)).not.toContain('now-defer-work')
  })

  it('now-reduce-scope names teams with spare capacity', () => {
    const d = { ...setHours(calm(), 'tE', 200), tasks: setHours(calm(), 'tE', 200).tasks.filter((t) => t.id !== 'tD') }
    expect(fired(d, 'now-reduce-scope')[0].finding.evidence.join(' ')).toContain('Team B')
  })

  it('now-write-it-down: undocumented task with 2 or fewer competent people', () => {
    let d = setSkill(calm(), 'tE', { a3: 0, a4: 0 })
    d = { ...d, tasks: d.tasks.map((t) => (t.id === 'tE' ? { ...t, hasDocumentedProcess: false } : t)) }
    expect(ids(d)).toContain('now-write-it-down')
    expect(ids({ ...calm(), tasks: calm().tasks.map((t) => (t.id === 'tE' ? { ...t, hasDocumentedProcess: false } : t)) })).not.toContain('now-write-it-down') // 4 competent
  })

  it('now-absence-open-ended: an active absence with no end date', () => {
    expect(ids(addAbsence(calm(), 'a4', { end: null }))).toContain('now-absence-open-ended')
    expect(ids(addAbsence(calm(), 'a4', { end: iso(30) }))).not.toContain('now-absence-open-ended')
  })

  it('now-tell-the-team: an absence plus a load of 0.85 or more', () => {
    const busy = setHours(calm(), 'tE', 110) // (110+30)/150 = 0.93 before the absence
    expect(ids(addAbsence(busy, 'a4'))).toContain('now-tell-the-team')
    expect(ids(addAbsence(setHours(calm(), 'tE', 50), 'a4'))).not.toContain('now-tell-the-team') // 80 ÷ 112.5 = 0.71, healthy
  })

  it('now-support-visible: team burnout risk is High', () => {
    expect(ids(withPulses(calm(), 'A', [70]))).toContain('now-support-visible')
    expect(ids(withPulses(calm(), 'A', [50]))).not.toContain('now-support-visible')
  })

  it('now-support-visible does not fire when results are hidden by the anonymity threshold', () => {
    expect(ids(withPulses(calm(), 'A', [90], 4))).not.toContain('now-support-visible')
  })

  it('now-vacancy-cover: an open vacancy in a team at 0.85 or more', () => {
    const busy = setHours(calm(), 'tE', 110)
    const d = addAbsence({ ...busy, people: [...busy.people, { id: 'vac', displayName: 'vac', teamId: 'A', role: 'Vacancy', fte: 1, status: 'absent' }] }, 'vac', { type: 'vacancy' })
    expect(ids(d)).toContain('now-vacancy-cover')
  })
})

describe('Do next rules', () => {
  it('next-high-burnout-review: High for 2 weeks in a row (but not 1)', () => {
    expect(ids(withPulses(calm(), 'A', [30, 70, 72]))).toContain('next-high-burnout-review')
    expect(ids(withPulses(calm(), 'A', [30, 30, 72]))).not.toContain('next-high-burnout-review')
  })

  it('next-moderate-streak: Moderate for 3 weeks in a row', () => {
    expect(ids(withPulses(calm(), 'A', [50, 50, 50]))).toContain('next-moderate-streak')
    expect(ids(withPulses(calm(), 'A', [50, 50]))).not.toContain('next-moderate-streak')
  })

  it('next-rising-trend: score up by 10+ points over 5 weeks', () => {
    expect(ids(withPulses(calm(), 'A', [20, 22, 25, 28, 30, 31]))).toContain('next-rising-trend')
    expect(ids(withPulses(calm(), 'A', [20, 21, 22, 22, 23, 24]))).not.toContain('next-rising-trend')
  })

  it('next-cross-train-structural: fewer than 2 trained people in total on an essential task', () => {
    expect(ids(setSkill(calm(), 'tE', { a2: 1, a3: 1, a4: 0 }))).toContain('next-cross-train-structural')
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).not.toContain('next-cross-train-structural')
  })

  it('next-third-person: exactly 2 competent available on an essential task', () => {
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).toContain('next-third-person')
    expect(ids(setSkill(calm(), 'tE', { a4: 0 }))).not.toContain('next-third-person') // 3 left
  })

  it('next-important-spof: an important task with one competent person', () => {
    expect(ids(setSkill(calm(), 'tI', { a2: 0, a3: 0, a4: 0 }))).toContain('next-important-spof')
  })

  it('next-documentation-sprint: 2+ essential tasks without a process in a team', () => {
    const d = calm()
    const twoEssential = { ...d, tasks: [...d.tasks, { id: 'tE2', name: 'tE2', teamId: 'A', criticality: 'essential' as const, weeklyHours: 5, hasDocumentedProcess: false }]
      .map((t) => (t.id === 'tE' ? { ...t, hasDocumentedProcess: false } : t)), skills: [...d.skills, ...['a1', 'a2', 'a3'].map((p) => ({ personId: p, taskId: 'tE2', level: 3 as const }))] }
    expect(ids(twoEssential)).toContain('next-documentation-sprint')
    expect(ids(d)).not.toContain('next-documentation-sprint')
  })

  it('next-rebalance: a stretched team while another has spare capacity', () => {
    const stretched = setHours(calm(), 'tE', 100) // (100+30)/150 = 0.87
    expect(ids(stretched)).toContain('next-rebalance')
    expect(fired(stretched, 'next-rebalance')[0].finding.evidence.join(' ')).toContain('Team B')
  })

  it('next-long-absence: a long absence in a team at 0.85 or more', () => {
    const busy = setHours(calm(), 'tE', 110)
    expect(ids(addAbsence(busy, 'a4', { start: iso(-80), end: iso(20) }))).toContain('next-long-absence')
    expect(ids(addAbsence(busy, 'a4', { start: iso(-10), end: iso(20) }))).not.toContain('next-long-absence')
  })

  it('next-return-planning: an absence ending within 2 weeks', () => {
    expect(ids(addAbsence(calm(), 'a4', { type: 'parental-caring-leave', end: iso(7) }))).toContain('next-return-planning')
    expect(ids(addAbsence(calm(), 'a4', { end: iso(60) }))).not.toContain('next-return-planning')
  })

  it('next-pulse-visibility: fewer than 5 responses', () => {
    const f = fired(withPulses(calm(), 'A', [30], 3), 'next-pulse-visibility')
    expect(f).toHaveLength(1)
    expect(f[0].finding.evidence.join(' ')).toContain('3 responses')
  })
})

describe('Build long-term rules', () => {
  it('long-crisis-framework: essential task with 2 or fewer competent people available', () => {
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).toContain('long-crisis-framework')
  })

  it('long-simulation: organisation score below 85', () => {
    expect(ids(setHours(calm(), 'tE', 250))).toContain('long-simulation')
  })

  it('long-job-rotation: 3+ thinly covered tasks', () => {
    let d = setSkill(calm(), 'tE', { a3: 0, a4: 0 })
    d = setSkill(d, 'tI', { a3: 0, a4: 0 })
    d = setSkill(d, 'tB', { b3: 0, b4: 0 })
    expect(ids(d)).toContain('long-job-rotation')
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).not.toContain('long-job-rotation') // only 1
  })

  it('long-recognise-skills: an essential task with 2 or fewer trained people overall', () => {
    expect(ids(setSkill(calm(), 'tE', { a3: 0, a4: 0 }))).toContain('long-recognise-skills')
  })

  it('long-wellbeing-programme: any team at Moderate or High', () => {
    expect(ids(withPulses(calm(), 'A', [50]))).toContain('long-wellbeing-programme')
    expect(ids(calm())).not.toContain('long-wellbeing-programme')
  })

  it('long-slack-capacity: a team at 0.85 or more', () => {
    expect(ids(setHours(calm(), 'tE', 100))).toContain('long-slack-capacity')
  })
})

describe('ordering, warnings and statuses', () => {
  const messy = setHours(addAbsence(withPulses(calm(), 'A', [60, 70, 72]), 'a4', { end: null }), 'tE', 200)

  it('orders by horizon, then impact ÷ effort', () => {
    const recs = generateRecommendations(messy, TODAY)
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1].rule, b = recs[i].rule
      const ha = HORIZON_ORDER.indexOf(a.horizon), hb = HORIZON_ORDER.indexOf(b.horizon)
      expect(ha).toBeLessThanOrEqual(hb)
      if (ha === hb) expect(priority(a)).toBeGreaterThanOrEqual(priority(b))
    }
  })

  it('warns, and offers a lighter option, when a work-adding action lands on an overloaded team', () => {
    const rec = fired(messy, 'next-high-burnout-review')[0]
    expect(rec.overloadWarning).toContain('Team A is already overloaded')
    expect(rec.overloadWarning).toContain(rec.rule.lighter!)
  })

  it('does not warn for actions that add no work, or for teams that are not overloaded', () => {
    expect(fired(messy, 'now-defer-work')[0].overloadWarning).toBeNull()
    expect(fired(withPulses(calm(), 'A', [30, 70, 72]), 'next-high-burnout-review')[0].overloadWarning).toBeNull()
  })

  it('reads the saved status for each recommendation', () => {
    const rec = fired(messy, 'now-defer-work')[0]
    expect(rec.status).toBeNull()
    const saved = { ...messy, recommendationStatus: { [rec.key]: 'in-progress' as const } }
    expect(fired(saved, 'now-defer-work')[0].status).toBe('in-progress')
  })

  it('topDoNow returns varied open Do-now actions and skips finished ones', () => {
    const recs = generateRecommendations(messy, TODAY)
    const top = topDoNow(recs, 3)
    expect(top.length).toBeGreaterThan(0)
    expect(new Set(top.map((r) => r.rule.id)).size).toBe(top.length)
    expect(top.every((r) => r.rule.horizon === 'Do now')).toBe(true)
    const done = { ...messy, recommendationStatus: { [top[0].key]: 'done' as const } }
    expect(topDoNow(generateRecommendations(done, TODAY), 3).map((r) => r.key)).not.toContain(top[0].key)
  })
})

describe('Meridian Networks demo', () => {
  const data = buildDemoData(TODAY)
  const recs = generateRecommendations(data, TODAY)

  it('produces recommendations in all three pillars and horizons', () => {
    expect(new Set(recs.map((r) => r.rule.pillar)).size).toBe(3)
    expect(new Set(recs.map((r) => r.rule.horizon)).size).toBe(3)
  })

  it('flags the deliberate single points of failure with evidence', () => {
    const subjects = fired(data, 'now-spof-shadow').map((r) => r.finding.subject)
    expect(subjects).toContain('Core network monitoring')
  })

  it('never ties a burnout recommendation to a person: only role-holders (team lead, HR) are named, and only under "Who to involve"', () => {
    const burnoutRules = ['now-support-visible', 'now-escalate-extreme', 'next-high-burnout-review', 'next-moderate-streak', 'next-rising-trend']
    const staffId = /\b(NOP|FLD|CSP|SEC|BIL|HRA)-\d+/
    for (const r of recs.filter((r) => burnoutRules.includes(r.rule.id))) {
      expect(r.finding.evidence.join(' ') + r.rule.action + r.rule.why, r.key).not.toMatch(staffId)
      const leadIds = data.teams.map((t) => t.leadId)
      const named = (r.finding.involve ?? []).join(' ').match(new RegExp(staffId.source, 'g')) ?? []
      for (const id of named) expect([...leadIds], r.key).toContain(id)
    }
    expect(recs.filter((r) => burnoutRules.includes(r.rule.id) && r.finding.subjectId === 'team-hr')).toEqual([])
  })

  it('names the absent people, the tasks left without them, and who to notify', () => {
    const f = fired(data, 'now-tell-the-team').find((r) => r.finding.subjectId === 'team-netops')!
    const text = f.finding.evidence.join(' ')
    expect(text).toContain('NOP-02')
    expect(text).toContain('Reserve / military duty')
    expect(text).toContain('‘Core network monitoring’ (essential, 1 competent left)')
    expect(f.finding.involve!.join(' ')).toContain('NOP-01 (team lead, Network Operations)')
  })

  it('tells the owning team’s lead when an absence affects another team’s task', () => {
    const d = buildDemoData(TODAY)
    // Make a Field Engineering person (absent) competent at a Network Operations task.
    const fieldAbsent = d.absences.find((a) => a.personId === 'FLD-03')!
    expect(fieldAbsent).toBeTruthy()
    d.skills.push({ personId: 'FLD-03', taskId: 'NOP-T1', level: 2 })
    const f = fired(d, 'now-absence-open-ended')
    d.absences.find((a) => a.personId === 'FLD-03')!.end = null
    const g = fired(d, 'now-absence-open-ended').find((r) => r.finding.subjectId === 'team-field')!
    expect(g.finding.involve!.join(' ')).toContain('NOP-01 (team lead, Network Operations)')
    expect(f.length).toBeGreaterThan(0)
  })

  it('the escalation rule names the team lead and HR contact for extreme cases only', () => {
    const esc = fired(data, 'now-escalate-extreme')
    expect(esc.map((r) => r.finding.subjectId).sort()).toEqual(['team-netops', 'team-support'])
    const involve = esc[0].finding.involve!.join(' ')
    expect(involve).toContain('team lead')
    expect(involve).toContain('HRA-01 (HR, HR & Admin)')
    expect(ids(withPulses(calm(), 'A', [70]))).not.toContain('now-escalate-extreme') // High, but one week and not overloaded
    expect(ids(withPulses(calm(), 'A', [70, 72]))).toContain('now-escalate-extreme')
  })

  it('says so when the named team lead is themselves away', () => {
    const d = addAbsence(withPulses(calm(), 'A', [70, 72]), 'a1') // a1 is Team A's lead
    expect(fired(d, 'now-escalate-extreme')[0].finding.involve!.join(' ')).toContain('currently away, so go to their manager')
  })

  it('tells HR & Admin its results are hidden', () => {
    expect(fired(data, 'next-pulse-visibility').map((r) => r.finding.subjectId)).toContain('team-hr')
  })
})
