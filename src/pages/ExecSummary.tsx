import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../components/Badges'
import ScoreCard from '../components/ScoreCard'
import { useApp } from '../data/AppContext'
import { Link } from 'react-router-dom'
import { generateRecommendations, topDoNow } from '../logic/recommend'
import { orgMetrics, orgWellbeingTrend } from '../logic/resilienceScore'
import { topRisks } from '../logic/risks'

export default function ExecSummary() {
  const { data } = useApp()
  const org = orgMetrics(data)
  const risks = topRisks(data, 3)
  const doNow = topDoNow(generateRecommendations(data), 3)
  const trend = orgWellbeingTrend(data).map((p) => ({ week: p.period.slice(5), wellbeing: p.wellbeing }))
  const first = trend.find((p) => p.wellbeing !== null)?.wellbeing
  const last = [...trend].reverse().find((p) => p.wellbeing !== null)?.wellbeing
  const delta = first != null && last != null ? last - first : null

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Executive summary</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard title="Overall resilience" score={org.score} parts={org.parts} />
        <div className="bg-white border border-line rounded-lg p-4">
          <h2 className="text-sm text-muted">Workforce wellbeing trend (anonymous, all teams with enough responses)</h2>
          {delta !== null && (
            <p className="mt-1">
              <span className="text-2xl font-semibold">{last}</span> <span className="text-muted">/ 100 now</span>{' '}
              <Badge tone={delta < -5 ? 'bad' : delta > 5 ? 'good' : 'neutral'}>
                {delta < -5 ? '▼ Falling' : delta > 5 ? '▲ Improving' : 'Steady'} ({delta > 0 ? '+' : ''}{delta} over {trend.length} weeks)
              </Badge>
            </p>
          )}
          <div className="h-36 mt-2" role="img" aria-label={delta !== null ? `Wellbeing went from ${first} to ${last} out of 100 over ${trend.length} weeks.` : 'No visible wellbeing data.'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e5eaed" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="wellbeing" name="Wellbeing" stroke="#1f6b6f" strokeWidth={2.5} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted">Higher is better (100 minus average burnout score).</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Top 3 risks</h2>
        {risks.length === 0 ? (
          <p className="text-muted">No significant risks found.</p>
        ) : (
          <ol className="space-y-2">
            {risks.map((r, i) => (
              <li key={r.id} className="bg-white border border-line rounded-lg p-3 flex gap-3">
                <span className="font-semibold text-accent-dark" aria-hidden="true">{i + 1}.</span>
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted">{r.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Top 3 “Do now” actions</h2>
        {doNow.length === 0 ? (
          <p className="text-muted">No open “Do now” actions.</p>
        ) : (
          <ol className="space-y-2">
            {doNow.map((r, i) => (
              <li key={r.key} className="bg-white border border-line rounded-lg p-3 flex gap-3">
                <span className="font-semibold text-accent-dark" aria-hidden="true">{i + 1}.</span>
                <div>
                  <p className="font-medium">{r.rule.title}</p>
                  <p className="text-sm text-muted">{r.finding.subject} · {r.finding.evidence[0]}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-sm"><Link to="/recommendations" className="text-accent-dark underline">See all recommendations</Link></p>
      </div>
    </section>
  )
}
