import { EXPLANATIONS } from '../content/explanations'
import type { OrgData } from '../data/schemas'
import type { TaskCoverage } from '../logic/coverage'
import { CoverageBadge } from './Badges'
import HowCalculated from './HowCalculated'

const ORDER = { 'single-point-of-failure': 0, thin: 1, ok: 2 } as const
const CRIT_ORDER = { essential: 0, important: 1, deferrable: 2 } as const

export default function CoverageTable({ data, coverages, showTeam }: { data: OrgData; coverages: TaskCoverage[]; showTeam: boolean }) {
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? id
  // Worst first, so problems are at the top.
  const rows = [...coverages].sort((a, b) => ORDER[a.status] - ORDER[b.status] || CRIT_ORDER[a.task.criticality] - CRIT_ORDER[b.task.criticality])
  return (
    <div>
      <div className="overflow-x-auto bg-white border border-line rounded-lg">
        <table className="w-full text-sm">
          <caption className="sr-only">Coverage per critical task</caption>
          <thead className="text-left bg-paper">
            <tr>
              <th scope="col" className="p-2">Task</th>
              {showTeam && <th scope="col" className="p-2">Team</th>}
              <th scope="col" className="p-2">Importance</th>
              <th scope="col" className="p-2">Competent people available</th>
              <th scope="col" className="p-2">Status</th>
              <th scope="col" className="p-2">Process written down?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.task.id} className="border-t border-line">
                <th scope="row" className="p-2 text-left font-medium">{c.task.name}</th>
                {showTeam && <td className="p-2">{teamName(c.task.teamId)}</td>}
                <td className="p-2 capitalize">{c.task.criticality}</td>
                <td className="p-2">{c.count}</td>
                <td className="p-2"><CoverageBadge status={c.status} count={c.count} /></td>
                <td className="p-2">{c.task.hasDocumentedProcess ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1"><HowCalculated info={EXPLANATIONS.coverage} /></div>
    </div>
  )
}
