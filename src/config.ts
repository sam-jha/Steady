// Central settings for Steady. Change numbers here, not in the logic files.

/** A team's wellbeing results stay hidden until it has this many responses in the period. */
export const MIN_GROUP_SIZE = 5

/** How often employees are invited to take the pulse (weeks). */
export const PULSE_INTERVAL_WEEKS = 2

/** Load ratio = demand ÷ capacity. Below HEALTHY_MAX is healthy, up to 1.0 is stretched, above is overloaded. */
export const LOAD_HEALTHY_MAX = 0.85
export const LOAD_STRETCHED_MAX = 1.0

/** Competent = proficiency of at least this level (2 = competent). */
export const COMPETENT_LEVEL = 2

/** Single point of failure when this many (or fewer) competent people are available. */
export const SPOF_MAX_COMPETENT = 1
/** Thin coverage when exactly this many competent people are available. */
export const THIN_COVERAGE = 2

/** Weights for the overall resilience score (must add up to 1). */
export const SCORE_WEIGHTS = { coverage: 0.4, load: 0.35, wellbeing: 0.25 }

/** Scenario rule: load above 1.0 for more than this many weeks raises burnout risk by one band. */
export const OVERLOAD_WEEKS_TO_RAISE_RISK = 3

/** Indicative burnout bands on a 0–100 scale (not validated for this use). */
export const BURNOUT_THRESHOLDS = { moderateFrom: 40, highFrom: 60 }

/** Coverage score per task by number of competent, available people (0, 1, 2, 3 or more). */
export const COVERAGE_POINTS = [0, 30, 70, 100]
/** How much each kind of task counts towards a coverage score. */
export const CRITICALITY_WEIGHTS = { essential: 3, important: 2, deferrable: 1 }
/** Load score: 100 at or below LOAD_HEALTHY_MAX, falling in a straight line to 0 at this ratio. */
export const LOAD_ZERO_SCORE_AT = 1.3

/** A full-time week, used to turn FTE into hours. */
export const HOURS_PER_FTE = 37.5

/** Scenario cover suggestions: lost hours are assumed to be shared between up to this many people. */
export const COVER_SHARE_AMONG = 3
/** Scenario cover suggestions: how many candidates to show per gap. */
export const COVER_MAX_CANDIDATES = 5

// ----- Recommendation rule thresholds -----
/** "Do next" wellbeing rule: this many weeks in a row at High risk. */
export const HIGH_STREAK_WEEKS = 2
/** Moderate risk for this many weeks in a row prompts a team conversation. */
export const MODERATE_STREAK_WEEKS = 3
/** Early warning: burnout score rising by at least this many points over TREND_WEEKS weeks. */
export const TREND_RISE_POINTS = 10
export const TREND_WEEKS = 5
/** Someone is "returning soon" if their absence ends within this many days. */
export const RETURNING_SOON_DAYS = 14
/** An absence this long (or with no end date) counts as long-term. */
export const LONG_ABSENCE_DAYS = 56
/** A team with this many essential tasks without a written process gets a documentation push. */
export const UNDOCUMENTED_ESSENTIAL_MIN = 2
/** Organisation resilience score below this prompts the crisis simulation recommendation. */
export const SIMULATION_SCORE_BELOW = 85
