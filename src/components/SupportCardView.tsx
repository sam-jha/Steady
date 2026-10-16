import { AUDIENCE_LABELS, THEME_LABELS, type SupportCard } from '../content/support'
import BreathingTimer from './BreathingTimer'
import { Badge } from './Badges'

const TYPE_LABEL = { article: 'Article', exercise: 'Exercise', video: 'Video', tips: 'Tips' } as const

export default function SupportCardView({ card, defaultOpen = false }: { card: SupportCard; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="bg-white border border-line rounded-lg p-4 group">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone="neutral">{TYPE_LABEL[card.type]}</Badge>
          {card.minutes && <span>{card.minutes} min</span>}
          {card.audience?.map((a) => <span key={a} className="font-medium text-accent-dark">{AUDIENCE_LABELS[a]}</span>)}
        </div>
        <h3 className="mt-1 font-semibold">{card.title}</h3>
        <p className="text-sm text-muted">{card.summary}</p>
      </summary>
      <div className="mt-3 space-y-2 text-sm">
        {card.body.map((p, i) => <p key={i}>{p}</p>)}
        {card.steps && <ol className="list-decimal pl-5 space-y-1">{card.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
        {card.timerSeconds && <BreathingTimer seconds={card.timerSeconds} />}
        {card.videoUrl && (
          <p>
            <a href={card.videoUrl} target="_blank" rel="noreferrer" className="text-accent-dark underline">Open video (opens in a new tab)</a>
            {card.placeholder && <span className="ml-2"><Badge tone="warn">Placeholder link</Badge></span>}
          </p>
        )}
        <p className="text-xs text-muted">Topics: {card.themes.map((t) => THEME_LABELS[t]).join(', ')}</p>
      </div>
    </details>
  )
}
