import { useState } from 'react'
import { Badge } from '../components/Badges'
import { DEFAULT_COUNTRY, HELPLINES } from '../content/helplines'

export default function Help() {
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const help = HELPLINES[country]
  return (
    <section className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-semibold">Need support now?</h1>
      <p>If you are finding things hard, you do not have to manage on your own. These services are free to contact and are there to listen.</p>
      <p className="rounded-md border border-red-300 bg-red-50 p-3 font-medium text-red-950"><span aria-hidden="true">⚠ </span>{help.emergency}</p>

      <label className="text-sm flex items-center gap-2">Country
        <select className="border border-line rounded-md bg-white px-2 py-1.5" value={country} onChange={(e) => setCountry(e.target.value)}>
          {Object.entries(HELPLINES).map(([code, h]) => <option key={code} value={code}>{h.label}</option>)}
        </select>
      </label>

      <ul className="space-y-3">
        {help.lines.map((l) => (
          <li key={l.name} className="bg-white border border-line rounded-lg p-4">
            <p className="font-semibold">{l.name} {l.placeholder && <Badge tone="warn">Placeholder: to be completed</Badge>}</p>
            <p className="text-xl">{l.contact}</p>
            <p className="text-sm text-muted">{l.detail}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Numbers and opening hours can change, so please check them locally. Steady is not a clinical service and cannot respond to messages. You can also talk to your GP or doctor, a trusted friend or family member, or your manager or HR.</p>
    </section>
  )
}
