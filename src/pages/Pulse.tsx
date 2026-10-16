import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, BandBadge } from '../components/Badges'
import SupportCardView from '../components/SupportCardView'
import { AGREEMENT_OPTIONS, CBI_WORK_ITEMS, FREQUENCY_OPTIONS, JDR_ITEMS, PULSE_INTRO, type ScaleOption } from '../content/pulseItems'
import { SUPPORT_CARDS } from '../content/support'
import { useApp } from '../data/AppContext'
import { matchSupport, scorePulse, themesFor, type PulseScores } from '../logic/pulse'
import type { BurnoutBand } from '../logic/wellbeing'

const MY_RESULTS_KEY = 'steady.myPulseResults.v1'
interface MyResult { date: string; band: BurnoutBand; score: number }

const readMine = (): MyResult[] => {
  try { return JSON.parse(localStorage.getItem(MY_RESULTS_KEY) ?? '[]') as MyResult[] } catch { return [] }
}
const writeMine = (rows: MyResult[]) => { try { localStorage.setItem(MY_RESULTS_KEY, JSON.stringify(rows)) } catch { /* storage unavailable: that's fine */ } }

const MESSAGES: Record<BurnoutBand, string> = {
  low: 'Your answers suggest work is feeling manageable at the moment. That is good to hear. It is worth noticing what is helping and keeping hold of it.',
  moderate: 'Your answers suggest work is taking quite a lot out of you right now. That is common when a team is stretched, and it is a good moment to look after yourself and, if you can, talk to your manager about workload.',
  high: 'Your answers suggest work is taking a lot out of you right now. This says more about how much is being asked than about you. Please consider talking to someone you trust or your manager, and use the support below. If things feel hard, “Need support now?” is always there.',
}

function Question({ id, text, options, value, onChange }: { id: string; text: string; options: ScaleOption[]; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <fieldset className="bg-white border border-line rounded-lg p-4">
      <legend className="font-medium px-1">{text}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {options.map((o) => (
          <label key={o.value} className={`flex items-center gap-2 rounded-md border px-3 py-3 cursor-pointer text-sm ${value === o.value ? 'border-accent bg-accent-soft font-medium' : 'border-line'}`}>
            <input type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function Pulse() {
  const { data, updateData } = useApp()
  const [teamId, setTeamId] = useState(data.teams[0].id)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<PulseScores | null>(null)
  const [keep, setKeep] = useState(false)
  const [mine, setMine] = useState<MyResult[]>(readMine)
  const [error, setError] = useState('')

  const answered = Object.keys(answers).length
  const total = CBI_WORK_ITEMS.length + JDR_ITEMS.length

  const submit = () => {
    const scores = scorePulse(answers)
    if (!scores) { setError('Please answer every question. A few are still empty.'); return }
    setError('')
    // The stored response has no name or person id: only team, date and scores.
    updateData((d) => ({
      ...d,
      pulses: [...d.pulses, { id: `pulse-${Date.now()}`, teamId, timestamp: new Date().toISOString().slice(0, 10), burnoutScore: scores.burnoutScore, demandsScore: scores.demandsScore, resourcesScore: scores.resourcesScore }],
    }))
    if (keep) {
      const next = [...mine, { date: new Date().toISOString().slice(0, 10), band: scores.band, score: scores.burnoutScore }]
      writeMine(next)
      setMine(next)
    }
    setResult(scores)
    window.scrollTo({ top: 0 })
  }

  if (result) {
    const suggestions = matchSupport(SUPPORT_CARDS, result.band, themesFor(result), 3)
    return (
      <section className="space-y-5 max-w-3xl">
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <div className="bg-white border border-line rounded-lg p-4 space-y-2">
          <p>Your result, visible only to you: <BandBadge band={result.band} /> <span className="text-muted">({result.burnoutScore}/100)</span></p>
          <p>{MESSAGES[result.band]}</p>
          <p className="text-sm text-muted">{PULSE_INTRO.notClinical} The bands are indicative and are not a diagnosis.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Some things that might help</h2>
          <div className="grid gap-3">{suggestions.map((c) => <SupportCardView key={c.id} card={c} />)}</div>
          <p className="mt-2 text-sm"><Link to="/support" className="underline text-accent-dark">Browse the whole support library</Link> · <Link to="/help" className="underline text-accent-dark">Need support now?</Link></p>
        </div>
        <p className="text-sm text-muted">Your team’s average will be included in team results, but only once at least 5 colleagues have answered, and nobody can see your individual answers.</p>
        <button type="button" onClick={() => { setResult(null); setAnswers({}) }} className="px-4 py-2 rounded-md border border-line bg-white hover:bg-accent-soft">Done</button>
      </section>
    )
  }

  return (
    <section className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{PULSE_INTRO.title}</h1>
        <p className="text-muted">About {PULSE_INTRO.minutes} minutes. Please answer about the last two weeks.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 text-sm space-y-2">
        <p><span className="font-medium">Not a clinical tool. </span>{PULSE_INTRO.notClinical}</p>
        <p><span className="font-medium">Anonymous. </span>{PULSE_INTRO.privacy}</p>
        <p>Need to talk to someone now? <Link to="/help" className="underline text-accent-dark font-medium">Need support now?</Link></p>
      </div>

      <label className="text-sm flex flex-wrap items-center gap-2">Your team (in this demo you choose it; a real deployment would know it)
        <select className="border border-line rounded-md bg-white px-2 py-1.5" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>

      <h2 className="text-lg font-semibold">About your work</h2>
      <p className="text-sm text-muted">Based on the work-related burnout questions of the Copenhagen Burnout Inventory (Kristensen et al., 2005). Wording still to be checked against the original paper.</p>
      {CBI_WORK_ITEMS.map((i) => <Question key={i.id} id={i.id} text={i.text} options={FREQUENCY_OPTIONS} value={answers[i.id]} onChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v }))} />)}

      <h2 className="text-lg font-semibold">About your situation right now</h2>
      <p className="text-sm text-muted"><Badge tone="neutral">Our own questions, not a validated scale</Badge> These help show what is behind the numbers.</p>
      {JDR_ITEMS.map((i) => <Question key={i.id} id={i.id} text={i.text} options={AGREEMENT_OPTIONS} value={answers[i.id]} onChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v }))} />)}

      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my result on this device only, so I can see how it changes over time. (Never sent anywhere.)</label>

      {error && <p role="alert" className="text-red-900 font-medium">⚠ {error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} className="px-5 py-3 rounded-md bg-accent text-white hover:bg-accent-dark font-medium">Submit</button>
        <span className="text-sm text-muted">{answered} of {total} answered</span>
      </div>

      {mine.length > 0 && (
        <div className="bg-white border border-line rounded-lg p-4">
          <h2 className="font-semibold">Your results on this device</h2>
          <ul className="text-sm mt-1">{mine.slice(-6).reverse().map((m, i) => <li key={i}>{m.date}: <BandBadge band={m.band} /> ({m.score}/100)</li>)}</ul>
          <button type="button" className="mt-2 text-sm underline text-accent-dark" onClick={() => { writeMine([]); setMine([]) }}>Delete my saved results</button>
        </div>
      )}
    </section>
  )
}
