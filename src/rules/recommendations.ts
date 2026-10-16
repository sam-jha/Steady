// ALL recommendation rules live in this one file. There is no AI here: each rule is a plain
// condition on the computed numbers, plus the advice to show when the condition is true.
//
// Reading a rule:
//   horizon  – "Do now" (cheap, doable mid-crisis) / "Do next" (30–90 days) / "Build long-term"
//   trigger  – looks at the numbers and returns one "finding" for each team or task it applies
//              to. It returns an empty list when the rule does not apply.
//   effort / impact – used to order the list: impact ÷ effort, highest first, within a horizon.
//   addsWorkload – true if the action itself takes time. If the team is already overloaded the
//              app shows a warning and the `lighter` alternative instead.
//
// Rules only ever look at teams, tasks and policies. They never name people for wellbeing reasons.

import { HIGH_STREAK_WEEKS, LOAD_HEALTHY_MAX, LOAD_STRETCHED_MAX, MODERATE_STREAK_WEEKS, SIMULATION_SCORE_BELOW, TREND_RISE_POINTS, TREND_WEEKS, UNDOCUMENTED_ESSENTIAL_MIN, MIN_GROUP_SIZE } from '../config'
import type { AbsenceBrief, Contact, RuleContext } from '../logic/recommendationContext'

export type Pillar = 'Crisis preparedness' | 'Workforce adaptability' | 'Wellbeing'
export type Horizon = 'Do now' | 'Do next (30–90 days)' | 'Build long-term'
export type Level = 'low' | 'med' | 'high'

/** One place a rule applies, with the evidence that made it fire. */
export interface Finding {
  subjectId: string // a team id, task id, or 'org'
  subject: string // what to show people, e.g. a task or team name
  teamId?: string // the team affected (used for scoping and the overload warning)
  evidence: string[] // the "Triggered because…" lines
  involve?: string[] // who to notify or involve, by name and role (shown as "Who to involve")
}

export interface Rule {
  id: string
  pillar: Pillar
  horizon: Horizon
  title: string
  action: string
  why: string
  theory: string
  effort: Level
  impact: Level
  addsWorkload?: boolean
  lighter?: string // a lower-effort alternative, shown with the overload warning
  trigger: (ctx: RuleContext) => Finding[]
}

// ---------- small helpers so the rules below stay readable ----------
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const list = (xs: string[], max = 4) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} and ${xs.length - max} more`)
const q = (s: string) => `‘${s}’`

/** "NOP-01 (Team lead, Network Operations)", with a note if that person is away themselves. */
const contactText = (c: Contact, role: string) => `${c.id} (${role}, ${c.teamName})${c.away ? ': currently away, so go to their manager' : ''}`

/** One line per absence: who, why, when, and which tasks are left without them. */
const absenceLine = (b: AbsenceBrief): string => {
  const dates = `${b.absence.start} → ${b.absence.end ?? 'no end date set'}`
  const tasks = b.isVacancy
    ? 'The leaver’s tasks are not recorded in Steady: list them with the team lead.'
    : b.tasks.length === 0
      ? 'Not competent at any recorded task, so no critical cover is needed.'
      : `Tasks now without them: ${b.tasks.slice(0, 5).map((t) => `${q(t.task.name)} (${t.task.criticality}, ${t.competentLeft} competent left)`).join(', ')}${b.tasks.length > 5 ? ` and ${b.tasks.length - 5} more` : ''}.`
  return `${b.personId} (${b.role}): ${b.typeLabel}, ${dates}. ${tasks}`
}

/** Who to tell about these absences: the team lead, and the lead of any other team that owns a task they cover. */
const absenceInvolve = (ctx: RuleContext, teamId: string, briefs: AbsenceBrief[], withHr = false): string[] => {
  const out = [`Notify ${contactText(ctx.leadOf(teamId), 'team lead')}.`]
  const otherTeams = new Set(briefs.flatMap((b) => b.tasks.map((t) => t.task.teamId)).filter((id) => id !== teamId))
  for (const id of otherTeams) out.push(`Notify ${contactText(ctx.leadOf(id), 'team lead')}: ${ctx.teamName(id)} owns tasks this absence affects.`)
  const hr = ctx.hrContact()
  if (withHr && hr) out.push(`Involve ${contactText(hr, 'HR')} for hiring and contract questions.`)
  return out
}

/** Who can help a team with high burnout risk: its lead and HR. These are role-holders, never survey respondents. */
const helpers = (ctx: RuleContext, teamId: string): string[] => {
  const hr = ctx.hrContact()
  return [
    `${contactText(ctx.leadOf(teamId), 'team lead')}: can reduce or reprioritise the team’s work and agree flexible schedules.`,
    ...(hr ? [`${contactText(hr, 'HR')}: can arrange extra capacity, flexible working and signpost the employee assistance programme.`] : []),
  ]
}

/** Essential/important tasks (not deferrable), with their live coverage. */
const liveTasks = (ctx: RuleContext) => ctx.org.coverages.filter((c) => c.task.criticality !== 'deferrable')

const JDR = 'Job Demands–Resources model (Bakker & Demerouti, 2007)'
const RBV = 'Resource-Based View (Abrams & Berge, 2010; Kero & Bogale, 2023)'
const RESILIENCE = 'Organisational resilience (Lengnick-Hall, Beck & Lengnick-Hall, 2011; Burnard, Bhamra & Tsinopoulos, 2018)'
const CONTINGENCY = 'Contingency theory (Donaldson, 1995)'
const HIM = 'High-involvement management (Lawler, 1986)'

export const RULES: Rule[] = [
  // =============================== DO NOW ===============================
  {
    id: 'now-spof-shadow', pillar: 'Workforce adaptability', horizon: 'Do now', effort: 'low', impact: 'high',
    title: 'Pair the one competent person with someone who can shadow',
    action: 'Ask the one competent person to let a colleague at proficiency 1 (see the names in the evidence) sit alongside on live work this week. Learning on real tasks costs almost no extra time. Do not schedule classroom training mid-crisis.',
    why: 'If that one person is unavailable, the task stops. Shadowing on live work builds a second person quickly without taking anyone off their work.',
    theory: `${RBV}: no critical task should depend on one person.`,
    addsWorkload: true, lighter: 'Skip the shadowing for now. Ask the competent person for a 10-minute recorded walkthrough of the next occurrence of the task.',
    trigger: (ctx) => liveTasks(ctx).filter((c) => c.task.criticality === 'essential' && c.count === 1).map((c) => {
      const helpers = ctx.shadowCandidates(c.task.id)
      return {
        subjectId: c.task.id, subject: c.task.name, teamId: c.task.teamId,
        evidence: [`${q(c.task.name)} has 1 competent person available.`, helpers.length ? `People at proficiency 1 who could shadow: ${list(helpers, 3)}.` : 'No one available has any experience of this task yet.'],
      }
    }),
  },
  {
    id: 'now-no-cover', pillar: 'Crisis preparedness', horizon: 'Do now', effort: 'med', impact: 'high',
    title: 'Arrange emergency cover for a task nobody competent can do',
    action: 'Escalate today. Options in order of speed: (1) supervised cover by someone at proficiency 1 with the former owner reachable by phone; (2) agree a pause or reduced service with stakeholders; (3) a temporary or external resource.',
    why: 'An essential task with no competent person available is already failing or about to fail.',
    theory: `${RESILIENCE}: emergency staffing strategies and communication protocols are planned parts of resilience.`,
    trigger: (ctx) => liveTasks(ctx).filter((c) => c.task.criticality === 'essential' && c.count === 0).map((c) => ({
      subjectId: c.task.id, subject: c.task.name, teamId: c.task.teamId,
      evidence: [`${q(c.task.name)} has 0 competent people available.`],
    })),
  },
  {
    id: 'now-defer-work', pillar: 'Wellbeing', horizon: 'Do now', effort: 'low', impact: 'high',
    title: 'Pause or defer deferrable work',
    action: 'Agree with the team and its stakeholders to pause the deferrable tasks listed below until the load ratio is back under 1.0. Tell the people who depend on them when they will resume.',
    why: 'Demand is above the hours available. Removing work that can wait is the fastest, cheapest way to cut load and it costs no one any extra time.',
    theory: `${JDR}: burnout rises when demands exceed resources, so reduce demands first.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.metrics.load.ratio > LOAD_STRETCHED_MAX && t.deferrable.length > 0).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Load ratio is ${t.metrics.load.ratio.toFixed(2)} (above ${LOAD_STRETCHED_MAX.toFixed(1)}).`, `Deferrable tasks that could be paused: ${t.deferrable.map((k) => `${q(k.name)} (${k.weeklyHours} hrs/week)`).join(', ')}.`],
    })),
  },
  {
    id: 'now-reduce-scope', pillar: 'Wellbeing', horizon: 'Do now', effort: 'med', impact: 'high',
    title: 'Reduce scope or borrow capacity: there is nothing left to defer',
    action: 'Ask leadership to agree what the team can drop or slow down, or to lend capacity from a team with spare hours (see the evidence). Set a review date.',
    why: 'The team is overloaded and has no deferrable work left to pause, so the only options are less demand or more capacity.',
    theory: `${JDR}; ${CONTINGENCY}: structure has to fit the pressure.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.metrics.load.ratio > LOAD_STRETCHED_MAX && t.deferrable.length === 0).map((t) => {
      const spare = ctx.teams.filter((o) => o.id !== t.id && o.metrics.load.ratio < LOAD_HEALTHY_MAX).map((o) => `${o.name} (${o.metrics.load.ratio.toFixed(2)})`)
      return { subjectId: t.id, subject: t.name, teamId: t.id, evidence: [`Load ratio is ${t.metrics.load.ratio.toFixed(2)} and no deferrable work is left.`, spare.length ? `Teams with spare capacity: ${list(spare)}.` : 'No other team currently has spare capacity.'] }
    }),
  },
  {
    id: 'now-write-it-down', pillar: 'Crisis preparedness', horizon: 'Do now', effort: 'low', impact: 'med',
    title: 'Capture a one-page “how I do this” note',
    action: 'Ask the competent person to write one page, or record a 5-minute screen recording, of how they do the task. Store it where the whole team can find it.',
    why: 'The task has no written process and only one or two people can do it. A rough note now is better than a perfect manual later.',
    theory: `${RESILIENCE}: documented procedures are part of a task redistribution guide.`,
    addsWorkload: true, lighter: 'A 2-minute voice note on the next time the task is done is enough for now.',
    trigger: (ctx) => liveTasks(ctx).filter((c) => !c.task.hasDocumentedProcess && c.count <= 2).map((c) => ({
      subjectId: c.task.id, subject: c.task.name, teamId: c.task.teamId,
      evidence: [`${q(c.task.name)} has no documented process and ${plural(c.count, 'competent person', 'competent people')} available.`],
    })),
  },
  {
    id: 'now-absence-open-ended', pillar: 'Crisis preparedness', horizon: 'Do now', effort: 'low', impact: 'med',
    title: 'Set a check-in date for open-ended absences and plan for both outcomes',
    action: 'Choose a date to review each open-ended absence. Prepare two simple plans: “back in a month” and “not back for three months”, covering who does what in each case.',
    why: 'Planning is hard when the end date is unknown, so teams drift into improvised cover that tends to become permanent.',
    theory: `${CONTINGENCY}: its limit is that it assumes predictable pressure, so plan for more than one outcome.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.noEndDateAbsences > 0).map((t) => {
      const briefs = ctx.absenceBriefs(t.id).filter((b) => b.absence.end === null)
      return { subjectId: t.id, subject: t.name, teamId: t.id, evidence: briefs.map(absenceLine), involve: absenceInvolve(ctx, t.id, briefs) }
    }),
  },
  {
    id: 'now-tell-the-team', pillar: 'Crisis preparedness', horizon: 'Do now', effort: 'low', impact: 'med',
    title: 'Tell the team what is paused, what is priority and who covers what',
    action: 'Hold a 15-minute huddle or send one short message: the top priorities, what is paused, who covers each critical task, and who to go to with problems. Repeat weekly while the shortage lasts.',
    why: 'When people are absent and the team is under pressure, unclear priorities are an extra demand. Clear communication costs minutes and removes guesswork.',
    theory: `${RESILIENCE}: communication protocols; ${JDR}: clarity about priorities is a job resource.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.activeAbsences.length > 0 && t.metrics.load.ratio >= LOAD_HEALTHY_MAX).map((t) => {
      const briefs = ctx.absenceBriefs(t.id)
      return {
        subjectId: t.id, subject: t.name, teamId: t.id,
        evidence: [`${t.name} has ${plural(t.activeAbsences.length, 'current absence')} and a load ratio of ${t.metrics.load.ratio.toFixed(2)}.`, ...briefs.map(absenceLine)],
        involve: absenceInvolve(ctx, t.id, briefs),
      }
    }),
  },
  {
    id: 'now-support-visible', pillar: 'Wellbeing', horizon: 'Do now', effort: 'low', impact: 'med',
    title: 'Make support easy to find for the whole team',
    action: 'Send the team a short note pointing to the support library and the “Need support now?” page, and share the “talking to your manager about workload” tips. Make it a message to the whole team, not to individuals.',
    why: 'Team burnout risk is High. A visible, no-pressure offer of support costs very little and can be done at once.',
    theory: `${JDR}: support is a job resource.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.band === 'high').map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Team burnout risk is High (average ${t.metrics.wellbeing && !t.metrics.wellbeing.hidden ? t.metrics.wellbeing.meanScore : '–'}/100).`],
      involve: helpers(ctx, t.id),
    })),
  },
  {
    id: 'now-escalate-extreme', pillar: 'Wellbeing', horizon: 'Do now', effort: 'low', impact: 'high',
    title: 'Escalate: the team lead and HR should meet this week about this team',
    action: 'The team lead and the HR contact meet for 30 minutes this week. Agree 2–3 team-level actions with owners and dates: work to stop or defer, extra capacity, flexible working, and how support will be offered to the whole team. Invite the team to raise concerns with their lead or HR directly, and remind everyone of the support library and employee assistance programme. Pulse answers are anonymous, so nobody is identified from them.',
    why: 'Burnout risk is High and the team is also overloaded, or has been High for several weeks. This is the point at which a conversation between the people who can change the work is needed, not another survey.',
    theory: `${JDR}: when demands stay above resources, change the demands or add resources; ${HIM}: involve the team in the response.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.band === 'high' && (t.highStreak >= HIGH_STREAK_WEEKS || t.metrics.load.ratio > LOAD_STRETCHED_MAX)).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [
        `Team burnout risk is High${t.highStreak >= HIGH_STREAK_WEEKS ? ` and has been for ${t.highStreak} weeks in a row` : ''}.`,
        `Load ratio is ${t.metrics.load.ratio.toFixed(2)}${t.metrics.load.ratio > LOAD_STRETCHED_MAX ? ' (overloaded)' : ''}.`,
      ],
      involve: helpers(ctx, t.id),
    })),
  },
  {
    id: 'now-vacancy-cover', pillar: 'Crisis preparedness', horizon: 'Do now', effort: 'med', impact: 'high',
    title: 'Speed up hiring or arrange interim cover for an open vacancy',
    action: 'Ask HR for the earliest realistic start date. Meanwhile agree interim cover, such as a contractor, an agency worker or temporary help from another team, for the tasks the leaver owned.',
    why: 'The team is carrying the gap between a leaver and a replacement while already at or near its limit.',
    theory: `${RESILIENCE}: emergency staffing strategies are planned in advance.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.openVacancies > 0 && t.metrics.load.ratio >= LOAD_HEALTHY_MAX).map((t) => {
      const briefs = ctx.absenceBriefs(t.id).filter((b) => b.isVacancy)
      return {
        subjectId: t.id, subject: t.name, teamId: t.id,
        evidence: [`${plural(t.openVacancies, 'open vacancy', 'open vacancies')} in ${t.name}, with a load ratio of ${t.metrics.load.ratio.toFixed(2)}.`, ...briefs.map(absenceLine)],
        involve: absenceInvolve(ctx, t.id, briefs, true),
      }
    }),
  },

  // =============================== DO NEXT ===============================
  {
    id: 'next-high-burnout-review', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'high',
    title: 'Review workload with the team and offer flexible scheduling',
    action: 'Run a workload review with the whole team: what is the work, what can stop, what needs more hands. Offer flexible start and finish times, and promote the support library. Agree two changes and check back in a month.',
    why: 'Burnout risk has been High for several weeks in a row: this is a pattern, not a bad week.',
    theory: `${JDR}: change the balance of demands and resources.`,
    addsWorkload: true, lighter: 'Skip the full review. Hold a 20-minute team conversation with a single question: “what one thing would make the next month easier?”',
    trigger: (ctx) => ctx.teams.filter((t) => t.highStreak >= HIGH_STREAK_WEEKS).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Burnout risk has been High for ${t.highStreak} weeks in a row.`],
      involve: helpers(ctx, t.id),
    })),
  },
  {
    id: 'next-moderate-streak', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'low', impact: 'med',
    title: 'Talk with the team about demands and resources before risk climbs',
    action: 'Add a 30-minute team conversation to the calendar: what is draining, what helps, what is missing. Note the answers and pick one action.',
    why: 'Moderate risk that stays moderate is the stage at which prevention is cheapest.',
    theory: `${JDR}.`,
    addsWorkload: true, lighter: 'Add one standing question to the next team meeting instead of a separate session.',
    trigger: (ctx) => ctx.teams.filter((t) => t.band === 'moderate' && t.moderateStreak >= MODERATE_STREAK_WEEKS).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Burnout risk has been Moderate for ${t.moderateStreak} weeks in a row.`],
    })),
  },
  {
    id: 'next-rising-trend', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'low', impact: 'med',
    title: 'Act on a rising burnout trend early',
    action: 'Look at what changed over the period: absences, new work, deadlines. Pick one cause the team can influence and fix it. Check the next two pulse results.',
    why: 'Burnout risk is climbing even if it has not reached a worrying band yet. Early action is easier than recovery.',
    theory: `${RESILIENCE}: resilience is planned in advance, not just recovered after the fact.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.burnoutRise !== null).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Team burnout score rose by ${t.burnoutRise} points over ${TREND_WEEKS} weeks (alert threshold: ${TREND_RISE_POINTS}).`],
      involve: helpers(ctx, t.id),
    })),
  },
  {
    id: 'next-cross-train-structural', pillar: 'Workforce adaptability', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'high',
    title: 'Plan structured cross-training, with the people involved',
    action: 'Draft a cross-training plan for this task together with the employees who would take part: who learns, from whom, how many hours a week, and how the new skill will be recognised. Start with one pairing and protect the time for it.',
    why: 'Fewer than 2 people in the whole team can do this essential task. Even without absences, it is a risk.',
    theory: `${RBV}; ${HIM}: cross-training works better when people help plan it and the extra skill is recognised.`,
    addsWorkload: true, lighter: 'Choose a single pairing for one hour a week, and fold the learning into live work rather than separate sessions.',
    trigger: (ctx) => ctx.data.tasks.filter((t) => t.criticality === 'essential' && ctx.trainedCount(t.id) < 2).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.teamId,
      evidence: [`${q(t.name)}: only ${plural(ctx.trainedCount(t.id), 'person')} in the whole organisation is trained at proficiency 2 or more.`],
    })),
  },
  {
    id: 'next-third-person', pillar: 'Workforce adaptability', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'med',
    title: 'Bring a third person up to competent on a thinly covered task',
    action: 'Pick someone at proficiency 1 and plan their progression to 2 over the next 60 days, using real work with a competent colleague nearby.',
    why: 'Two competent people is fragile: one absence leaves a single point of failure.',
    theory: `${RBV}.`,
    addsWorkload: true, lighter: 'Add the person to the task rota as a second pair of eyes, without a formal programme.',
    trigger: (ctx) => liveTasks(ctx).filter((c) => c.task.criticality === 'essential' && c.count === 2).map((c) => ({
      subjectId: c.task.id, subject: c.task.name, teamId: c.task.teamId,
      evidence: [`${q(c.task.name)} has 2 competent people available (3 or more is the target).`],
    })),
  },
  {
    id: 'next-important-spof', pillar: 'Workforce adaptability', horizon: 'Do next (30–90 days)', effort: 'low', impact: 'med',
    title: 'Add a backup for an important task that one person holds',
    action: 'Name a backup for the task and pair them for a couple of occurrences. This is less urgent than an essential task but should not wait for the next crisis.',
    why: 'An important task depends on a single available person.',
    theory: `${RBV}.`,
    addsWorkload: true, lighter: 'Name the backup and share the process note. Defer the pairing until the team is under 0.85.',
    trigger: (ctx) => liveTasks(ctx).filter((c) => c.task.criticality === 'important' && c.count <= 1).map((c) => ({
      subjectId: c.task.id, subject: c.task.name, teamId: c.task.teamId,
      evidence: [`${q(c.task.name)} (important) has ${plural(c.count, 'competent person', 'competent people')} available.`],
    })),
  },
  {
    id: 'next-documentation-sprint', pillar: 'Crisis preparedness', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'med',
    title: 'Document the team’s essential processes',
    action: 'Schedule one short documentation slot per week until every essential task has a written or recorded process. Start with the least covered.',
    why: 'Several essential tasks have no written process. In a crisis, the person covering has to guess.',
    theory: `${RESILIENCE}: task redistribution guides are part of a crisis management framework.`,
    addsWorkload: true, lighter: 'Record a short screen-share the next time each task is done instead of writing it up.',
    trigger: (ctx) => ctx.teams.filter((t) => t.undocumentedEssential.length >= UNDOCUMENTED_ESSENTIAL_MIN).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`${plural(t.undocumentedEssential.length, 'essential task')} without a documented process: ${list(t.undocumentedEssential.map((k) => q(k.name)))}.`],
    })),
  },
  {
    id: 'next-rebalance', pillar: 'Crisis preparedness', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'med',
    title: 'Agree cross-team cover with teams that have spare capacity',
    action: 'Agree in advance which tasks teams with spare hours can take on, and for how long, so cover arrives quickly next time.',
    why: 'The team is stretched, with little room to absorb another absence, while other teams have headroom.',
    theory: `${RBV}: resilience depends on how flexibly human capital can be redeployed.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.metrics.load.ratio >= LOAD_HEALTHY_MAX && t.metrics.load.ratio <= LOAD_STRETCHED_MAX).flatMap((t) => {
      const spare = ctx.teams.filter((o) => o.id !== t.id && o.metrics.load.ratio < LOAD_HEALTHY_MAX)
      return spare.length === 0 ? [] : [{ subjectId: t.id, subject: t.name, teamId: t.id, evidence: [`Load ratio ${t.metrics.load.ratio.toFixed(2)} (stretched).`, `Teams with room: ${list(spare.map((o) => `${o.name} (${o.metrics.load.ratio.toFixed(2)})`))}.`] }]
    }),
  },
  {
    id: 'next-long-absence', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'med', impact: 'high',
    title: 'Redistribute work properly for long absences instead of stretching the team',
    action: 'Agree who permanently takes which tasks for the duration, what is dropped, and whether interim backfill is possible. Review in a month.',
    why: 'Long or open-ended absences turn short-term goodwill into a standing overload.',
    theory: `${JDR}.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.longTermAbsences > 0 && t.metrics.load.ratio >= LOAD_HEALTHY_MAX).map((t) => {
      const briefs = ctx.absenceBriefs(t.id).filter((b) => b.isLongTerm)
      return {
        subjectId: t.id, subject: t.name, teamId: t.id,
        evidence: [`${plural(t.longTermAbsences, 'long-term absence')} in ${t.name}, with a load ratio of ${t.metrics.load.ratio.toFixed(2)}.`, ...briefs.map(absenceLine)],
        involve: absenceInvolve(ctx, t.id, briefs, true),
      }
    }),
  },
  {
    id: 'next-return-planning', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'low', impact: 'med',
    title: 'Plan handovers and a gentle return for colleagues coming back',
    action: 'Set up a standard return plan for the team: a handover note, a phased workload for the first weeks, and a catch-up on what changed. Share the “returning after an absence” items in the support library.',
    why: 'Returners and the colleagues who covered for them are often forgotten, and handing work back badly creates a second wave of strain.',
    theory: `${RESILIENCE}; ${JDR}.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.returningSoon > 0).map((t) => {
      const briefs = ctx.absenceBriefs(t.id).filter((b) => b.returningSoon)
      return {
        subjectId: t.id, subject: t.name, teamId: t.id,
        evidence: [`${plural(t.returningSoon, 'absence')} in ${t.name} ${t.returningSoon === 1 ? 'is' : 'are'} due to end within the next 2 weeks.`, ...briefs.map(absenceLine)],
        involve: absenceInvolve(ctx, t.id, briefs),
      }
    }),
  },
  {
    id: 'next-pulse-visibility', pillar: 'Wellbeing', horizon: 'Do next (30–90 days)', effort: 'low', impact: 'low',
    title: 'Improve pulse participation, or use a different way to listen',
    action: `Remind the team the pulse is anonymous and takes 2 minutes. For very small teams that can never reach ${MIN_GROUP_SIZE} responses, use a regular team conversation instead. Do not lower the privacy threshold.`,
    why: 'Wellbeing results are hidden for this team, so burnout risk is invisible to everyone, including the team.',
    theory: `${JDR}: you cannot manage demands you cannot see.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.wellbeingHidden).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`${plural(t.latestResponses, 'response')} in the latest week; at least ${MIN_GROUP_SIZE} are needed to show results.`],
    })),
  },

  // =============================== BUILD LONG-TERM ===============================
  {
    id: 'long-crisis-framework', pillar: 'Crisis preparedness', horizon: 'Build long-term', effort: 'high', impact: 'high',
    title: 'Maintain a crisis management framework',
    action: 'Write and keep current: a list of critical functions with an owner and a named backup for each, task redistribution guides, emergency staffing options, and communication protocols. Review it every six months.',
    why: 'Single points of failure or thin cover exist on essential tasks. A framework means the next shortage is handled from a plan, not improvised.',
    theory: `${RESILIENCE}: resilience is planned in advance.`,
    addsWorkload: true, lighter: 'Start with just the list of critical functions, owners and backups. One page is a real first step.',
    trigger: (ctx) => {
      const weak = liveTasks(ctx).filter((c) => c.task.criticality === 'essential' && c.count <= 2)
      return weak.length === 0 ? [] : [{ subjectId: 'org', subject: 'Whole organisation', evidence: [`${plural(weak.length, 'essential task')} with 2 or fewer competent people available: ${list(weak.map((c) => q(c.task.name)))}.`] }]
    },
  },
  {
    id: 'long-simulation', pillar: 'Crisis preparedness', horizon: 'Build long-term', effort: 'med', impact: 'med',
    title: 'Run a crisis simulation exercise twice a year',
    action: 'Pick a realistic shortage (the scenario simulator has presets), walk through it with team leads for an hour, and update the plan from what you learn.',
    why: 'Plans that have not been tested tend to fail on first contact. A simulation finds the gaps while nothing is at stake.',
    theory: `${CONTINGENCY}: its weakness is assuming predictable pressures, which is why scenario planning matters.`,
    addsWorkload: true, lighter: 'Do a 30-minute desk-top walk-through of one preset scenario with the team leads.',
    trigger: (ctx) => ctx.org.score < SIMULATION_SCORE_BELOW ? [{ subjectId: 'org', subject: 'Whole organisation', evidence: [`Organisation resilience score is ${ctx.org.score} (below ${SIMULATION_SCORE_BELOW}).`] }] : [],
  },
  {
    id: 'long-job-rotation', pillar: 'Workforce adaptability', horizon: 'Build long-term', effort: 'high', impact: 'high',
    title: 'Introduce job rotation and a standing cross-training programme',
    action: 'Create a rota in which people spend a few hours a month on a second team or task. Plan it with employees and managers together, protect the time, and track the skills matrix quarterly.',
    why: 'Several tasks across the organisation have thin cover. A standing programme fixes this steadily instead of in a crisis.',
    theory: `${RBV}; ${HIM}.`,
    addsWorkload: true, lighter: 'Start with a single pilot pairing in the team with the most single points of failure.',
    trigger: (ctx) => {
      const weak = liveTasks(ctx).filter((c) => c.count <= 2)
      return weak.length >= 3 ? [{ subjectId: 'org', subject: 'Whole organisation', evidence: [`${weak.length} essential or important tasks have 2 or fewer competent people available.`] }] : []
    },
  },
  {
    id: 'long-recognise-skills', pillar: 'Workforce adaptability', horizon: 'Build long-term', effort: 'high', impact: 'med',
    title: 'Recognise cross-skills in role descriptions and pay',
    action: 'Add cross-team skills to role descriptions and the career framework, and reflect them in pay or grading decisions. Agree the principles with employee representatives.',
    why: 'People will only take on extra skills if the effort is visible and rewarded. Without recognition cross-training feels like extra work.',
    theory: `${HIM}: cross-training works better when skills are recognised, including in pay.`,
    trigger: (ctx) => {
      const n = ctx.data.tasks.filter((t) => t.criticality === 'essential' && ctx.trainedCount(t.id) <= 2).length
      return n > 0 ? [{ subjectId: 'org', subject: 'Whole organisation', evidence: [`${plural(n, 'essential task')} depend on 2 or fewer trained people in total.`] }] : []
    },
  },
  {
    id: 'long-wellbeing-programme', pillar: 'Wellbeing', horizon: 'Build long-term', effort: 'high', impact: 'med',
    title: 'Build a standing wellbeing offer: flexible working, stress management and access to support',
    action: 'Put in place a flexible working policy, stress-management resources, a clear route to an employee assistance programme, and manager training on workload conversations. Review its use each year.',
    why: 'Some teams already show moderate or high burnout risk. These programmes cannot be rolled out in full during a crisis, so build them while there is some slack.',
    theory: `${JDR}: build resources, not only reduce demands.`,
    trigger: (ctx) => {
      const flagged = ctx.teams.filter((t) => t.band === 'moderate' || t.band === 'high')
      return flagged.length === 0 ? [] : [{ subjectId: 'org', subject: 'Whole organisation', evidence: [`${plural(flagged.length, 'team')} at Moderate or High burnout risk: ${list(flagged.map((t) => t.name))}.`] }]
    },
  },
  {
    id: 'long-slack-capacity', pillar: 'Crisis preparedness', horizon: 'Build long-term', effort: 'high', impact: 'high',
    title: 'Plan permanent spare capacity for a stretched team',
    action: 'Review headcount, workload and hiring plans so the team normally runs below 0.85, leaving room for the next absence. Consider a shared flexible pool across teams.',
    why: 'A team that always runs close to its limit has no way to absorb an unexpected absence without overload.',
    theory: `${RESILIENCE}; ${CONTINGENCY}: structure has to fit the pressure the organisation faces.`,
    trigger: (ctx) => ctx.teams.filter((t) => t.metrics.load.ratio >= LOAD_HEALTHY_MAX).map((t) => ({
      subjectId: t.id, subject: t.name, teamId: t.id,
      evidence: [`Load ratio is ${t.metrics.load.ratio.toFixed(2)} (healthy is under ${LOAD_HEALTHY_MAX}).`],
    })),
  },
]
