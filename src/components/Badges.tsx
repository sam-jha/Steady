// Status badges. Colour is never the only signal: every badge has an icon and a text label.
import type { CoverageStatus } from '../logic/coverage'
import type { LoadBand } from '../logic/load'
import type { BurnoutBand } from '../logic/wellbeing'

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-green-100 text-green-900 border-green-300',
  warn: 'bg-amber-100 text-amber-950 border-amber-400',
  bad: 'bg-red-100 text-red-900 border-red-300',
  neutral: 'bg-slate-100 text-slate-800 border-slate-300',
}
const ICON: Record<Tone, string> = { good: '✓', warn: '▲', bad: '⚠', neutral: '–' }

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true">{ICON[tone]}</span>
      {children}
    </span>
  )
}

export const CoverageBadge = ({ status, count }: { status: CoverageStatus; count: number }) =>
  status === 'single-point-of-failure' ? (
    <Badge tone="bad">{count === 0 ? 'No cover' : 'Single point of failure'}</Badge>
  ) : status === 'thin' ? (
    <Badge tone="warn">Thin cover</Badge>
  ) : (
    <Badge tone="good">Well covered</Badge>
  )

export const LoadBadge = ({ band }: { band: LoadBand }) =>
  band === 'overloaded' ? <Badge tone="bad">Overloaded</Badge> : band === 'stretched' ? <Badge tone="warn">Stretched</Badge> : <Badge tone="good">Healthy</Badge>

export const BandBadge = ({ band }: { band: BurnoutBand }) =>
  band === 'high' ? <Badge tone="bad">High risk</Badge> : band === 'moderate' ? <Badge tone="warn">Moderate risk</Badge> : <Badge tone="good">Low risk</Badge>

export const HiddenBadge = () => <Badge tone="neutral">Not enough responses</Badge>
