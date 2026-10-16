import { useMemo, useState } from 'react'
import ScenarioResultView from '../components/ScenarioResultView'
import { Badge } from '../components/Badges'
import { useApp } from '../data/AppContext'
import { ABSENCE_LABELS, type AbsenceType, type Scenario, type ScenarioSelector } from '../data/schemas'
import { describeSelector, presetScenarios, runScenario } from '../logic/scenario'

type Kind = ScenarioSelector['kind']

export default function Scenarios() {
  const { data, role, teamLeadTeamId, updateData } = useApp()
  const teamScope = role === 'team-lead' ? teamLeadTeamId : null
  const presets = useMemo(() => presetScenarios(data), [data])

  // ----- the builder's form state -----
  const [name, setName] = useState('')
  const [absenceType, setAbsenceType] = useState<AbsenceType>('reserve-duty')
  const [kind, setKind] = useState<Kind>('team-percent')
  const [teamId, setTeamId] = useState<string>(teamScope ?? 'team-netops')
  const [percent, setPercent] = useState(30)
  const [worstCase, setWorstCase] = useState(false)
  const [personIds, setPersonIds] = useState<string[]>([])
  const [roleName, setRoleName] = useState('')
  const [weeks, setWeeks] = useState(8)
  const [compare, setCompare] = useState<string[]>([])

  const effectiveTeam = teamScope ?? teamId
  const selectablePeople = data.people.filter((p) => p.status === 'available' && (!teamScope || p.teamId === teamScope))
  const roles = [...new Set(data.people.filter((p) => p.status === 'available').map((p) => p.role))].sort()

  const selector: ScenarioSelector =
    kind === 'people' ? { kind, personIds } : kind === 'role' ? { kind, role: roleName || roles[0] } : { kind, teamId: effectiveTeam, percent, worstCase }
  const scenario: Scenario = { id: 'draft', name, absenceType, selector, weeks }
  const ready = kind !== 'people' || personIds.length > 0
  const result = useMemo(() => (ready ? runScenario(data, scenario) : null), [data, ready, name, absenceType, kind, effectiveTeam, percent, worstCase, personIds, roleName, weeks]) // eslint-disable-line

  const loadScenario = (s: Scenario) => {
    setName(s.name)
    setAbsenceType(s.absenceType)
    setWeeks(s.weeks)
    setKind(s.selector.kind)
    if (s.selector.kind === 'team-percent') {
      setTeamId(s.selector.teamId)
      setPercent(s.selector.percent)
      setWorstCase(s.selector.worstCase)
    } else if (s.selector.kind === 'people') setPersonIds(s.selector.personIds)
    else setRoleName(s.selector.role)
  }

  const save = () => {
    const saved: Scenario = { ...scenario, id: `saved-${Date.now()}`, name: name.trim() || `Scenario ${data.scenarios.length + 1}` }
    updateData((d) => ({ ...d, scenarios: [...d.scenarios, saved] }))
  }
  const remove = (id: string) => {
    updateData((d) => ({ ...d, scenarios: d.scenarios.filter((s) => s.id !== id) }))
    setCompare((c) => c.filter((x) => x !== id))
  }
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const comparison = compare.map((id) => data.scenarios.find((s) => s.id === id)).filter((s): s is Scenario => !!s).map((s) => runScenario(data, s))

  const field = 'border border-line rounded-md bg-white px-2 py-1.5 w-full'
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? id

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">What if…? Scenario simulator</h1>
        <p className="text-muted max-w-prose">Try out a sudden staff shortage and see what it would do to coverage, workload and burnout risk, before it happens. Nothing here changes your real data.</p>
        {teamScope && <p className="text-sm mt-1"><Badge tone="neutral">Team lead view</Badge> Results are shown for {teamName(teamScope)}. Cover suggestions may involve other teams.</p>}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Start from a preset</h2>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.id} type="button" onClick={() => loadScenario(p)} className="px-3 py-2 rounded-md border border-line bg-white hover:bg-accent-soft text-sm text-left">{p.name}</button>
          ))}
        </div>
      </div>

      <form className="bg-white border border-line rounded-lg p-4 grid gap-4 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-lg font-semibold md:col-span-2">Build your own</h2>
        <label className="text-sm">Scenario name (optional)
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter flu in Support" />
        </label>
        <label className="text-sm">Type of absence
          <select className={field} value={absenceType} onChange={(e) => setAbsenceType(e.target.value as AbsenceType)}>
            {(Object.keys(ABSENCE_LABELS) as AbsenceType[]).map((t) => <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="text-sm">How long (weeks)
          <input className={field} type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
        </label>
        <fieldset className="text-sm">
          <legend>Who is affected?</legend>
          <div className="flex flex-wrap gap-4 mt-1">
            {([['team-percent', 'A % of a team'], ['people', 'Specific people'], ...(teamScope ? [] : [['role', 'A role']])] as Array<[Kind, string]>).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} /> {label}</label>
            ))}
          </div>
        </fieldset>

        {kind === 'team-percent' && (
          <>
            <label className="text-sm">Team
              <select className={field} value={effectiveTeam} disabled={!!teamScope} onChange={(e) => setTeamId(e.target.value)}>
                {!teamScope && <option value="all">All teams</option>}
                {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Share of available people: <span className="font-medium">{percent}%</span>
              <input className="w-full" type="range" min={5} max={100} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </label>
            <label className="text-sm flex items-start gap-2 md:col-span-2"><input type="checkbox" className="mt-1" checked={worstCase} onChange={(e) => setWorstCase(e.target.checked)} />
              <span>Worst case: assume the people hardest to replace are the ones affected. (Otherwise people are picked evenly across the team.)</span></label>
          </>
        )}
        {kind === 'role' && (
          <label className="text-sm">Role
            <select className={field} value={roleName || roles[0]} onChange={(e) => setRoleName(e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
        )}
        {kind === 'people' && (
          <fieldset className="text-sm md:col-span-2">
            <legend>Choose people ({personIds.length} selected)</legend>
            <div className="mt-1 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1 border border-line rounded-md p-2">
              {selectablePeople.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={personIds.includes(p.id)} onChange={() => setPersonIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))} /> {p.id}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="md:col-span-2">
          <button type="button" onClick={save} disabled={!ready} className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-dark disabled:opacity-50">Save this scenario</button>
        </div>
      </form>

      {result ? <ScenarioResultView data={data} result={result} teamScope={teamScope} /> : <p className="text-muted">Choose at least one person to see the result.</p>}

      <div>
        <h2 className="text-lg font-semibold mb-2">Saved scenarios</h2>
        {data.scenarios.length === 0 ? <p className="text-muted text-sm">None yet. Save a scenario above, then tick two or more to compare them.</p> : (
          <ul className="bg-white border border-line rounded-lg divide-y divide-line">
            {data.scenarios.map((s) => (
              <li key={s.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2 flex-1 min-w-48"><input type="checkbox" checked={compare.includes(s.id)} onChange={() => toggleCompare(s.id)} />
                  <span><span className="font-medium">{s.name}</span><br /><span className="text-muted">{describeSelector(data, s.selector)} · {s.weeks} wk</span></span></label>
                <button type="button" onClick={() => loadScenario(s)} className="px-2 py-1 border border-line rounded hover:bg-accent-soft">Open</button>
                <button type="button" onClick={() => remove(s.id)} className="px-2 py-1 border border-line rounded hover:bg-red-50">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {comparison.length >= 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Comparing saved scenarios</h2>
          <div className="overflow-x-auto bg-white border border-line rounded-lg">
            <table className="w-full text-sm">
              <caption className="sr-only">Side-by-side comparison of saved scenarios</caption>
              <thead className="text-left bg-paper"><tr><th scope="col" className="p-2">Measure</th>{comparison.map((r) => <th scope="col" key={r.scenario.id} className="p-2">{r.scenario.name}</th>)}</tr></thead>
              <tbody>
                {([
                  ['People affected', (r) => String(r.affectedIds.length)],
                  ['Weeks', (r) => String(r.scenario.weeks)],
                  ['Resilience score (now → during)', (r) => `${r.before.score} → ${r.after.score}`],
                  ['New single points of failure', (r) => String(r.tasks.filter((t) => t.isNewSpof).length)],
                  ['Teams overloaded (load > 1.0)', (r) => String(r.teams.filter((t) => t.loadAfter.band === 'overloaded').length)],
                  ['Teams with burnout risk rising', (r) => String(r.teams.filter((t) => t.burnout.outcome === 'raised').length)],
                  ['Teams critical (already High + overloaded)', (r) => String(r.teams.filter((t) => t.burnout.outcome === 'critical').length)],
                ] as Array<[string, (r: (typeof comparison)[number]) => string]>).map(([label, fn]) => (
                  <tr key={label} className="border-t border-line"><th scope="row" className="p-2 text-left font-medium">{label}</th>{comparison.map((r) => <td key={r.scenario.id} className="p-2">{fn(r)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
