import { useMemo, useState } from 'react'
import RecommendationCard from '../components/RecommendationCard'
import { useApp } from '../data/AppContext'
import type { RecommendationStatus } from '../data/schemas'
import { generateRecommendations, HORIZON_ORDER } from '../logic/recommend'
import type { Pillar } from '../rules/recommendations'

const HORIZON_HELP: Record<string, string> = {
  'Do now': 'Quick, low-effort actions that are realistic while people have no spare time.',
  'Do next (30–90 days)': 'Needs some planning and time. Start once the immediate pressure has eased.',
  'Build long-term': 'Lasting structures that make the next shortage easier. These cannot be rolled out in full while a team is stretched.',
}

export default function Recommendations() {
  const { data, role, teamLeadTeamId, updateData } = useApp()
  const [pillar, setPillar] = useState<Pillar | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [showClosed, setShowClosed] = useState(false)

  const all = useMemo(() => generateRecommendations(data), [data])
  // Team leads see only their own team's items. HR can narrow to one team (organisation-wide items then hide).
  const scopeTeam = role === 'team-lead' ? teamLeadTeamId : teamFilter === 'all' ? null : teamFilter
  const visible = all
    .filter((r) => !scopeTeam || r.finding.teamId === scopeTeam)
    .filter((r) => pillar === 'all' || r.rule.pillar === pillar)
  const open = visible.filter((r) => showClosed || (r.status !== 'done' && r.status !== 'not-relevant'))
  const hiddenCount = visible.length - open.length

  const setStatus = (key: string, status: RecommendationStatus | null) =>
    updateData((d) => {
      const next = { ...d.recommendationStatus }
      if (status) next[key] = status
      else delete next[key]
      return { ...d, recommendationStatus: next }
    })

  const select = 'border border-line rounded-md bg-white px-2 py-1.5 text-ink'
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <p className="text-muted max-w-prose">
          Plain rules, no AI. Each recommendation shows the exact data that triggered it, and they apply to teams, tasks and policies, never to individuals’ wellbeing. They are grouped by when they are realistic to do.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">Area
          <select className={select} value={pillar} onChange={(e) => setPillar(e.target.value as Pillar | 'all')}>
            <option value="all">All three pillars</option>
            <option>Crisis preparedness</option><option>Workforce adaptability</option><option>Wellbeing</option>
          </select>
        </label>
        {role === 'hr' && (
          <label className="flex items-center gap-2">Team
            <select className={select} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">Whole organisation</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show done and not relevant{hiddenCount > 0 && !showClosed ? ` (${hiddenCount} hidden)` : ''}</label>
      </div>

      {HORIZON_ORDER.map((h) => {
        const items = open.filter((r) => r.rule.horizon === h)
        return (
          <div key={h} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">{h} <span className="text-base font-normal text-muted">({items.length})</span></h2>
              <p className="text-sm text-muted">{HORIZON_HELP[h]}</p>
            </div>
            {items.length === 0 ? <p className="text-sm text-muted">Nothing triggered here right now.</p> : items.map((r) => <RecommendationCard key={r.key} rec={r} onStatus={setStatus} />)}
          </div>
        )
      })}
    </section>
  )
}
