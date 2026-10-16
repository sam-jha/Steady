// Plain-English explanations shown in the "How is this calculated?" popovers.
import {
  COVERAGE_POINTS, CRITICALITY_WEIGHTS, LOAD_HEALTHY_MAX, LOAD_STRETCHED_MAX, LOAD_ZERO_SCORE_AT,
  MIN_GROUP_SIZE, SCORE_WEIGHTS, BURNOUT_THRESHOLDS,
} from '../config'

export interface Explanation {
  title: string
  body: string[]
  theory: string
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export const EXPLANATIONS = {
  resilience: {
    title: 'Resilience score (0–100)',
    body: [
      `A blend of three parts: coverage (${pct(SCORE_WEIGHTS.coverage)}), load (${pct(SCORE_WEIGHTS.load)}) and wellbeing (${pct(SCORE_WEIGHTS.wellbeing)}).`,
      'Each part is first turned into a 0–100 score. If a team has too few pulse responses to show wellbeing, that part is left out and the other two share its weight. It is not counted as zero.',
      'Strong is 80 or above, Fair is 60–79, At risk is below 60.',
    ],
    theory: 'Organisational resilience is planned in advance, not just recovered after the fact (Lengnick-Hall, Beck & Lengnick-Hall, 2011; Burnard, Bhamra & Tsinopoulos, 2018).',
  },
  coverage: {
    title: 'Coverage',
    body: [
      'For each task we count the people who are available today and competent (proficiency 2 or 3). Absent people are not counted.',
      'Red: 0 or 1 competent person (a single point of failure). Amber: 2. Green: 3 or more.',
      `Score: each task earns ${COVERAGE_POINTS[1]} points for 1 person, ${COVERAGE_POINTS[2]} for 2 and ${COVERAGE_POINTS[3]} for 3 or more, out of 100. Essential tasks count ${CRITICALITY_WEIGHTS.essential}×, important ${CRITICALITY_WEIGHTS.important}× and deferrable ${CRITICALITY_WEIGHTS.deferrable}×.`,
    ],
    theory: 'Resource-Based View (Abrams & Berge, 2010; Kero & Bogale, 2023): resilience depends on how flexibly human capital can be redeployed, and cross-training is the main lever.',
  },
  load: {
    title: 'Load ratio',
    body: [
      'Load ratio = weekly hours of essential and important work ÷ weekly hours of the people who are available. Deferrable work is left out because it can wait.',
      `Healthy: below ${LOAD_HEALTHY_MAX}. Stretched: ${LOAD_HEALTHY_MAX}–${LOAD_STRETCHED_MAX}. Overloaded: above ${LOAD_STRETCHED_MAX}.`,
      `Score: 100 while healthy, falling in a straight line to 0 at a ratio of ${LOAD_ZERO_SCORE_AT}.`,
    ],
    theory: 'Job Demands–Resources model (Bakker & Demerouti, 2007): burnout rises when job demands exceed the resources available to meet them.',
  },
  wellbeing: {
    title: 'Team wellbeing (burnout risk)',
    body: [
      'The average of the team’s anonymous pulse responses for one week. Only team averages are ever shown, never individual answers.',
      `Low is below ${BURNOUT_THRESHOLDS.moderateFrom}, Moderate is ${BURNOUT_THRESHOLDS.moderateFrom}–${BURNOUT_THRESHOLDS.highFrom - 1}, High is ${BURNOUT_THRESHOLDS.highFrom} or more. These cut-offs are indicative, not clinical.`,
      `Hidden until a team has at least ${MIN_GROUP_SIZE} responses in the week, to protect anonymity. The wellbeing score is 100 minus the average burnout score.`,
    ],
    theory: 'Job Demands–Resources model (Bakker & Demerouti, 2007). Measures work-related burnout risk only; it does not diagnose anything.',
  },
} satisfies Record<string, Explanation>
