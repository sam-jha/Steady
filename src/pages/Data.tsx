import { useState } from 'react'
import { downloadFile, MIME } from '../components/download'
import EditableTable, { type Col } from '../components/EditableTable'
import ImportPanel from '../components/ImportPanel'
import SkillsGrid from '../components/SkillsGrid'
import { useApp } from '../data/AppContext'
import { cleanUp, emptyOrg, exportXlsx, KINDS, toCsv } from '../data/importExport'
import { ABSENCE_LABELS, type Absence, type AbsenceType, type Certainty, type Criticality, type Person, type Task, type Team } from '../data/schemas'

type Tab = 'overview' | 'teams' | 'people' | 'tasks' | 'skills' | 'absences' | 'import' | 'export'
const TABS: Array<[Tab, string]> = [['overview', 'Overview'], ['teams', 'Teams'], ['people', 'People'], ['tasks', 'Tasks'], ['skills', 'Skills matrix'], ['absences', 'Absences'], ['import', 'Import'], ['export', 'Export']]
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 36).toString(36)}`
const opts = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((k) => ({ value: k, label: labels[k] }))

export default function Data() {
  const { data, updateData, resetToDemo } = useApp()
  const [tab, setTab] = useState<Tab>('overview')
  const [teamFilter, setTeamFilter] = useState('all')
  const [notice, setNotice] = useState('')

  const teamOptions = data.teams.map((t) => ({ value: t.id, label: t.name }))
  const personOptions = data.people.map((p) => ({ value: p.id, label: `${p.id} (${p.role})` }))
  const inTeam = (teamId: string) => teamFilter === 'all' || teamId === teamFilter
  const personTeam = new Map(data.people.map((p) => [p.id, p.teamId]))

  // ----- teams -----
  const teamCols: Array<Col<Team>> = [
    { key: 'id', label: 'Id', kind: 'text', readOnly: true }, { key: 'name', label: 'Name', kind: 'text' },
    { key: 'leadId', label: 'Lead (person id)', kind: 'select', options: [{ value: '', label: '(none)' }, ...personOptions] },
    { key: 'headcount', label: 'Headcount', kind: 'number', min: 0, max: 10000 },
  ]
  const deleteTeam = (t: Team) => {
    const used = data.people.filter((p) => p.teamId === t.id).length + data.tasks.filter((k) => k.teamId === t.id).length
    if (used > 0) { setNotice(`${t.name} still has people or tasks. Move or delete those first.`); return }
    setNotice('')
    updateData((d) => ({ ...d, teams: d.teams.filter((x) => x.id !== t.id), pulses: d.pulses.filter((p) => p.teamId !== t.id) }))
  }

  // ----- people -----
  const peopleCols: Array<Col<Person>> = [
    { key: 'id', label: 'Id', kind: 'text', readOnly: true }, { key: 'displayName', label: 'Display name or pseudonym', kind: 'text' },
    { key: 'teamId', label: 'Team', kind: 'select', options: teamOptions }, { key: 'role', label: 'Role', kind: 'text' },
    { key: 'fte', label: 'FTE (1 = full time)', kind: 'number', min: 0.1, max: 1, step: 0.1 },
    { key: 'status', label: 'Status', kind: 'select', options: [{ value: 'available', label: 'Available' }, { value: 'absent', label: 'Absent' }] },
  ]
  const deletePerson = (p: Person) =>
    updateData((d) => ({ ...d, people: d.people.filter((x) => x.id !== p.id), skills: d.skills.filter((s) => s.personId !== p.id), absences: d.absences.filter((a) => a.personId !== p.id) }))

  // ----- tasks -----
  const taskCols: Array<Col<Task>> = [
    { key: 'id', label: 'Id', kind: 'text', readOnly: true }, { key: 'name', label: 'Task', kind: 'text' },
    { key: 'teamId', label: 'Owning team', kind: 'select', options: teamOptions },
    { key: 'criticality', label: 'Criticality', kind: 'select', options: opts<Criticality>({ essential: 'Essential', important: 'Important', deferrable: 'Deferrable' }) },
    { key: 'weeklyHours', label: 'Hours per week', kind: 'number', min: 0, max: 100000 },
    { key: 'hasDocumentedProcess', label: 'Process written down?', kind: 'checkbox' },
  ]

  // ----- absences -----
  const absenceCols: Array<Col<Absence>> = [
    { key: 'id', label: 'Id', kind: 'text', readOnly: true }, { key: 'personId', label: 'Person', kind: 'select', options: personOptions },
    { key: 'type', label: 'Type', kind: 'select', options: opts<AbsenceType>(ABSENCE_LABELS) },
    { key: 'start', label: 'Start', kind: 'date' }, { key: 'end', label: 'Expected end (blank = unknown)', kind: 'date' },
    { key: 'certainty', label: 'Certainty', kind: 'select', options: opts<Certainty>({ confirmed: 'Confirmed', likely: 'Likely', possible: 'Possible' }) },
  ]
  const teamFilterBox = (
    <label className="text-sm flex items-center gap-2">Show team
      <select className="border border-line rounded-md bg-white px-2 py-1.5" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
        <option value="all">All teams</option>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
  )

  const btn = 'px-3 py-2 rounded-md border border-line bg-white hover:bg-accent-soft text-sm'
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Data</h1>
        <p className="text-sm text-muted">Saved in this browser only. Nothing is sent anywhere.</p>
      </div>

      <div role="tablist" aria-label="Data sections" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="data-panel" type="button" tabIndex={tab === id ? 0 : -1}
            onClick={() => { setTab(id); setNotice('') }}
            onKeyDown={(e) => {
              // Arrow keys move between tabs, as screen-reader and keyboard users expect.
              const i = TABS.findIndex(([t]) => t === id)
              const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null
              if (next === null) return
              e.preventDefault()
              const [nextId] = TABS[(next + TABS.length) % TABS.length]
              setTab(nextId); setNotice('')
              document.getElementById(`tab-${nextId}`)?.focus()
            }}
            className={`px-3 py-2 text-sm rounded-t-md ${tab === id ? 'bg-accent text-white font-medium' : 'hover:bg-accent-soft'}`}>{label}</button>
        ))}
      </div>

      <div id="data-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
        {notice && <p role="alert" className="rounded-md border border-amber-400 bg-amber-100 text-amber-950 p-3 text-sm">▲ {notice}</p>}

        {tab === 'overview' && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {([['Teams', data.teams.length], ['People', data.people.filter((p) => !p.role.startsWith('Vacancy')).length], ['Tasks', data.tasks.length], ['Skill ratings', data.skills.length], ['Absences', data.absences.length], ['Pulse responses', data.pulses.length]] as const).map(([l, n]) => (
                <div key={l} className="bg-white border border-line rounded-lg p-3"><dt className="text-sm text-muted">{l}</dt><dd className="text-2xl font-semibold">{n}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => { if (window.confirm('Replace all data with the fictional demo data?')) resetToDemo() }}>Reset to demo data</button>
              <button type="button" className={btn} onClick={() => { if (window.confirm('Delete ALL data and start with an empty organisation? Export first if you want a copy.')) updateData(() => emptyOrg()) }}>Start with an empty organisation</button>
            </div>
            <p className="text-sm text-muted max-w-prose">To use your own data: start empty, then import Teams, People, Tasks, Skills matrix and Absences from spreadsheets (see the Import tab), or type them in by hand. Wellbeing pulse responses come from the pulse itself.</p>
          </div>
        )}

        {tab === 'teams' && <EditableTable caption="Teams" rows={data.teams} cols={teamCols} rowKey={(t) => t.id} addLabel="Add a team"
          onChange={(t, patch) => updateData((d) => ({ ...d, teams: d.teams.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }))}
          onDelete={deleteTeam} onAdd={() => updateData((d) => ({ ...d, teams: [...d.teams, { id: newId('team'), name: 'New team', leadId: '', headcount: 0 }] }))} />}

        {tab === 'people' && <>{teamFilterBox}<EditableTable caption="People" rows={data.people.filter((p) => inTeam(p.teamId))} cols={peopleCols} rowKey={(p) => p.id} addLabel="Add a person"
          onChange={(p, patch) => updateData((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }))}
          onDelete={deletePerson} onAdd={() => updateData((d) => d.teams.length === 0 ? d : { ...d, people: [...d.people, { id: newId('P'), displayName: 'New person', teamId: teamFilter !== 'all' ? teamFilter : d.teams[0].id, role: 'Staff', fte: 1, status: 'available' }] })} /></>}

        {tab === 'tasks' && <>{teamFilterBox}<EditableTable caption="Critical functions and tasks" rows={data.tasks.filter((t) => inTeam(t.teamId))} cols={taskCols} rowKey={(t) => t.id} addLabel="Add a task"
          onChange={(t, patch) => updateData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }))}
          onDelete={(t) => updateData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id), skills: d.skills.filter((s) => s.taskId !== t.id) }))}
          onAdd={() => updateData((d) => d.teams.length === 0 ? d : { ...d, tasks: [...d.tasks, { id: newId('T'), name: 'New task', teamId: teamFilter !== 'all' ? teamFilter : d.teams[0].id, criticality: 'important', weeklyHours: 10, hasDocumentedProcess: false }] })} /></>}

        {tab === 'skills' && <SkillsGrid />}

        {tab === 'absences' && <>{teamFilterBox}
          <p className="text-sm text-muted max-w-prose">A person’s status is set automatically from their absences: absent while one is in progress, available otherwise.</p>
          <EditableTable caption="Absences" rows={data.absences.filter((a) => inTeam(personTeam.get(a.personId) ?? ''))} cols={absenceCols} rowKey={(a) => a.id} addLabel="Add an absence"
            onChange={(a, patch) => updateData((d) => cleanUp({ ...d, absences: d.absences.map((x) => (x.id === a.id ? { ...x, ...patch } : x)) }))}
            onDelete={(a) => updateData((d) => cleanUp({ ...d, absences: d.absences.filter((x) => x.id !== a.id) }))}
            onAdd={() => updateData((d) => {
              const who = d.people.find((p) => inTeam(p.teamId)) ?? d.people[0]
              if (!who) return d
              return cleanUp({ ...d, absences: [...d.absences, { id: newId('abs'), personId: who.id, type: 'other', start: new Date().toISOString().slice(0, 10), end: null, certainty: 'possible' }] })
            })} /></>}

        {tab === 'import' && <ImportPanel />}

        {tab === 'export' && (
          <div className="space-y-4">
            <div className="bg-white border border-line rounded-lg p-4 space-y-2">
              <h2 className="font-semibold">Everything</h2>
              <p className="text-sm text-muted">JSON includes everything (pulse history, saved scenarios, recommendation statuses) and can be restored in the Import tab. The Excel workbook has one sheet per data type, using the same columns as the templates. Pulse responses are anonymous and appear only in the JSON.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => downloadFile('steady-export.json', JSON.stringify(data, null, 2), MIME.json)}>Download JSON</button>
                <button type="button" className={btn} onClick={() => downloadFile('steady-export.xlsx', exportXlsx(data), MIME.xlsx)}>Download Excel workbook</button>
              </div>
            </div>
            <div className="bg-white border border-line rounded-lg p-4 space-y-2">
              <h2 className="font-semibold">One type at a time (CSV)</h2>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => <button key={k.kind} type="button" className={btn} onClick={() => downloadFile(`steady-${k.kind}.csv`, toCsv(data, k.kind), MIME.csv)}>{k.label} (CSV)</button>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
