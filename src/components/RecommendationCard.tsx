import { STATUS_LABELS, type RecommendationStatus } from '../data/schemas'
import type { Recommendation } from '../logic/recommend'
import { Badge } from './Badges'

const LEVEL_TEXT = { low: 'Low', med: 'Medium', high: 'High' } as const

export default function RecommendationCard({ rec, onStatus }: { rec: Recommendation; onStatus: (key: string, status: RecommendationStatus | null) => void }) {
  const { rule, finding } = rec
  const closed = rec.status === 'done' || rec.status === 'not-relevant'
  const selectId = `status-${rec.key}`
  return (
    <article className={`bg-white border border-line rounded-lg p-4 space-y-2 ${closed ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{rule.title}</h3>
          <p className="text-sm text-muted">{finding.subject} · {rule.pillar}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={selectId} className="text-muted">Status</label>
          <select id={selectId} value={rec.status ?? ''} onChange={(e) => onStatus(rec.key, (e.target.value || null) as RecommendationStatus | null)} className="border border-line rounded-md bg-white px-2 py-1">
            <option value="">Not started</option>
            {(Object.keys(STATUS_LABELS) as RecommendationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-md bg-accent-soft p-2 text-sm">
        <p className="font-medium">Triggered because:</p>
        <ul className="list-disc pl-5">{finding.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>

      {finding.involve && finding.involve.length > 0 && (
        <div className="rounded-md border border-line bg-paper p-2 text-sm">
          <p className="font-medium">Who to involve:</p>
          <ul className="list-disc pl-5">{finding.involve.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {rec.overloadWarning && (
        <div role="note" className="rounded-md border border-amber-400 bg-amber-100 text-amber-950 p-2 text-sm">
          <span aria-hidden="true">▲ </span><span className="font-medium">Careful: this team is already overloaded.</span> {rec.overloadWarning}
        </div>
      )}

      <p className="text-sm"><span className="font-medium">What to do: </span>{rule.action}</p>
      <p className="text-sm"><span className="font-medium">Why: </span>{rule.why}</p>
      <p className="text-sm text-muted"><span className="font-medium">Theory: </span>{rule.theory}</p>
      <p className="flex gap-2 text-xs">
        <Badge tone="neutral">Effort: {LEVEL_TEXT[rule.effort]}</Badge>
        <Badge tone="neutral">Impact: {LEVEL_TEXT[rule.impact]}</Badge>
      </p>
    </article>
  )
}
