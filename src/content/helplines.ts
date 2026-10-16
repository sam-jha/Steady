// Signposting. Edit this file to change the numbers shown on the "Need support now?" page.
// Numbers are written from public sources and should be re-checked before real use.
// Steady never asks risk or suicide-screening questions: it only points people to help.

export interface Helpline {
  name: string
  contact: string
  detail: string
  /** Shown as a placeholder the organisation must fill in. */
  placeholder?: boolean
}

export interface CountryHelp {
  label: string
  emergency: string
  lines: Helpline[]
}

export const DEFAULT_COUNTRY = 'UK'

const EAP: Helpline = {
  name: 'Your organisation’s employee assistance programme (EAP)',
  contact: '[Add your EAP number or link here]',
  detail: 'Free, confidential support for employees. Ask HR where to find the details.',
  placeholder: true,
}

export const HELPLINES: Record<string, CountryHelp> = {
  UK: {
    label: 'United Kingdom',
    emergency: 'In an emergency, or if someone is in immediate danger, call 999.',
    lines: [
      { name: 'Samaritans', contact: '116 123', detail: 'Free, 24 hours a day, every day. You can talk about anything that is troubling you.' },
      { name: 'NHS 111', contact: '111', detail: 'For urgent health advice when it is not a 999 emergency. Mental health options are available.' },
      { name: 'Shout (text support)', contact: 'Text SHOUT to 85258', detail: 'Free, confidential, 24/7 text support.' },
      { name: 'Mind Infoline', contact: '0300 123 3393', detail: 'Information and signposting on mental health. Check opening hours.' },
      EAP,
    ],
  },
  IE: {
    label: 'Ireland',
    emergency: 'In an emergency, call 999 or 112.',
    lines: [
      { name: 'Samaritans Ireland', contact: '116 123', detail: 'Free, 24 hours a day, every day.' },
      EAP,
    ],
  },
  US: {
    label: 'United States',
    emergency: 'In an emergency, call 911.',
    lines: [
      { name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988', detail: 'Free, confidential, 24/7 support.' },
      EAP,
    ],
  },
  IL: {
    label: 'Israel',
    emergency: 'In an emergency, call 101 (ambulance) or 100 (police).',
    lines: [
      { name: 'ERAN emotional first aid', contact: '1201', detail: 'Confidential emotional support line. Check current availability.' },
      EAP,
    ],
  },
}
