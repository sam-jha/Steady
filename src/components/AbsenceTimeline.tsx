import { useState } from 'react'
import type { Absence, OrgData } from '../data/schemas'
import { ABSENCE_LABELS } from '../data/schemas'
import { taskCoverage } from '../logic/coverage'

const DAY = 86400000
const WINDOW_DAYS = 140 // 20 weeks ahead

/** Bars for current and upcoming absences over the next 20 weeks. */
export default function AbsenceTimeline({ data, absences }: { data: OrgData; absences: Absence[] }) {
  const [today] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const startMs = today.getTime() - 14 * DAY
  const totalMs = (WINDOW_DAYS + 14) * DAY
  const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - startMs) / totalMs) * 100))

  const rows = absences
    .map((a) => ({ a, from: new Date(a.start).getTime(), to: a.end ? new Date(a.end).getTime() : null }))
    .filter((r) => r.to === null || r.to >= startMs)
    .sort((x, y) => x.from - y.from)

  if (rows.length === 0) return <p className="text-muted text-sm">No current or upcoming absences.</p>
  const todayPct = pos(today.getTime())

  return (
    <ul className="space-y-2" aria-label="Absence timeline">
      {rows.map(({ a, from, to }) => {
        const left = pos(from)
        const right = to === null ? 100 : pos(to)
        const tasksLeft = data.skills
          .filter((s) => s.personId === a.personId && s.level >= 2)
          .map((s) => data.tasks.find((k) => k.id === s.taskId))
          .filter((k): k is NonNullable<typeof k> => !!k && k.criticality !== 'deferrable')
          .map((k) => `${k.name} (${taskCoverage(data, k).count} competent left)`)
        const team = data.teams.find((t) => t.id === data.people.find((p) => p.id === a.personId)?.teamId)
        return (
          <li key={a.id} className="text-sm">
            <div className="flex flex-wrap justify-between gap-x-3">
              <span><span className="font-medium">{a.personId}</span> · {team?.name} · {ABSENCE_LABELS[a.type]}</span>
              <span className="text-muted">
                {a.start} → {a.end ?? 'end unknown'} · {a.certainty}
              </span>
            </div>
            {tasksLeft.length > 0 && <p className="text-xs text-muted">Tasks without them: {tasksLeft.join(', ')}</p>}
            <div className="relative h-3 bg-paper rounded border border-line mt-1" aria-hidden="true">
              <div className="absolute top-0 bottom-0 border-l-2 border-ink/50" style={{ left: `${todayPct}%` }} />
              <div
                className={`absolute top-0 bottom-0 rounded bg-accent ${a.certainty === 'confirmed' ? '' : 'opacity-60 border border-dashed border-white'}`}
                style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
              />
            </div>
          </li>
        )
      })}
      <li className="text-xs text-muted">Vertical line = today. Solid bar = confirmed; faded dashed bar = likely or possible. Window shows the next 20 weeks.</li>
    </ul>
  )
}
