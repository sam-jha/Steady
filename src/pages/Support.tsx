import { useState } from 'react'
import { Link } from 'react-router-dom'
import SupportCardView from '../components/SupportCardView'
import { SUPPORT_CARDS, THEME_LABELS } from '../content/support'
import type { Theme } from '../logic/pulse'

export default function Support() {
  const [theme, setTheme] = useState<Theme | 'all'>('all')
  const [audience, setAudience] = useState<'all' | 'returning' | 'colleague-of-absent'>('all')
  const cards = SUPPORT_CARDS.filter((c) => theme === 'all' || c.themes.includes(theme)).filter((c) => audience === 'all' || c.audience?.includes(audience))
  const select = 'border border-line rounded-md bg-white px-2 py-1.5 text-ink'

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Support library</h1>
        <p className="text-muted max-w-prose">Short reads, quick exercises and tips. Take what is useful. This is general information, not medical advice. If you need to talk to someone now, go to <Link to="/help" className="underline text-accent-dark">Need support now?</Link></p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">Topic
          <select className={select} value={theme} onChange={(e) => setTheme(e.target.value as Theme | 'all')}>
            <option value="all">All topics</option>
            {(Object.keys(THEME_LABELS) as Theme[]).map((t) => <option key={t} value={t}>{THEME_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">For
          <select className={select} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
            <option value="all">Everyone</option>
            <option value="returning">People returning from an absence</option>
            <option value="colleague-of-absent">Colleagues of someone who is away</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => <SupportCardView key={c.id} card={c} />)}
      </div>
      {cards.length === 0 && <p className="text-muted">Nothing matches those filters.</p>}
    </section>
  )
}
