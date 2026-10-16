import { useId, useState } from 'react'
import type { Explanation } from '../content/explanations'

/** A small "How is this calculated?" button that opens a plain-English explanation panel. */
export default function HowCalculated({ info }: { info: Explanation }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <span className="inline-block align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-accent-dark underline underline-offset-2 hover:text-accent"
      >
        How is this calculated?
      </button>
      {open && (
        <div id={panelId} role="region" aria-label={info.title} className="mt-2 max-w-prose rounded-md border border-line bg-white p-3 text-sm text-ink shadow-sm font-normal">
          <p className="font-semibold mb-1">{info.title}</p>
          {info.body.map((p, i) => (
            <p key={i} className="mb-1.5">{p}</p>
          ))}
          <p className="text-muted"><span className="font-medium">Theory: </span>{info.theory}</p>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs underline text-accent-dark">Close</button>
        </div>
      )}
    </span>
  )
}
