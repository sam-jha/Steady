import { useState } from 'react'
import { BandBadge, HiddenBadge, LoadBadge } from '../components/Badges'
import AbsenceTimeline from '../components/AbsenceTimeline'
import CoverageTable from '../components/CoverageTable'
import HowCalculated from '../components/HowCalculated'
import ScoreCard from '../components/ScoreCard'
import WellbeingTrend from '../components/WellbeingTrend'
import { EXPLANATIONS } from '../content/explanations'
import { useApp } from '../data/AppContext'
import { orgMetrics, teamMetrics, type TeamMetrics } from '../logic/resilienceScore'
import { teamTrend } from '../logic/wellbeing'

const ALL = 'all'

export default function Dashboard() {
  const { data, role, teamLeadTeamId } = useApp()
  const [hrChoice, setHrChoice] = useState<string>(ALL)
  // Team leads are fixed to their own team; HR can pick any team or the whole organisation.
  const scope = role === 'team-lead' ? teamLeadTeamId : hrChoice
  const isOrg = scope === ALL

  const org = orgMetrics(data)
  const team: TeamMetrics | null = isOrg ? null : teamMetrics(data, scope)
  const teamsInScope = isOrg ? org.teams : [team!]
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? id
  const personTeam = new Map(data.people.map((p) => [p.id, p.teamId]))
  const absences = data.absences.filter((a) => isOrg || personTeam.get(a.personId) === scope)

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Resilience dashboard{team ? `: ${teamName(scope)}` : ''}</h1>
        {role === 'hr' && (
          <label className="text-sm text-muted flex items-center gap-2">
            Show:
            <select value={hrChoice} onChange={(e) => setHrChoice(e.target.value)} className="border border-line rounded-md bg-white px-2 py-1.5 text-ink">
              <option value={ALL}>Whole organisation</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard title={isOrg ? 'Organisation resilience' : 'Team resilience'} score={isOrg ? org.score : team!.score} parts={isOrg ? org.parts : team!.parts} />
        <div className="bg-white border border-line rounded-lg p-4 text-sm text-muted">
          <p className="mb-2"><span className="font-medium text-ink">What this shows.</span> How well {isOrg ? 'the organisation' : 'this team'} could absorb losing more people today. Absent people are already taken out of every number.</p>
          <p>Wellbeing figures are anonymous team averages. They stay hidden until a team has enough responses to protect privacy.</p>
        </div>
      </div>

      {isOrg && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Teams at a glance</h2>
          <div className="overflow-x-auto bg-white border border-line rounded-lg">
            <table className="w-full text-sm">
              <caption className="sr-only">Resilience by team</caption>
              <thead className="text-left bg-paper">
                <tr>
                  <th scope="col" className="p-2">Team</th><th scope="col" className="p-2">Score</th>
                  <th scope="col" className="p-2">Single points of failure</th><th scope="col" className="p-2">Load</th>
                  <th scope="col" className="p-2">Burnout risk</th>
                </tr>
              </thead>
              <tbody>
                {org.teams.map((t) => (
                  <tr key={t.teamId} className="border-t border-line">
                    <th scope="row" className="p-2 text-left font-medium">{teamName(t.teamId)}</th>
                    <td className="p-2">{t.score}</td>
                    <td className="p-2">{t.coverages.filter((c) => c.status === 'single-point-of-failure').length}</td>
                    <td className="p-2"><LoadBadge band={t.load.band} /> <span className="text-muted">{t.load.ratio.toFixed(2)}</span></td>
                    <td className="p-2">{!t.wellbeing || t.wellbeing.hidden ? <HiddenBadge /> : <BandBadge band={t.wellbeing.band} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Coverage per critical task</h2>
        <CoverageTable data={data} coverages={teamsInScope.flatMap((t) => t.coverages)} showTeam={isOrg} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Capacity vs demand</h2>
        <div className="overflow-x-auto bg-white border border-line rounded-lg">
          <table className="w-full text-sm">
            <caption className="sr-only">Weekly demand and capacity hours</caption>
            <thead className="text-left bg-paper">
              <tr><th scope="col" className="p-2">Team</th><th scope="col" className="p-2">Demand (hrs/week)</th><th scope="col" className="p-2">Available capacity (hrs/week)</th><th scope="col" className="p-2">Load ratio</th></tr>
            </thead>
            <tbody>
              {teamsInScope.map((t) => (
                <tr key={t.teamId} className="border-t border-line">
                  <th scope="row" className="p-2 text-left font-medium">{teamName(t.teamId)}</th>
                  <td className="p-2">{Math.round(t.load.demandHours)}</td>
                  <td className="p-2">{Math.round(t.load.capacityHours)}</td>
                  <td className="p-2"><LoadBadge band={t.load.band} /> <span className="font-medium">{t.load.ratio === Infinity ? '∞' : t.load.ratio.toFixed(2)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-1"><HowCalculated info={EXPLANATIONS.load} /></div>
      </div>

      {team && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Team wellbeing (anonymous)</h2>
          <div className="bg-white border border-line rounded-lg p-4 space-y-3">
            {!team.wellbeing || team.wellbeing.hidden ? (
              <p>
                <HiddenBadge />{' '}
                <span className="ml-1">Not enough responses to protect anonymity.</span>{' '}
                <span className="text-muted">({team.wellbeing?.responses ?? 0} in the latest week; results appear once there are at least 5.)</span>
              </p>
            ) : (
              <p>Latest week: <BandBadge band={team.wellbeing.band} /> <span className="text-muted">average {team.wellbeing.meanScore}/100 from {team.wellbeing.responses} responses</span></p>
            )}
            <WellbeingTrend trend={teamTrend(data.pulses, scope)} />
            <HowCalculated info={EXPLANATIONS.wellbeing} />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Current and upcoming absences</h2>
        <div className="bg-white border border-line rounded-lg p-4">
          <AbsenceTimeline data={data} absences={absences} />
        </div>
      </div>
    </section>
  )
}
