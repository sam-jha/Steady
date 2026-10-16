// "Top risks" for the executive summary: a ranked list built from the computed metrics.
// Severity numbers are only used for ordering. Wellbeing risks appear only for teams that meet
// the anonymity threshold, and they name teams, never people.

import type { OrgData } from '../data/schemas'
import { orgMetrics } from './resilienceScore'

export interface Risk {
  id: string
  severity: number
  title: string
  detail: string
  teamId: string
}

export function topRisks(data: OrgData, limit = 3): Risk[] {
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? id
  const risks: Risk[] = []

  for (const t of orgMetrics(data).teams) {
    const name = teamName(t.teamId)
    if (t.load.band === 'overloaded') {
      risks.push({ id: `load-${t.teamId}`, severity: 95, teamId: t.teamId, title: `${name} is overloaded`, detail: `Demand is ${t.load.ratio === Infinity ? 'far above' : t.load.ratio.toFixed(2) + '× '}the available capacity.` })
    } else if (t.load.band === 'stretched') {
      risks.push({ id: `load-${t.teamId}`, severity: 50, teamId: t.teamId, title: `${name} is stretched`, detail: `Load ratio ${t.load.ratio.toFixed(2)}: little room to absorb another absence.` })
    }
    if (t.wellbeing && !t.wellbeing.hidden && t.wellbeing.band === 'high') {
      risks.push({ id: `burnout-${t.teamId}`, severity: 85, teamId: t.teamId, title: `${name}: burnout risk is high`, detail: `Team-level pulse average ${t.wellbeing.meanScore}/100 from ${t.wellbeing.responses} responses.` })
    }
    for (const c of t.coverages) {
      if (c.status === 'single-point-of-failure' && c.task.criticality !== 'deferrable') {
        const essential = c.task.criticality === 'essential'
        risks.push({ id: `spof-${c.task.id}`, severity: essential ? 80 : 60, teamId: t.teamId, title: `Single point of failure: ${c.task.name}`, detail: `${name}. ${c.count} competent ${c.count === 1 ? 'person' : 'people'} available for ${c.task.criticality} work.` })
      } else if (c.status === 'thin' && c.task.criticality === 'essential') {
        risks.push({ id: `thin-${c.task.id}`, severity: 40, teamId: t.teamId, title: `Thin cover: ${c.task.name}`, detail: `${name}. Only 2 competent people available.` })
      }
    }
  }
  return risks.sort((a, b) => b.severity - a.severity).slice(0, limit)
}
