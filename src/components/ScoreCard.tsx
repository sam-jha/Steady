import { EXPLANATIONS } from '../content/explanations'
import { scoreLabel } from '../logic/resilienceScore'
import { Badge } from './Badges'
import HowCalculated from './HowCalculated'

export default function ScoreCard({ title, score, parts }: {
  title: string
  score: number
  parts: { coverage: number; load: number; wellbeing: number | null }
}) {
  const label = scoreLabel(score)
  const tone = label === 'Strong' ? 'good' : label === 'Fair' ? 'warn' : 'bad'
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <h2 className="text-sm text-muted">{title}</h2>
      <p className="mt-1 flex items-baseline gap-3">
        <span className="text-5xl font-semibold" aria-label={`Resilience score ${score} out of 100`}>{score}</span>
        <span className="text-muted">/ 100</span>
        <Badge tone={tone}>{label}</Badge>
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-muted">Coverage</dt><dd className="font-medium">{parts.coverage}</dd></div>
        <div><dt className="text-muted">Load</dt><dd className="font-medium">{parts.load}</dd></div>
        <div><dt className="text-muted">Wellbeing</dt><dd className="font-medium">{parts.wellbeing ?? 'Hidden'}</dd></div>
      </dl>
      <div className="mt-2"><HowCalculated info={EXPLANATIONS.resilience} /></div>
    </div>
  )
}
