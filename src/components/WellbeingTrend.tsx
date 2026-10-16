import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BURNOUT_THRESHOLDS } from '../config'
import type { PeriodResult } from '../logic/wellbeing'

/** Team burnout-risk trend. Weeks below the anonymity threshold are gaps, never numbers. */
export default function WellbeingTrend({ trend }: { trend: PeriodResult[] }) {
  const points = trend.map((p) => ({ period: p.period.slice(5), burnout: p.hidden ? null : p.meanScore }))
  const shown = points.filter((p) => p.burnout !== null).length
  if (shown === 0) return null
  return (
    <div>
      <div className="h-56" role="img" aria-label={`Burnout risk trend over ${points.length} weeks. Latest value ${points.filter((p) => p.burnout !== null).at(-1)?.burnout} out of 100.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e5eaed" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <ReferenceLine y={BURNOUT_THRESHOLDS.moderateFrom} stroke="#8a6d00" strokeDasharray="4 4" label={{ value: 'Moderate', position: 'right', fontSize: 11 }} />
            <ReferenceLine y={BURNOUT_THRESHOLDS.highFrom} stroke="#a32020" strokeDasharray="4 4" label={{ value: 'High', position: 'right', fontSize: 11 }} />
            <Line type="monotone" dataKey="burnout" name="Burnout score" stroke="#1f6b6f" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted">Weekly team averages (0–100, higher means more burnout risk). Dashed lines mark the Moderate and High cut-offs.</p>
    </div>
  )
}
