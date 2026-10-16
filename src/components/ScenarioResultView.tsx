import { useState } from 'react'
import { BURNOUT_RISK_RULES, type BurnoutProjection } from '../rules/burnoutRiskRules'
import type { OrgData } from '../data/schemas'
import { ABSENCE_LABELS } from '../data/schemas'
import { LOAD_STRETCHED_MAX } from '../config'
import { describeSelector, type ScenarioResult } from '../logic/scenario'
import { scoreLabel } from '../logic/resilienceScore'
import { BandBadge, Badge, CoverageBadge, HiddenBadge, LoadBadge } from './Badges'

const LEVEL_TEXT = { 1: 'can do with supervision', 2: 'competent', 3: 'can train others' } as const

function Projection({ p }: { p: BurnoutProjection }) {
  const to = p.projected ? ` to ${p.projected}` : ''
  switch (p.outcome) {
    case 'critical': return <Badge tone="bad">Critical: already High and overloaded</Badge>
    case 'raised': return <Badge tone="bad">Risk likely to rise{to}</Badge>
    case 'watch': return <Badge tone="warn">Watch: short overload</Badge>
    default: return <Badge tone="good">No change expected</Badge>
  }
}

/** Shows one scenario run. `teamScope` limits the view to one team (used for the Team lead role). */
export default function ScenarioResultView({ data, result, teamScope }: { data: OrgData; result: ScenarioResult; teamScope: string | null }) {
  const [showAll, setShowAll] = useState(false)
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? id
  const inScope = (teamId: string) => !teamScope || teamId === teamScope

  const taskRows = result.tasks.filter((t) => inScope(t.task.teamId)).filter((t) => showAll || t.after.count !== t.before.count)
  const teams = result.teams.filter((t) => inScope(t.teamId))
  const gaps = result.gaps.filter((g) => inScope(g.task.teamId))
  const newSpofs = result.tasks.filter((t) => t.isNewSpof && inScope(t.task.teamId))
  const delta = result.after.score - result.before.score
  const { scenario } = result

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status">Scenario updated: organisation resilience {result.before.score} to {result.after.score}, {newSpofs.length} new single points of failure.</p>
      <div className="bg-white border border-line rounded-lg p-4">
        <h2 className="text-lg font-semibold">{scenario.name || 'Your scenario'}</h2>
        <p className="text-sm text-muted">
          {ABSENCE_LABELS[scenario.absenceType]} · {describeSelector(data, scenario.selector)} · {scenario.weeks} week{scenario.weeks === 1 ? '' : 's'} · {result.affectedIds.length} people affected
        </p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span>Organisation resilience: <span className="text-2xl font-semibold">{result.before.score}</span> <span aria-hidden="true">→</span><span className="sr-only"> changes to </span> <span className="text-2xl font-semibold">{result.after.score}</span>{' '}
            <Badge tone={delta === 0 ? 'neutral' : delta > -10 ? 'warn' : 'bad'}>{delta === 0 ? 'No change' : `${delta} points`} · {scoreLabel(result.after.score)}</Badge></span>
          <span>New single points of failure: <span className="font-semibold">{newSpofs.length}</span></span>
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold">Coverage: before vs during</h3>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show unchanged tasks too</label>
        </div>
        {taskRows.length === 0 ? <p className="text-muted text-sm">No task loses any competent cover in this scenario.</p> : (
          <div className="overflow-x-auto bg-white border border-line rounded-lg">
            <table className="w-full text-sm">
              <caption className="sr-only">Coverage per task before and during the scenario</caption>
              <thead className="text-left bg-paper"><tr>
                <th scope="col" className="p-2">Task</th><th scope="col" className="p-2">Team</th>
                <th scope="col" className="p-2">Before</th><th scope="col" className="p-2">During</th>
              </tr></thead>
              <tbody>
                {taskRows.map((t) => (
                  <tr key={t.task.id} className="border-t border-line">
                    <th scope="row" className="p-2 text-left font-medium">{t.task.name} <span className="font-normal text-muted capitalize">({t.task.criticality})</span></th>
                    <td className="p-2">{teamName(t.task.teamId)}</td>
                    <td className="p-2">{t.before.count} <CoverageBadge status={t.before.status} count={t.before.count} /></td>
                    <td className="p-2">{t.after.count} <CoverageBadge status={t.after.status} count={t.after.count} />{t.isNewSpof && <span className="ml-1 font-medium text-red-900">New</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Load and projected burnout risk, per team</h3>
        <div className="overflow-x-auto bg-white border border-line rounded-lg">
          <table className="w-full text-sm">
            <caption className="sr-only">Load ratio and burnout projection per team</caption>
            <thead className="text-left bg-paper"><tr>
              <th scope="col" className="p-2">Team</th><th scope="col" className="p-2">Load before</th><th scope="col" className="p-2">Load during</th>
              <th scope="col" className="p-2">Burnout risk now</th><th scope="col" className="p-2">Projection</th>
            </tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.teamId} className="border-t border-line align-top">
                  <th scope="row" className="p-2 text-left font-medium">{teamName(t.teamId)}</th>
                  <td className="p-2">{t.loadBefore.ratio.toFixed(2)} <LoadBadge band={t.loadBefore.band} /></td>
                  <td className="p-2">{t.loadAfter.ratio === Infinity ? '∞' : t.loadAfter.ratio.toFixed(2)} <LoadBadge band={t.loadAfter.band} /></td>
                  <td className="p-2">{t.burnout.baseline ? <BandBadge band={t.burnout.baseline} /> : <HiddenBadge />}</td>
                  <td className="p-2"><Projection p={t.burnout} /><p className="text-xs text-muted mt-1 max-w-xs">{t.burnout.explanation}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-accent-dark underline">How are projections made?</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1 max-w-prose">
            {BURNOUT_RISK_RULES.map((r) => <li key={r.id}>{r.text}</li>)}
          </ul>
          <p className="mt-2 text-muted max-w-prose">These are simple, indicative rules based on the Job Demands–Resources model (Bakker & Demerouti, 2007). They are not clinical predictions. The full list is in src/rules/burnoutRiskRules.ts.</p>
        </details>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-1">Who could cover each gap?</h3>
        <p className="text-sm text-muted max-w-prose mb-3">
          Suggestions are about tasks, not individuals’ wellbeing. They list available people with some skill on the task, ranked by proficiency and then by how much room their team has. Hours that were lost are assumed to be shared between the top few. If that would push a team above a load ratio of {LOAD_STRETCHED_MAX.toFixed(1)}, you’ll see a warning: cover should not just move burnout from one team to another.
        </p>
        {gaps.length === 0 ? <p className="text-muted text-sm">No gaps need cover in this scenario.</p> : (
          <div className="space-y-3">
            {gaps.map((g) => (
              <div key={g.task.id} className="bg-white border border-line rounded-lg p-3">
                <p className="font-medium">{g.task.name} <span className="font-normal text-muted">· {teamName(g.task.teamId)} · {g.task.criticality}</span></p>
                <p className="text-sm text-muted">{g.lostCompetent} competent {g.lostCompetent === 1 ? 'person' : 'people'} lost, {g.afterCount} left. About {Math.round(g.hoursAtStake)} hours a week need covering.</p>
                {g.candidates.length === 0 ? (
                  <p className="text-sm mt-2"><Badge tone="bad">No one available has any skill on this task</Badge> Consider an external or temporary resource.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line">
                    {g.candidates.map((c) => (
                      <li key={c.personId} className="py-1.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium">{c.personId}</span>
                        <span>{teamName(c.teamId)}{c.sameTeam ? '' : ' (another team)'}</span>
                        <span className="text-muted">level {c.level}: {LEVEL_TEXT[c.level]}</span>
                        <span className="text-muted">team load would be {c.teamRatioIfTaken.toFixed(2)}</span>
                        {c.overloadWarning && <Badge tone="bad">Would overload {c.sameTeam ? 'the team further' : 'their team'}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
