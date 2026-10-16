import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../src/data/demoData'
import { applyImport, cleanUp, emptyOrg, integrityIssues, KINDS, parseCsv, parseJsonBackup, parseXlsx, templateCsv, templateXlsx, toCsv, validate, type DataKind } from '../src/data/importExport'
import type { OrgData } from '../src/data/schemas'
import { syncStatuses } from '../src/logic/absenceSync'

const TODAY = new Date('2025-03-31T12:00:00')
const demo = buildDemoData(TODAY)
const csv = (header: string, ...lines: string[]) => parseCsv([header, ...lines].join('\n'))

describe('templates', () => {
  it('have exactly the documented columns and one example row', () => {
    for (const k of KINDS) {
      const sheet = parseCsv(templateCsv(k.kind))
      expect(sheet.headers).toEqual(k.columns)
      expect(sheet.rows).toHaveLength(1)
    }
  })

  it('example rows are valid once the things they refer to exist', () => {
    const d: OrgData = { ...emptyOrg(),
      teams: [{ id: 'team-ops', name: 'Operations', leadId: 'OPS-01', headcount: 12 }],
      people: [{ id: 'OPS-01', displayName: 'OPS-01', teamId: 'team-ops', role: 'Lead', fte: 1, status: 'available' }],
      tasks: [{ id: 'OPS-T1', name: 'x', teamId: 'team-ops', criticality: 'essential', weeklyHours: 1, hasDocumentedProcess: true }] }
    for (const k of KINDS) {
      const v = validate(k.kind, parseCsv(templateCsv(k.kind)), d)
      expect(v.errors, k.kind).toEqual([])
      expect(v.items).toHaveLength(1)
    }
  })

  it('Excel templates read back with the same columns', () => {
    for (const k of KINDS) expect(parseXlsx(templateXlsx(k.kind), k.kind).headers).toEqual(k.columns)
  })
})

describe('export → import round trip', () => {
  it.each(KINDS.map((k) => k.kind))('%s: CSV export validates with no errors and keeps every row', (kind: DataKind) => {
    const v = validate(kind, parseCsv(toCsv(demo, kind)), demo)
    expect(v.errors).toEqual([])
    expect(v.items).toHaveLength((demo[kind] as unknown[]).length)
  })

  it('keeps absence dates and unknown end dates exactly', () => {
    const v = validate('absences', parseCsv(toCsv(demo, 'absences')), demo)
    expect(v.items).toEqual(demo.absences)
  })

  it('Excel dates (real date cells) become YYYY-MM-DD', () => {
    const ws = XLSX.utils.aoa_to_sheet([['id', 'person_id', 'type', 'start', 'end', 'certainty'], ['a1', 'NOP-01', 'illness', new Date(2025, 2, 3), '', 'likely']], { cellDates: true })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'absences')
    const sheet = parseXlsx(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 'absences')
    expect(sheet.rows[0].start).toBe('2025-03-03')
    expect(validate('absences', sheet, demo).errors).toEqual([])
  })

  it('JSON backup restores everything', () => {
    const { data, error } = parseJsonBackup(JSON.stringify(demo))
    expect(error).toBeNull()
    expect(data).toEqual(demo)
    expect(parseJsonBackup('not json').error).toMatch(/not valid JSON/)
    expect(parseJsonBackup('{"teams":[]}').error).toMatch(/Missing lists/)
  })
})

describe('plain-English validation', () => {
  it('names the row, the column and what to do (people)', () => {
    const v = validate('people', csv('id,display_name,team_id,role,fte,status', 'P1,P1,team-netops,Eng,1,available', 'P2,P2,nowhere,Eng,abc,sick'), demo)
    const text = v.errors.map((e) => e.message).join('\n')
    expect(text).toContain('Row 3: team_id “nowhere” does not match any team')
    expect(text).toContain('Row 3: “fte” should be a number above 0 and at most 1')
    expect(text).toContain('Row 3: “status” should be available or absent. You entered “sick”')
    expect(text).not.toContain('Row 2')
    expect(v.items).toHaveLength(1)
  })

  it('reports empty required cells and duplicates, with the first row', () => {
    const v = validate('teams', csv('id,name,lead_id,headcount', 't1,,NOP-01,5', 't1,Dup,NOP-01,5'), demo)
    const text = v.errors.map((e) => e.message).join('\n')
    expect(text).toContain('Row 2: “name” is empty. It is required.')
    expect(text).toContain('Row 3: id “t1” appears more than once (first on row 2)')
  })

  it('explains a missing column and stops', () => {
    const v = validate('tasks', csv('id,name,team_id', 'x,y,team-netops'), demo)
    expect(v.errors).toHaveLength(1)
    expect(v.errors[0].message).toMatch(/missing columns? called .*criticality.*weekly_hours.*Download the template/)
  })

  it('checks task fields', () => {
    const v = validate('tasks', csv('id,name,team_id,criticality,weekly_hours,has_documented_process', 'T1,A,team-netops,urgent,-5,maybe'), demo)
    expect(v.errors.map((e) => e.message).join(' ')).toMatch(/criticality.*essential, important or deferrable.*hours.*zero or more.*yes or no/s)
  })

  it('checks skills references, levels and duplicate pairs', () => {
    const v = validate('skills', csv('person_id,task_id,level', 'NOP-01,NOP-T1,2', 'NOP-01,NOP-T1,3', 'GHOST,NOP-T1,4', 'NOP-02,NOPE,1'), demo)
    const text = v.errors.map((e) => e.message).join('\n')
    expect(text).toContain('Row 3: The person and task pair “NOP-01|NOP-T1” appears more than once')
    expect(text).toContain('Row 4: person_id “GHOST” does not match anyone')
    expect(text).toContain('Row 4: “level” should be 0, 1, 2 or 3')
    expect(text).toContain('Row 5: task_id “NOPE” does not match any task')
  })

  it('checks absence dates, types and ordering; accepts labels and an "unknown" end', () => {
    const header = 'id,person_id,type,start,end,certainty'
    const bad = validate('absences', csv(header, 'a1,NOP-01,holiday,03/03/2025,2025-02-30,sure', 'a2,NOP-01,illness,2025-05-01,2025-04-01,likely'), demo)
    const text = bad.errors.map((e) => e.message).join('\n')
    expect(text).toContain('“type” should be one of')
    expect(text).toContain('“start” should be a date written as YYYY-MM-DD')
    expect(text).toContain('“end” should be a date')
    expect(text).toContain('Row 3: “end” (2025-04-01) is before “start” (2025-05-01)')
    const good = validate('absences', csv(header, 'a1,NOP-01,Illness,2025-05-01,unknown,likely', 'a2,NOP-02,reserve-duty,2025-05-01,,confirmed'), demo)
    expect(good.errors).toEqual([])
    expect(good.items.map((a) => (a as { end: string | null }).end)).toEqual([null, null])
  })

  it('warns, but does not block, when a team lead is not in the people data', () => {
    const v = validate('teams', csv('id,name,lead_id,headcount', 'tx,X,UNKNOWN-1,3'), demo)
    expect(v.errors).toEqual([])
    expect(v.warnings[0].message).toContain('lead_id “UNKNOWN-1” is not in the People data yet')
  })

  it('rejects an empty file', () => {
    expect(validate('teams', csv('id,name,lead_id,headcount'), demo).errors[0].message).toMatch(/no data rows/)
  })

  it('is forgiving about header case and spaces', () => {
    const v = validate('skills', csv('Person ID,Task-ID,LEVEL', 'NOP-02,NOP-T1,2'), demo)
    expect(v.errors).toEqual([])
  })
})

describe('applying an import', () => {
  const team = { id: 'team-new', name: 'New', leadId: '', headcount: 1 }

  it('replace swaps the whole list; merge adds new rows and updates matching ones', () => {
    const replaced = applyImport(demo, 'teams', [team], 'replace', TODAY)
    expect(replaced.teams).toEqual([team])
    const merged = applyImport(demo, 'teams', [team, { ...demo.teams[0], name: 'Renamed' }], 'merge', TODAY)
    expect(merged.teams).toHaveLength(demo.teams.length + 1)
    expect(merged.teams[0].name).toBe('Renamed')
  })

  it('removes skills and absences of people who are no longer there, and reports orphaned people', () => {
    const slim = applyImport(demo, 'people', demo.people.filter((p) => p.teamId === 'team-netops'), 'replace', TODAY)
    expect(slim.skills.every((s) => slim.people.some((p) => p.id === s.personId))).toBe(true)
    expect(slim.absences.every((a) => slim.people.some((p) => p.id === a.personId))).toBe(true)
    const noTeams = applyImport(demo, 'teams', [], 'replace', TODAY)
    expect(integrityIssues(noTeams).join(' ')).toContain('refer to a team that does not exist')
    expect(integrityIssues(demo)).toEqual([])
  })

  it('imports skills as a merge without disturbing others', () => {
    const merged = applyImport(demo, 'skills', [{ personId: 'NOP-02', taskId: 'NOP-T1', level: 0 }], 'merge', TODAY)
    expect(merged.skills).toHaveLength(demo.skills.length)
    expect(merged.skills.find((s) => s.personId === 'NOP-02' && s.taskId === 'NOP-T1')!.level).toBe(0)
  })

  it('does not change the original data', () => {
    const before = JSON.stringify(demo)
    applyImport(demo, 'teams', [team], 'replace', TODAY)
    expect(JSON.stringify(demo)).toBe(before)
  })
})

describe('keeping status in line with absences', () => {
  it('marks people absent while an absence is in progress and available otherwise', () => {
    const d = cleanUp({ ...demo, absences: [{ id: 'x', personId: 'FLD-05', type: 'illness', start: '2025-03-01', end: '2025-03-20', certainty: 'confirmed' }] }, TODAY)
    expect(d.people.find((p) => p.id === 'FLD-05')!.status).toBe('available') // ended before today
    const active = syncStatuses({ ...d, absences: [{ id: 'x', personId: 'FLD-05', type: 'illness', start: '2025-03-01', end: null, certainty: 'confirmed' }] }, TODAY)
    expect(active.people.find((p) => p.id === 'FLD-05')!.status).toBe('absent')
  })

  it('leaves people with no absence records alone', () => {
    const d = { ...demo, people: demo.people.map((p) => (p.id === 'BIL-03' ? { ...p, status: 'absent' as const } : p)) }
    expect(syncStatuses(d, TODAY).people.find((p) => p.id === 'BIL-03')!.status).toBe('absent')
  })
})

describe('an empty organisation', () => {
  it('can be measured, scanned for recommendations and simulated without errors', async () => {
    const { orgMetrics } = await import('../src/logic/resilienceScore')
    const { generateRecommendations } = await import('../src/logic/recommend')
    const { runScenario } = await import('../src/logic/scenario')
    const { topRisks } = await import('../src/logic/risks')
    const empty = emptyOrg()
    expect(() => orgMetrics(empty)).not.toThrow()
    expect(generateRecommendations(empty, TODAY)).toEqual([])
    expect(topRisks(empty)).toEqual([])
    const r = runScenario(empty, { id: 's', name: 's', absenceType: 'illness', weeks: 2, selector: { kind: 'team-percent', teamId: 'all', percent: 20, worstCase: false } })
    expect(r.affectedIds).toEqual([])
  })
})
