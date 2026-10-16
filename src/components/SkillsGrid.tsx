import { useState } from 'react'
import { useApp } from '../data/AppContext'
import type { ProficiencyLevel } from '../data/schemas'

const LEVELS: Array<{ v: ProficiencyLevel; label: string }> = [
  { v: 0, label: '0 · cannot do' }, { v: 1, label: '1 · with supervision' }, { v: 2, label: '2 · competent' }, { v: 3, label: '3 · can train others' },
]

/** People down the side, tasks across the top. Pick a level in any cell. A cell with no record counts as 0. */
export default function SkillsGrid() {
  const { data, updateData } = useApp()
  const [peopleTeam, setPeopleTeam] = useState(data.teams[0]?.id ?? '')
  const [taskTeam, setTaskTeam] = useState(data.teams[0]?.id ?? '')
  const people = data.people.filter((p) => p.teamId === peopleTeam)
  const tasks = data.tasks.filter((t) => t.teamId === taskTeam)
  const level = (personId: string, taskId: string) => data.skills.find((s) => s.personId === personId && s.taskId === taskId)?.level ?? 0

  const set = (personId: string, taskId: string, lvl: ProficiencyLevel) =>
    updateData((d) => {
      const others = d.skills.filter((s) => !(s.personId === personId && s.taskId === taskId))
      return { ...d, skills: lvl === 0 ? others : [...others, { personId, taskId, level: lvl }] }
    })

  const select = 'border border-line rounded-md bg-white px-2 py-1.5'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">People from
          <select className={select} value={peopleTeam} onChange={(e) => setPeopleTeam(e.target.value)}>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="flex items-center gap-2">Tasks of
          <select className={select} value={taskTeam} onChange={(e) => setTaskTeam(e.target.value)}>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
      </div>
      <p className="text-sm text-muted">Choose a different team for the tasks to record cross-team skills, for example a field engineer who can cover a network task.</p>
      {tasks.length === 0 || people.length === 0 ? <p className="text-muted">Choose teams that have people and tasks.</p> : (
        <div className="overflow-auto bg-white border border-line rounded-lg max-h-[28rem]">
          <table className="text-sm">
            <caption className="sr-only">Skills matrix</caption>
            <thead className="bg-paper sticky top-0">
              <tr><th scope="col" className="p-2 text-left">Person</th>{tasks.map((t) => <th key={t.id} scope="col" className="p-2 text-left min-w-36">{t.name}<br /><span className="font-normal text-muted capitalize">{t.criticality}</span></th>)}</tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <th scope="row" className="p-2 text-left font-medium whitespace-nowrap">{p.id}{p.status === 'absent' && <span className="ml-1 font-normal text-muted">(away)</span>}</th>
                  {tasks.map((t) => (
                    <td key={t.id} className="p-1">
                      <select aria-label={`${p.id} on ${t.name}`} className={select + ' w-full'} value={level(p.id, t.id)} onChange={(e) => set(p.id, t.id, Number(e.target.value) as ProficiencyLevel)}>
                        {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
