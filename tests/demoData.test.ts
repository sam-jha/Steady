import { describe, expect, it } from 'vitest'
import { buildDemoData } from '../src/data/demoData'
import { MIN_GROUP_SIZE } from '../src/config'

const data = buildDemoData(new Date('2025-03-03'))

describe('demo data', () => {
  it('has 6 teams and about 120 real staff', () => {
    expect(data.teams).toHaveLength(6)
    const staff = data.people.filter((p) => !p.role.startsWith('Vacancy'))
    expect(staff).toHaveLength(120)
  })

  it('has the requested mix of absences', () => {
    const count = (t: string) => data.absences.filter((a) => a.type === t).length
    expect(count('reserve-duty')).toBe(3)
    expect(count('parental-caring-leave')).toBe(1)
    expect(count('illness')).toBe(1)
    expect(count('vacancy')).toBe(2)
  })

  it('marks absent people as absent', () => {
    for (const a of data.absences) {
      expect(data.people.find((p) => p.id === a.personId)?.status).toBe('absent')
    }
  })

  it('stores no personal link on pulse responses', () => {
    expect(Object.keys(data.pulses[0]).sort()).toEqual(
      ['burnoutScore', 'demandsScore', 'id', 'resourcesScore', 'teamId', 'timestamp'],
    )
  })

  it('keeps HR & Admin under the anonymity threshold but every other team over it', () => {
    const perWeek = (teamId: string) => data.pulses.filter((p) => p.teamId === teamId).length / 12
    expect(perWeek('team-hr')).toBeLessThan(MIN_GROUP_SIZE)
    for (const t of data.teams.filter((t) => t.id !== 'team-hr')) {
      expect(perWeek(t.id)).toBeGreaterThanOrEqual(MIN_GROUP_SIZE)
    }
  })
})
