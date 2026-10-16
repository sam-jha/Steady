// The wording of the wellbeing pulse. Edit questions HERE, not in the page code.

export interface ScaleOption { label: string; value: number } // value is on a 0–100 scale

/** Frequency answers used by the burnout items. */
export const FREQUENCY_OPTIONS: ScaleOption[] = [
  { label: 'Always', value: 100 },
  { label: 'Often', value: 75 },
  { label: 'Sometimes', value: 50 },
  { label: 'Seldom', value: 25 },
  { label: 'Never / almost never', value: 0 },
]

/** Agreement answers used by our own context items. */
export const AGREEMENT_OPTIONS: ScaleOption[] = [
  { label: 'Strongly agree', value: 100 },
  { label: 'Agree', value: 75 },
  { label: 'Neither agree nor disagree', value: 50 },
  { label: 'Disagree', value: 25 },
  { label: 'Strongly disagree', value: 0 },
]

export interface BurnoutItem { id: string; text: string; reverse: boolean }

/**
 * Work-related burnout subscale of the Copenhagen Burnout Inventory.
 * Source: Kristensen, T. S., Borritz, M., Villadsen, E., & Christensen, K. B. (2005). The Copenhagen
 * Burnout Inventory: A new tool for the assessment of burnout. Work & Stress, 19(3), 192–207.
 * The CBI is free to use. This is NOT the Maslach Burnout Inventory (which is licensed).
 *
 * TODO: verify item wording and scoring against the original publication. The wording below is
 * written from memory and may differ from the published items. In particular, check (1) the exact
 * wording of each item, (2) which response scale (frequency or degree) each item uses, and
 * (3) the reverse-scored item. Until that is done, do not describe this as the validated scale.
 */
export const CBI_WORK_ITEMS: BurnoutItem[] = [
  { id: 'cbi1', text: 'Is your work emotionally exhausting?', reverse: false },
  { id: 'cbi2', text: 'Do you feel burnt out because of your work?', reverse: false },
  { id: 'cbi3', text: 'Does your work frustrate you?', reverse: false },
  { id: 'cbi4', text: 'Do you feel worn out at the end of the working day?', reverse: false },
  { id: 'cbi5', text: 'Are you exhausted in the morning at the thought of another day at work?', reverse: false },
  { id: 'cbi6', text: 'Do you feel that every working hour is tiring for you?', reverse: false },
  { id: 'cbi7', text: 'Do you have enough energy for family and friends during leisure time?', reverse: true },
]

export interface ContextItem { id: string; text: string; dimension: 'demand' | 'resource' }

/**
 * Our own short context items, based on the Job Demands–Resources model.
 * These are NOT a validated scale. They are labelled as such on screen.
 */
export const JDR_ITEMS: ContextItem[] = [
  { id: 'jdr1', text: 'I am regularly covering work that belongs to colleagues who are away.', dimension: 'demand' },
  { id: 'jdr2', text: 'My workload is not realistic for the hours I have.', dimension: 'demand' },
  { id: 'jdr3', text: 'I can get support from my manager when I need it.', dimension: 'resource' },
  { id: 'jdr4', text: 'I have the skills I need for the tasks I am covering.', dimension: 'resource' },
]

/** How the pulse is repeated (see also PULSE_INTERVAL_WEEKS in config.ts). */
export const PULSE_INTRO = {
  title: 'Wellbeing pulse',
  minutes: 2,
  notClinical:
    'This check-in looks at work-related burnout risk. It is not a clinical tool, does not diagnose anything, and is not a substitute for professional support.',
  privacy:
    'Your answers are anonymous. Only your team and the date are stored with them, never your name. Your manager, HR and leadership only ever see team averages, and only when at least 5 colleagues have answered.',
}
