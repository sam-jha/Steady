// Loads the support library from the JSON files in src/content/support/.
// To add or edit a card, edit or add a .json file there. No code changes needed.

import type { BurnoutBand } from '../logic/wellbeing'
import type { Theme } from '../logic/pulse'

export interface SupportCard {
  id: string
  title: string
  type: 'article' | 'exercise' | 'video' | 'tips'
  summary: string
  /** Paragraphs of text. */
  body: string[]
  /** Optional numbered steps (for exercises). */
  steps?: string[]
  themes: Theme[]
  bands: BurnoutBand[]
  /** Set for cards written for specific groups, e.g. "returning" or "colleague-of-absent". */
  audience?: Array<'returning' | 'colleague-of-absent'>
  minutes?: number
  /** If set, the card shows a simple countdown timer for this many seconds. */
  timerSeconds?: number
  videoUrl?: string
  placeholder?: boolean
}

const files = import.meta.glob<SupportCard>('./support/*.json', { eager: true, import: 'default' })
export const SUPPORT_CARDS: SupportCard[] = Object.values(files).sort((a, b) => a.title.localeCompare(b.title))

export const THEME_LABELS: Record<Theme, string> = {
  workload: 'Workload',
  sleep: 'Sleep',
  stress: 'Stress',
  boundaries: 'Boundaries',
  uncertainty: 'Worry or uncertainty',
  returning: 'Returning after an absence',
  manager: 'Talking to my manager',
}

export const AUDIENCE_LABELS = { returning: 'For people returning from an absence', 'colleague-of-absent': 'For colleagues of someone who is away' } as const
