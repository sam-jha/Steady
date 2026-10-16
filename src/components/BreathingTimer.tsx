import { useEffect, useRef, useState } from 'react'

/** A simple countdown with a text breathing cue (4 seconds in, 4 seconds out). No animation, so it is safe for everyone. */
export default function BreathingTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  const [running, setRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!running) return
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          window.clearInterval(timer.current)
          setRunning(false)
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => window.clearInterval(timer.current)
  }, [running])

  const elapsed = seconds - left
  const cue = left === 0 ? 'Well done. Notice how you feel.' : !running && elapsed === 0 ? 'Press start when you are ready.' : !running ? 'Paused.' : Math.floor(elapsed / 4) % 2 === 0 ? 'Breathe in…' : 'Breathe out…'
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const btn = 'px-4 py-2 rounded-md border border-line bg-white hover:bg-accent-soft'

  return (
    <div className="rounded-md bg-accent-soft p-4 text-center" role="group" aria-label="Breathing timer">
      <p className="text-4xl font-semibold tabular-nums" role="timer">{mm}:{ss}</p>
      <p className="my-2 text-lg" aria-live="off">{cue}</p>
      <div className="flex justify-center gap-2">
        {left > 0 && <button type="button" className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-dark" onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}</button>}
        <button type="button" className={btn} onClick={() => { setRunning(false); setLeft(seconds) }}>Reset</button>
      </div>
    </div>
  )
}
