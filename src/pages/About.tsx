import { Link } from 'react-router-dom'
import { BURNOUT_RISK_RULES } from '../rules/burnoutRiskRules'
import { RULES } from '../rules/recommendations'

const REFERENCES = [
  'Abrams, L. C., & Berge, Z. L. (2010). [Add full reference.]',
  'Bakker, A. B., & Demerouti, E. (2007). The Job Demands–Resources model: State of the art. Journal of Managerial Psychology, 22(3), 309–328.',
  'Burnard, K. J., Bhamra, R., & Tsinopoulos, C. (2018). Building organizational resilience: Four configurations. IEEE Transactions on Engineering Management, 65(3), 351–362.',
  'Donaldson, L. (1995). Contingency theory. Dartmouth.',
  'Kero, C. A., & Bogale, A. T. (2023). [Add full reference.]',
  'Kristensen, T. S., Borritz, M., Villadsen, E., & Christensen, K. B. (2005). The Copenhagen Burnout Inventory: A new tool for the assessment of burnout. Work & Stress, 19(3), 192–207.',
  'Lawler, E. E. (1986). High-involvement management. Jossey-Bass.',
  'Lengnick-Hall, C. A., Beck, T. E., & Lengnick-Hall, M. L. (2011). Developing a capacity for organizational resilience through strategic human resource management. Human Resource Management Review, 21(3), 243–255.',
]

const H2 = 'text-xl font-semibold mt-8 mb-2'

export default function About() {
  return (
    <article className="max-w-3xl space-y-3 leading-relaxed">
      <h1 className="text-2xl font-semibold">About Steady</h1>
      <p className="text-muted">A portfolio prototype that shows how an organisation can absorb unexpected staff shortages without burning out the people who remain. All data is fictional. It is not a clinical tool.</p>

      <h2 className={H2}>The problem</h2>
      <p>The idea comes from an organisational intervention paper about a company that lost key staff suddenly to military reserve duty. It had no contingency plan and a rigid workforce with no cross-training, so the remaining staff absorbed extra work with no support, and burnout spread.</p>
      <p>The same pattern happens with illness, parental leave, a gap between a leaver and a replacement, a pandemic or a natural disaster. Steady generalises the case to any unexpected absence.</p>

      <h2 className={H2}>Who it is for</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>HR lead:</strong> sees all teams, manages the data, runs scenarios and owns the recommendations.</li>
        <li><strong>Team lead:</strong> sees their own team’s coverage, load, anonymous wellbeing and advice.</li>
        <li><strong>CEO / leadership:</strong> one screen: overall resilience, top risks and top “do now” actions.</li>
        <li><strong>Employee:</strong> takes a two-minute anonymous pulse, sees their own result privately, and finds support. Cannot see anyone else’s data.</li>
      </ul>
      <p className="text-sm text-muted">The “Viewing as” switcher is for exploring the demo. It is not security: a real version would need proper sign-in.</p>

      <h2 className={H2}>How it works</h2>
      <p>Steady rests on three pillars from the intervention: <strong>crisis preparedness</strong>, <strong>workforce adaptability</strong> and <strong>employee wellbeing</strong>.</p>
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Coverage</strong> counts, for each task, the available people who are competent (proficiency 2 or 3). One or none is a single point of failure, two is thin. <em>Theory: Resource-Based View: resilience depends on how flexibly people can be redeployed, and cross-training is the main lever.</em></li>
        <li><strong>Load ratio</strong> is weekly hours of essential and important work divided by the hours of available people: under 0.85 healthy, up to 1.0 stretched, over 1.0 overloaded. <em>Theory: Job Demands–Resources: burnout rises when demands exceed resources.</em></li>
        <li><strong>Wellbeing</strong> is the weekly team average of anonymous pulse responses, hidden until at least five people have answered.</li>
        <li><strong>Resilience score</strong> blends coverage (40%), load (35%) and wellbeing (25%). If wellbeing is hidden, the other two share its weight. Every number has a “How is this calculated?” explanation. <em>Theory: organisational resilience is planned in advance.</em></li>
        <li><strong>Scenarios</strong> take chosen people away and recompute everything, then show who could cover each gap and warn when cover would overload another team. Burnout projections use {BURNOUT_RISK_RULES.length} short rules, for example: overload for more than three weeks raises a team’s risk by one band, and a team already at High that is overloaded is critical. <em>Theory: contingency theory assumes predictable pressures, which is why scenario planning matters.</em></li>
        <li><strong>Recommendations</strong> come from {RULES.length} plain rules, no AI, each showing the data that triggered it. They are split into <strong>Do now</strong> (cheap, realistic mid-crisis), <strong>Do next (30–90 days)</strong> and <strong>Build long-term</strong>. <em>Theory: high-involvement management: cross-training works better when people help plan it and the skills are recognised, including in pay.</em></li>
      </ul>

      <h2 className={H2}>Design decisions and trade-offs</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Rule-based, not AI.</strong> HR and employees can read every rule, challenge it and see exactly why it fired. That transparency is worth more here than a smarter-sounding black box.</li>
        <li><strong>Do now versus build long-term.</strong> A tutor’s feedback pointed out that cross-training and wellness programmes cannot be rolled out in full while a team is already stretched. Every rule has a horizon, and actions that add work show a warning and a lighter alternative when the team is already overloaded.</li>
        <li><strong>Don’t move burnout around.</strong> Cover suggestions check the helper’s team load and warn if it would pass 1.0.</li>
        <li><strong>Anonymity threshold.</strong> Teams with fewer than five responses in a week show nothing. Small weeks are never pooled to get past the limit.</li>
        <li><strong>Named roles, not named sufferers.</strong> Recommendations name absent colleagues and the tasks left behind (so someone can act), and name the team lead and HR contact as the people who can help. They never identify who is struggling.</li>
      </ul>

      <h2 className={H2}>Ethics and privacy</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Pulse responses are stored with only team, date and scores: no name or person id.</li>
        <li>Managers, HR and leadership see team averages only, and only above the threshold.</li>
        <li>The pulse measures work-related burnout risk. It does not diagnose anything and asks no risk or suicide-screening questions.</li>
        <li>Every employee page links to “Need support now?” with helplines and an employee assistance programme placeholder.</li>
        <li>Recommendations act on teams, tasks and policies, never on individuals’ wellbeing.</li>
        <li>All demo data is fictional. Data stays in your browser.</li>
      </ul>

      <h2 className={H2}>Limitations</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Fictional data. No backend or real sign-in; data lives in this browser.</li>
        <li>Burnout bands (40 / 60) and the score weights are indicative and have not been validated for this use.</li>
        <li>The burnout item wording is from memory and still needs checking against Kristensen et al. (2005) before it is described as the validated scale. The four context items are our own.</li>
        <li>Helpline numbers should be re-checked locally before real use.</li>
        <li>Sites are not modelled, so “one site offline” is approximated as about one sixth of every team.</li>
        <li>The executive trend shows wellbeing only; coverage and load are not stored over time.</li>
      </ul>

      <h2 className={H2}>What I would build next</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>A backend with real authentication and roles, and HR-system integration (the single data-service module is the planned seam).</li>
        <li>A pilot with an evaluation design: service continuity, coverage, load ratio, burnout band trend and turnover.</li>
        <li>Co-design sessions with employees and team leads, including an opt-in way for people to ask to be contacted.</li>
        <li>Snapshots so resilience can be trended over time.</li>
      </ul>

      <h2 className={H2}>References</h2>
      <ul className="list-none space-y-1 text-sm">
        {REFERENCES.map((r) => <li key={r}>{r}</li>)}
      </ul>

      <p className="text-sm mt-8"><Link to="/" className="underline text-accent-dark">Back to the app</Link></p>
    </article>
  )
}
