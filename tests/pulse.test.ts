import { describe, expect, it } from 'vitest'
import { CBI_WORK_ITEMS, JDR_ITEMS } from '../src/content/pulseItems'
import { SUPPORT_CARDS } from '../src/content/support'
import { HELPLINES } from '../src/content/helplines'
import { matchSupport, scorePulse, themesFor } from '../src/logic/pulse'

const all = (burnout: number, jdr: number) =>
  Object.fromEntries([...CBI_WORK_ITEMS.map((i) => [i.id, i.reverse ? 100 - burnout : burnout]), ...JDR_ITEMS.map((i) => [i.id, jdr])])

describe('pulse scoring', () => {
  it('averages the burnout items and flips the reverse-scored one', () => {
    expect(scorePulse(all(0, 50))!.burnoutScore).toBe(0)
    expect(scorePulse(all(100, 50))!.burnoutScore).toBe(100)
    // Answering "Always" (100) to the reverse-scored energy item means LOW burnout for that item.
    const a = all(50, 50)
    a.cbi7 = 100
    expect(scorePulse(a)!.burnoutScore).toBe(Math.round((6 * 50 + 0) / 7))
  })

  it('uses the configured bands: under 40 low, 40–59 moderate, 60+ high', () => {
    expect(scorePulse(all(25, 50))!.band).toBe('low')
    expect(scorePulse(all(50, 50))!.band).toBe('moderate')
    expect(scorePulse(all(75, 50))!.band).toBe('high')
  })

  it('scores demands and resources separately', () => {
    const a = all(50, 50)
    for (const i of JDR_ITEMS) a[i.id] = i.dimension === 'demand' ? 100 : 0
    const s = scorePulse(a)!
    expect(s.demandsScore).toBe(100)
    expect(s.resourcesScore).toBe(0)
  })

  it('returns nothing for missing or impossible answers', () => {
    const a = all(50, 50)
    delete a.cbi3
    expect(scorePulse(a)).toBeNull()
    expect(scorePulse({ ...all(50, 50), cbi1: 37 })).toBeNull()
  })

  it('stores no person information in what it returns', () => {
    expect(Object.keys(scorePulse(all(50, 50))!).sort()).toEqual(['band', 'burnoutScore', 'demandsScore', 'resourcesScore'])
  })
})

describe('matching support', () => {
  it('suggests workload and boundaries content when demands are high', () => {
    const s = scorePulse(Object.fromEntries([...CBI_WORK_ITEMS.map((i) => [i.id, 75]), ...JDR_ITEMS.map((i) => [i.id, i.dimension === 'demand' ? 100 : 25])]))!
    const themes = themesFor(s)
    expect(themes).toEqual(expect.arrayContaining(['workload', 'boundaries', 'manager']))
    const picks = matchSupport(SUPPORT_CARDS, s.band, themes, 3)
    expect(picks).toHaveLength(3)
    expect(picks.every((c) => c.themes.some((t) => themes.includes(t)))).toBe(true)
  })

  it('does not suggest content for returners unless asked', () => {
    const picks = matchSupport(SUPPORT_CARDS, 'high', ['stress', 'sleep', 'workload', 'boundaries', 'manager'], 20)
    expect(picks.some((c) => c.audience?.includes('returning'))).toBe(false)
    expect(matchSupport(SUPPORT_CARDS, 'low', ['returning'], 20).some((c) => c.audience?.includes('returning'))).toBe(true)
  })
})

describe('support library and signposting content', () => {
  it('has unique ids and every theme and band the brief asks for', () => {
    expect(new Set(SUPPORT_CARDS.map((c) => c.id)).size).toBe(SUPPORT_CARDS.length)
    const themes = new Set(SUPPORT_CARDS.flatMap((c) => c.themes))
    for (const t of ['workload', 'sleep', 'stress', 'boundaries', 'uncertainty', 'returning']) expect(themes.has(t as never)).toBe(true)
    const bands = new Set(SUPPORT_CARDS.flatMap((c) => c.bands))
    expect(bands.size).toBe(3)
    expect(SUPPORT_CARDS.some((c) => c.audience?.includes('returning'))).toBe(true)
    expect(SUPPORT_CARDS.some((c) => c.audience?.includes('colleague-of-absent'))).toBe(true)
  })

  it('has a timed breathing exercise and clearly marked placeholder videos', () => {
    expect(SUPPORT_CARDS.some((c) => c.type === 'exercise' && c.timerSeconds === 120)).toBe(true)
    const videos = SUPPORT_CARDS.filter((c) => c.type === 'video')
    expect(videos.length).toBeGreaterThan(0)
    expect(videos.every((v) => v.placeholder === true)).toBe(true)
  })

  it('has UK defaults with Samaritans and NHS 111, plus an EAP placeholder, and asks no screening questions', () => {
    const uk = HELPLINES.UK.lines
    expect(uk.find((l) => l.name === 'Samaritans')?.contact).toBe('116 123')
    expect(uk.find((l) => l.name === 'NHS 111')?.contact).toBe('111')
    expect(uk.some((l) => l.placeholder)).toBe(true)
    const questions = [...CBI_WORK_ITEMS, ...JDR_ITEMS].map((i) => i.text.toLowerCase()).join(' ')
    expect(questions).not.toMatch(/suicid|self-harm|harm yourself|end your life/)
  })
})
