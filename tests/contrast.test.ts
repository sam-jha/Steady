import { describe, expect, it } from 'vitest'

// WCAG 2 contrast ratio between two hex colours. Body text needs 4.5:1; large text and graphics 3:1.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

// Colours from src/index.css and the Tailwind palette classes the app uses.
const WHITE = '#ffffff', PAPER = '#f6f8f9', INK = '#1c2b33', MUTED = '#52616b', ACCENT = '#1f6b6f', ACCENT_DARK = '#164e51', ACCENT_SOFT = '#e3f1f1'

const TEXT_PAIRS: Array<[string, string, string]> = [
  ['body text on white', INK, WHITE],
  ['body text on page background', INK, PAPER],
  ['muted text on white', MUTED, WHITE],
  ['muted text on page background', MUTED, PAPER],
  ['muted text on accent-soft', MUTED, ACCENT_SOFT],
  ['white on accent (buttons, active nav)', WHITE, ACCENT],
  ['white on accent-dark (hover)', WHITE, ACCENT_DARK],
  ['accent-dark links on white', ACCENT_DARK, WHITE],
  ['accent-dark links on page background', ACCENT_DARK, PAPER],
  ['ink on accent-soft (hover, selected)', INK, ACCENT_SOFT],
  ['good badge: green-900 on green-100', '#14532d', '#dcfce7'],
  ['warning badge: amber-950 on amber-100', '#451a03', '#fef3c7'],
  ['bad badge: red-900 on red-100', '#7f1d1d', '#fee2e2'],
  ['neutral badge: slate-800 on slate-100', '#1e293b', '#f1f5f9'],
  ['alert text: red-950 on red-50', '#450a0a', '#fef2f2'],
  ['error text: red-900 on white', '#7f1d1d', WHITE],
]
const GRAPHIC_PAIRS: Array<[string, string, string]> = [
  ['chart line on white', ACCENT, WHITE],
  ['moderate threshold line on white', '#8a6d00', WHITE],
  ['high threshold line on white', '#a32020', WHITE],
  ['focus ring on white', '#0b5cad', WHITE],
  ['focus ring on page background', '#0b5cad', PAPER],
]

describe('WCAG 2.2 AA colour contrast', () => {
  it.each(TEXT_PAIRS)('text: %s is at least 4.5:1', (_n, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(GRAPHIC_PAIRS)('graphics: %s is at least 3:1', (_n, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3)
  })
})
