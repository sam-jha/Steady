// Reading and writing spreadsheets (CSV and Excel), templates, validation and merging.
// Validation messages are written in plain English and say which row and column to fix.

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { syncStatuses } from '../logic/absenceSync'
import { ABSENCE_LABELS, type Absence, type AbsenceType, type Certainty, type Criticality, type OrgData, type Person, type ProficiencyLevel, type SkillRating, type Task, type Team } from './schemas'

export type DataKind = 'teams' | 'people' | 'tasks' | 'skills' | 'absences'
export type Row = Record<string, string>

export interface KindInfo {
  kind: DataKind
  label: string
  columns: string[]
  example: Row
  help: string
}

export const KINDS: KindInfo[] = [
  { kind: 'teams', label: 'Teams', columns: ['id', 'name', 'lead_id', 'headcount'], example: { id: 'team-ops', name: 'Operations', lead_id: 'OPS-01', headcount: '12' },
    help: 'One row per team. lead_id is the id of the team lead (from the People sheet).' },
  { kind: 'people', label: 'People', columns: ['id', 'display_name', 'team_id', 'role', 'fte', 'status'], example: { id: 'OPS-01', display_name: 'OPS-01', team_id: 'team-ops', role: 'Team Lead', fte: '1', status: 'available' },
    help: 'One row per person. Use a pseudonym or initials rather than a full name if you are sharing the file. fte is 1 for full time, 0.6 for three days a week. status is available or absent.' },
  { kind: 'tasks', label: 'Tasks', columns: ['id', 'name', 'team_id', 'criticality', 'weekly_hours', 'has_documented_process'], example: { id: 'OPS-T1', name: 'Incident triage', team_id: 'team-ops', criticality: 'essential', weekly_hours: '40', has_documented_process: 'yes' },
    help: 'One row per task. criticality is essential, important or deferrable. weekly_hours is the total hours of demand per week. has_documented_process is yes or no.' },
  { kind: 'skills', label: 'Skills matrix', columns: ['person_id', 'task_id', 'level'], example: { person_id: 'OPS-01', task_id: 'OPS-T1', level: '3' },
    help: 'One row per person and task. level is 0 (cannot do), 1 (with supervision), 2 (competent) or 3 (can train others). Missing pairs count as 0.' },
  { kind: 'absences', label: 'Absences', columns: ['id', 'person_id', 'type', 'start', 'end', 'certainty'], example: { id: 'abs-1', person_id: 'OPS-01', type: 'reserve-duty', start: '2025-03-03', end: '2025-05-01', certainty: 'confirmed' },
    help: `One row per absence. type is one of: ${Object.keys(ABSENCE_LABELS).join(', ')}. Dates are YYYY-MM-DD. Leave end blank (or write unknown) if it is not known. certainty is confirmed, likely or possible.` },
]
export const kindInfo = (k: DataKind) => KINDS.find((x) => x.kind === k)!

// ---------- export ----------

const yesNo = (b: boolean) => (b ? 'yes' : 'no')

export function toRows(data: OrgData, kind: DataKind): Row[] {
  switch (kind) {
    case 'teams': return data.teams.map((t) => ({ id: t.id, name: t.name, lead_id: t.leadId, headcount: String(t.headcount) }))
    case 'people': return data.people.map((p) => ({ id: p.id, display_name: p.displayName, team_id: p.teamId, role: p.role, fte: String(p.fte), status: p.status }))
    case 'tasks': return data.tasks.map((t) => ({ id: t.id, name: t.name, team_id: t.teamId, criticality: t.criticality, weekly_hours: String(t.weeklyHours), has_documented_process: yesNo(t.hasDocumentedProcess) }))
    case 'skills': return data.skills.map((s) => ({ person_id: s.personId, task_id: s.taskId, level: String(s.level) }))
    case 'absences': return data.absences.map((a) => ({ id: a.id, person_id: a.personId, type: a.type, start: a.start, end: a.end ?? '', certainty: a.certainty }))
  }
}

export const toCsv = (data: OrgData, kind: DataKind) => Papa.unparse({ fields: kindInfo(kind).columns, data: toRows(data, kind).map((r) => kindInfo(kind).columns.map((c) => r[c])) })
export const templateCsv = (kind: DataKind) => Papa.unparse({ fields: kindInfo(kind).columns, data: [kindInfo(kind).columns.map((c) => kindInfo(kind).example[c])] })

export function templateXlsx(kind: DataKind): ArrayBuffer {
  const info = kindInfo(kind)
  const ws = XLSX.utils.aoa_to_sheet([info.columns, info.columns.map((c) => info.example[c])])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, kind)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

// ---------- reading files ----------

export interface ParsedSheet { headers: string[]; rows: Row[] }

const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_')

/** Excel dates arrive as Date objects; turn them into plain YYYY-MM-DD (adding half a day avoids time-zone rounding). */
function cellText(v: unknown): string {
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return v === null || v === undefined ? '' : String(v).trim()
}

export function parseCsv(text: string): ParsedSheet {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const [head = [], ...body] = result.data
  const headers = head.map((h) => normaliseHeader(String(h)))
  return { headers, rows: body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cellText(cells[i])]))) }
}

/** Reads the sheet called `preferred` if there is one, otherwise the first sheet. */
export function parseXlsx(buffer: ArrayBuffer, preferred?: string): ParsedSheet {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const name = (preferred && wb.SheetNames.find((n) => n.toLowerCase() === preferred)) || wb.SheetNames[0]
  if (!name) return { headers: [], rows: [] }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false })
  const [head = [], ...body] = matrix
  const headers = head.map((h) => normaliseHeader(cellText(h)))
  return { headers, rows: body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cellText(cells[i])]))) }
}

// ---------- validation ----------

export interface Issue { row: number | null; message: string }
export interface Validated<T> { items: T[]; errors: Issue[]; warnings: Issue[] }

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00Z').getTime()) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s
const CRITICALITIES: Criticality[] = ['essential', 'important', 'deferrable']
const CERTAINTIES: Certainty[] = ['confirmed', 'likely', 'possible']
const STATUSES = ['available', 'absent'] as const
const YES = ['yes', 'y', 'true', '1'], NO = ['no', 'n', 'false', '0', '']

function absenceTypeFrom(s: string): AbsenceType | null {
  const t = s.trim().toLowerCase()
  for (const [key, label] of Object.entries(ABSENCE_LABELS)) if (t === key || t === label.toLowerCase()) return key as AbsenceType
  return null
}

export function validate(kind: DataKind, sheet: ParsedSheet, data: OrgData): Validated<Team | Person | Task | SkillRating | Absence> {
  const info = kindInfo(kind)
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const items: Array<Team | Person | Task | SkillRating | Absence> = []

  const missing = info.columns.filter((c) => !sheet.headers.includes(c) && !(kind === 'absences' && c === 'end') && !(kind === 'people' && c === 'status'))
  if (missing.length > 0) {
    errors.push({ row: null, message: `The file is missing ${missing.length === 1 ? 'a column' : 'columns'} called ${missing.map((m) => `“${m}”`).join(', ')}. Download the template to see the columns Steady expects (the first row of the file must be the column names).` })
    return { items, errors, warnings }
  }
  if (sheet.rows.length === 0) {
    errors.push({ row: null, message: 'The file has column names but no data rows.' })
    return { items, errors, warnings }
  }

  const seen = new Map<string, number>()
  const teamIds = new Set(data.teams.map((t) => t.id))
  const personIds = new Set(data.people.map((p) => p.id))
  const taskIds = new Set(data.tasks.map((t) => t.id))

  sheet.rows.forEach((raw, i) => {
    const r = i + 2 // row 1 is the header, so the first data row is row 2 in the spreadsheet
    const err = (message: string) => errors.push({ row: r, message: `Row ${r}: ${message}` })
    const need = (col: string) => {
      const v = (raw[col] ?? '').trim()
      if (v === '') err(`“${col}” is empty. It is required.`)
      return v
    }
    const unique = (key: string, col: string) => {
      const first = seen.get(key)
      if (first !== undefined) err(`${col} “${key}” appears more than once (first on row ${first}). Each one must be unique.`)
      else seen.set(key, r)
    }
    const before = errors.length

    if (kind === 'teams') {
      const id = need('id'), name = need('name')
      const lead = (raw.lead_id ?? '').trim()
      const hc = num(raw.headcount ?? '')
      if (id) unique(id, 'id')
      if (!Number.isInteger(hc) || hc < 0) err(`“headcount” should be a whole number such as 12. You entered “${raw.headcount ?? ''}”.`)
      if (lead && !personIds.has(lead)) warnings.push({ row: r, message: `Row ${r}: lead_id “${lead}” is not in the People data yet. Import People too, or fix the id.` })
      if (errors.length === before) items.push({ id, name, leadId: lead, headcount: hc })
    }

    if (kind === 'people') {
      const id = need('id'), name = (raw.display_name ?? '').trim() || (raw.id ?? '').trim(), team = need('team_id'), role = need('role')
      const fte = num(raw.fte ?? '')
      const status = ((raw.status ?? '').trim().toLowerCase() || 'available') as (typeof STATUSES)[number]
      if (id) unique(id, 'id')
      if (team && !teamIds.has(team)) err(`team_id “${team}” does not match any team. Import or add the team first. Known teams: ${[...teamIds].join(', ') || 'none yet'}.`)
      if (Number.isNaN(fte) || fte <= 0 || fte > 1) err(`“fte” should be a number above 0 and at most 1 (for example 1 for full time, 0.6 for three days a week). You entered “${raw.fte ?? ''}”.`)
      if (!STATUSES.includes(status)) err(`“status” should be available or absent. You entered “${raw.status}”.`)
      if (errors.length === before) items.push({ id, displayName: name, teamId: team, role, fte, status })
    }

    if (kind === 'tasks') {
      const id = need('id'), name = need('name'), team = need('team_id')
      const crit = (raw.criticality ?? '').trim().toLowerCase() as Criticality
      const hours = num(raw.weekly_hours ?? '')
      const doc = (raw.has_documented_process ?? '').trim().toLowerCase()
      if (id) unique(id, 'id')
      if (team && !teamIds.has(team)) err(`team_id “${team}” does not match any team. Import or add the team first.`)
      if (!CRITICALITIES.includes(crit)) err(`“criticality” should be essential, important or deferrable. You entered “${raw.criticality ?? ''}”.`)
      if (Number.isNaN(hours) || hours < 0) err(`“weekly_hours” should be a number of hours, zero or more. You entered “${raw.weekly_hours ?? ''}”.`)
      if (!YES.includes(doc) && !NO.includes(doc)) err(`“has_documented_process” should be yes or no. You entered “${raw.has_documented_process}”.`)
      if (errors.length === before) items.push({ id, name, teamId: team, criticality: crit, weeklyHours: hours, hasDocumentedProcess: YES.includes(doc) })
    }

    if (kind === 'skills') {
      const person = need('person_id'), task = need('task_id')
      const level = num(raw.level ?? '')
      if (person && !personIds.has(person)) err(`person_id “${person}” does not match anyone in the People data.`)
      if (task && !taskIds.has(task)) err(`task_id “${task}” does not match any task.`)
      if (![0, 1, 2, 3].includes(level)) err(`“level” should be 0, 1, 2 or 3 (0 = cannot do, 1 = with supervision, 2 = competent, 3 = can train others). You entered “${raw.level ?? ''}”.`)
      if (person && task) unique(`${person}|${task}`, 'The person and task pair')
      if (errors.length === before) items.push({ personId: person, taskId: task, level: level as ProficiencyLevel })
    }

    if (kind === 'absences') {
      const id = need('id'), person = need('person_id'), start = need('start')
      const type = absenceTypeFrom(raw.type ?? '')
      const endRaw = (raw.end ?? '').trim()
      const unknownEnd = endRaw === '' || endRaw.toLowerCase() === 'unknown'
      const certainty = (raw.certainty ?? '').trim().toLowerCase() as Certainty
      if (id) unique(id, 'id')
      if (person && !personIds.has(person)) err(`person_id “${person}” does not match anyone in the People data.`)
      if (!type) err(`“type” should be one of: ${Object.keys(ABSENCE_LABELS).join(', ')}. You entered “${raw.type ?? ''}”.`)
      if (start && !isDate(start)) err(`“start” should be a date written as YYYY-MM-DD, for example 2025-03-03. You entered “${start}”.`)
      if (!unknownEnd && !isDate(endRaw)) err(`“end” should be a date written as YYYY-MM-DD, or left blank (or “unknown”) if it is not known. You entered “${endRaw}”.`)
      if (isDate(start) && !unknownEnd && isDate(endRaw) && endRaw < start) err(`“end” (${endRaw}) is before “start” (${start}).`)
      if (!CERTAINTIES.includes(certainty)) err(`“certainty” should be confirmed, likely or possible. You entered “${raw.certainty ?? ''}”.`)
      if (errors.length === before) items.push({ id, personId: person, type: type!, start, end: unknownEnd ? null : endRaw, certainty })
    }
  })
  return { items, errors, warnings }
}

// ---------- applying an import ----------

export type ImportMode = 'replace' | 'merge'
const keyOf = (kind: DataKind, item: Team | Person | Task | SkillRating | Absence) =>
  kind === 'skills' ? `${(item as SkillRating).personId}|${(item as SkillRating).taskId}` : (item as { id: string }).id

/** Returns new data with the import applied. Replace swaps the whole list; merge adds new rows and updates matching ones. */
export function applyImport(data: OrgData, kind: DataKind, items: Array<Team | Person | Task | SkillRating | Absence>, mode: ImportMode, today = new Date()): OrgData {
  const current = data[kind] as Array<Team | Person | Task | SkillRating | Absence>
  let next: typeof items
  if (mode === 'replace') next = items
  else {
    const incoming = new Map(items.map((x) => [keyOf(kind, x), x]))
    next = [...current.map((x) => incoming.get(keyOf(kind, x)) ?? x), ...items.filter((x) => !current.some((c) => keyOf(kind, c) === keyOf(kind, x)))]
  }
  return cleanUp({ ...data, [kind]: next } as OrgData, today)
}

/** Removes skills and absences that point at people or tasks that no longer exist, and syncs statuses. */
export function cleanUp(data: OrgData, today = new Date()): OrgData {
  const people = new Set(data.people.map((p) => p.id))
  const tasks = new Set(data.tasks.map((t) => t.id))
  return syncStatuses({
    ...data,
    skills: data.skills.filter((s) => people.has(s.personId) && tasks.has(s.taskId)),
    absences: data.absences.filter((a) => people.has(a.personId)),
  }, today)
}

/** Things that would be inconsistent after an import (shown as warnings in the preview). */
export function integrityIssues(data: OrgData): string[] {
  const out: string[] = []
  const teams = new Set(data.teams.map((t) => t.id))
  const orphanPeople = data.people.filter((p) => !teams.has(p.teamId))
  if (orphanPeople.length) out.push(`${orphanPeople.length} ${orphanPeople.length === 1 ? 'person refers' : 'people refer'} to a team that does not exist (${orphanPeople.slice(0, 3).map((p) => p.id).join(', ')}${orphanPeople.length > 3 ? '…' : ''}).`)
  const orphanTasks = data.tasks.filter((t) => !teams.has(t.teamId))
  if (orphanTasks.length) out.push(`${orphanTasks.length} ${orphanTasks.length === 1 ? 'task refers' : 'tasks refer'} to a team that does not exist.`)
  return out
}

export { emptyOrg, parseJsonBackup } from './backup'

/** All five data types as one Excel workbook, one sheet each, named like the templates. */
export function exportXlsx(data: OrgData): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  for (const info of KINDS) {
    const rows = toRows(data, info.kind)
    const ws = XLSX.utils.aoa_to_sheet([info.columns, ...rows.map((r) => info.columns.map((c) => r[c]))])
    XLSX.utils.book_append_sheet(wb, ws, info.kind)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
