# Steady: workforce resilience and burnout early warning

> A portfolio prototype that shows how an organisation can absorb unexpected staff shortages without burning out the people who remain.
> **All data is fictional. This is not a clinical tool.**

**Live demo:** https://sam-jha.github.io/Steady/

## Screenshots

*Add screenshots here after deploying: executive summary, resilience dashboard, scenario simulator, a recommendation card, and the employee pulse on a phone.*

| Executive summary | Resilience dashboard |
|---|---|
| *(screenshot)* | *(screenshot)* |

| Scenario simulator | Employee pulse |
|---|---|
| *(screenshot)* | *(screenshot)* |

---

## The problem

This tool grows out of an organisational intervention paper I wrote. A company lost key staff suddenly to military reserve duty. It had no contingency plan, and a rigid workforce with no cross-training. The people who remained absorbed the extra work with no support, and burnout spread.

The same pattern appears whenever people are unexpectedly unavailable: illness, parental or caring leave, the gap between someone leaving and a replacement starting, a pandemic, a natural disaster. Steady generalises the reserve-duty case to **any unexpected staff shortage**.

The intervention had three pillars, and the product mirrors them:

1. **Crisis preparedness**: critical functions, task redistribution guides, emergency staffing, communication protocols.
2. **Workforce adaptability**: cross-training and job rotation so no critical task depends on one or two people.
3. **Employee wellbeing**: workload redistribution, flexible working, stress management, access to support.

One piece of tutor feedback shaped the whole product: **separate what is critical and feasible *now*, mid-crisis, when people have no spare time, from what to build over the longer term.** Cross-training and wellness programmes cannot be rolled out in full while a team is already stretched.

## Who it is for

| Role | The job they need done |
|---|---|
| **HR lead** (primary) | See every team, keep the data current, run "what if" scenarios, and own the recommendations. |
| **Team lead** | Know whether *my* team could absorb another absence, how it is coping, and what to do first. |
| **CEO / leadership** | One screen: overall resilience, top three risks, top three "do now" actions, and the trend. |
| **Employee** | A two-minute, genuinely anonymous check-in; a private result; and support that is easy to find. |

A "Viewing as" switcher in the header lets a visitor explore every view. It is a demo convenience, **not security**.

## How it works

### Data model
Teams, people (with FTE and available/absent status), tasks (essential / important / deferrable, with weekly hours), a **skills matrix** (proficiency 0–3 for each person and task), and absences (type, dates, certainty). Anonymous pulse responses carry only a team, a date and scores. See [`src/data/schemas.ts`](src/data/schemas.ts).

### The metrics
| Metric | How it is calculated | Theory |
|---|---|---|
| **Coverage** | Per task, the number of *available* people at proficiency 2+. 0–1 = single point of failure, 2 = thin, 3+ = well covered. | Resource-Based View (Abrams & Berge, 2010; Kero & Bogale, 2023) |
| **Load ratio** | Weekly hours of essential + important work ÷ weekly hours of available people. <0.85 healthy, 0.85–1.0 stretched, >1.0 overloaded. | Job Demands–Resources (Bakker & Demerouti, 2007) |
| **Wellbeing** | Weekly team average of anonymous pulse scores; Low / Moderate / High. **Hidden below 5 responses.** | Job Demands–Resources |
| **Resilience score** | Coverage 40% + load 35% + wellbeing 25%. If wellbeing is hidden, the other two share its weight (it is *not* treated as zero). | Organisational resilience (Lengnick-Hall et al., 2011; Burnard et al., 2018) |

Every number in the app has a "How is this calculated?" explanation in plain English. The weights and thresholds live in one file, [`src/config.ts`](src/config.ts).

### The scenario simulator
Choose an absence type and who is affected (a percentage of a team, named people, or a role) for some number of weeks, or start from a preset (reserve call-up, flu outbreak, two senior leavers, regional flooding). Steady copies the data, removes those people, recomputes everything, and shows **before vs during**: coverage per task, new single points of failure, load per team, and a projected burnout-risk direction.

The projection rules are deliberately few and readable ([`src/rules/burnoutRiskRules.ts`](src/rules/burnoutRiskRules.ts)). For example, load above 1.0 for more than three weeks raises a team's risk by one band; a team already at High that becomes overloaded is flagged **critical**.

For every gap it lists **who could cover it**, ranked by proficiency and by how much room their team has, and **warns when the suggestion would push another team over a load ratio of 1.0**: cover must not just move burnout around. Scenarios can be saved and compared. Contingency theory (Donaldson, 1995) assumes pressures are predictable; scenario planning is the answer to that limit.

### The recommendations engine
27 rules in one readable file ([`src/rules/recommendations.ts`](src/rules/recommendations.ts)), **no AI**. Each rule has a pillar, a horizon, a trigger on the computed numbers, the action, the rationale, the theory, and effort and impact scores.

| Horizon | Rules | Idea |
|---|---|---|
| **Do now** | 10 | Cheap and doable mid-crisis: shadow on live work (not classroom training), defer deferrable tasks by name, write a one-page "how I do this", tell the team what is paused, escalate extreme cases. |
| **Do next (30–90 days)** | 11 | Structured cross-training planned *with* the people involved (Lawler, 1986), a workload review, documentation, cross-team cover agreements. |
| **Build long-term** | 6 | A crisis management framework, simulation exercises, job rotation, recognising cross-skills in role descriptions and pay, a standing wellbeing offer. |

Within a horizon, recommendations are ordered by impact ÷ effort. Each shows **"Triggered because…"** with the specific data, and **"Who to involve"** by name and role. If an action adds work to an already overloaded team, the card shows a warning and a lighter alternative. Statuses (Planned / In progress / Done / Not relevant) are saved.

### Employee pulse and support
A two-minute pulse: the work-related burnout items of the Copenhagen Burnout Inventory (Kristensen et al., 2005), plus four of our own, clearly labelled non-validated context items about demands and resources. After submitting, employees see their own band in kind language and 2–3 matched cards from a support library of articles, a two-minute breathing timer, a shutdown ritual, tips for talking to a manager, placeholder videos, and content for **people returning from an absence** and **colleagues covering for someone away**. The library is JSON in [`src/content/support/`](src/content/support/), editable without touching code. A "Need support now?" page (UK defaults: Samaritans 116 123, NHS 111) is linked from every employee page.

### Data input
Everything can be edited by hand, or imported from **CSV or Excel** using downloadable templates, with a preview and plain-English, row-by-row errors ("Row 3: 'fte' should be a number above 0 and at most 1…"). Export as JSON, one Excel workbook, or CSV per type. All data access goes through [`src/data/store.ts`](src/data/store.ts), so a backend or HR-system integration can replace local storage without rewriting the UI. That is the planned automation path; no backend is built.

## Design decisions and trade-offs

- **Rule-based, not AI.** HR and employees can read every rule, challenge it, and see exactly why it fired. That transparency and defensibility matters more for trust than a smarter-sounding black box, especially for something that touches wellbeing.
- **The anonymity threshold.** A team with fewer than five responses in a week shows nothing, and small weeks are never pooled to get past the limit. In the demo, HR & Admin (4 people) shows exactly this state.
- **"Do now" versus "build long-term".** From the tutor feedback above. It is why a recommendation can be *correct but not yet*, and why work-adding advice carries an overload warning.
- **Cover that doesn't move burnout.** The easy answer to a gap is "ask someone else". Steady checks whether that someone else has room.
- **Named roles, not named sufferers.** Recommendations name absent colleagues and the tasks left behind (so someone can act on it), and name the **team lead and HR contact** as the people who can help. They never identify who is struggling, because the pulse is anonymous by design. An escalation rule (High risk plus overload or a long run at High) tells the team lead and HR to meet that week and invites the team to raise concerns directly. A route for individuals who *choose* to be contacted is on the roadmap.
- **Accessibility as a design constraint.** Status is never colour alone (icon + text), text contrast is tested against WCAG 2.2 AA, everything works by keyboard, and the pulse is built for phones.

## Ethics and privacy

1. Wellbeing data is **anonymised and aggregated**. Managers, HR and leadership see team averages only.
2. **Minimum group size of 5** (a constant in `config.ts`).
3. Pulse responses are **not linked to a person**: only team, date and scores are stored.
4. **Not a clinical tool.** The pulse measures work-related burnout risk and diagnoses nothing. It asks no risk or suicide-screening questions.
5. **Signposting** on every employee page.
6. Recommendations act on **teams, tasks and policies**, never on individuals' wellbeing.
7. All demo data is **fictional** and labelled as such.

## Limitations

- Fictional data; no backend and no real sign-in. The role switcher is not security. Data lives in the visitor's browser.
- Burnout bands (40 / 60) and score weights are **indicative**, not validated for this use.
- **The burnout item wording needs verifying** against Kristensen et al. (2005) before it is called the validated scale. There is a `TODO` in [`src/content/pulseItems.ts`](src/content/pulseItems.ts). The four context items are our own.
- Helpline numbers should be re-checked locally before any real use.
- Sites are not modelled: "one site offline" is approximated as about one sixth of every team.
- The executive trend shows wellbeing only; coverage and load are not stored over time.
- With only a handful of responses per week, a team near the threshold could still be roughly inferable; a real deployment would need a privacy review.

## What I'd build next

- A **backend with real authentication** and role-based access, and **HR-system integration** (the data-service module is the seam).
- A **pilot with an evaluation design**: KPIs of service continuity, coverage, load ratio, burnout-band trend and turnover, compared against a baseline.
- **Co-design sessions** with employees and team leads, in the spirit of high-involvement management, including an opt-in "please contact me" route.
- Stored **snapshots** so resilience can be trended, and an uncertainty-aware version of the scenario projections.

## Run it yourself

```bash
npm install
npm run dev      # local site (it prints the address; the path ends in /steady/)
npm test         # unit tests for every metric, rule and importer
npm run lint
npm run build
```

Built with Vite, React, TypeScript, Tailwind CSS, Recharts, React Router (HashRouter, so it works on GitHub Pages), PapaParse and SheetJS. SheetJS is installed from the vendor's own site (version 0.20.3) because the npm registry copy is out of date with known advisories.

### Deploying to GitHub Pages
1. Push the project to a GitHub repository.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab). [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs lint, tests and the build, then publishes. The site address is `https://<your-username>.github.io/<repository-name>/`.

## References

- Abrams, L. C., & Berge, Z. L. (2010). *[add full reference]*
- Bakker, A. B., & Demerouti, E. (2007). The Job Demands–Resources model: State of the art. *Journal of Managerial Psychology, 22*(3), 309–328.
- Burnard, K. J., Bhamra, R., & Tsinopoulos, C. (2018). Building organizational resilience: Four configurations. *IEEE Transactions on Engineering Management, 65*(3), 351–362.
- Donaldson, L. (1995). *Contingency theory*. Dartmouth.
- Kero, C. A., & Bogale, A. T. (2023). *[add full reference]*
- Kristensen, T. S., Borritz, M., Villadsen, E., & Christensen, K. B. (2005). The Copenhagen Burnout Inventory: A new tool for the assessment of burnout. *Work & Stress, 19*(3), 192–207.
- Lawler, E. E. (1986). *High-involvement management*. Jossey-Bass.
- Lengnick-Hall, C. A., Beck, T. E., & Lengnick-Hall, M. L. (2011). Developing a capacity for organizational resilience through strategic human resource management. *Human Resource Management Review, 21*(3), 243–255.

> The bibliographic details above were written from memory. Please check each against the original, and complete the two marked entries, before publishing.
