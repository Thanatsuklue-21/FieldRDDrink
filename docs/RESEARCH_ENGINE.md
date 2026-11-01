# FIELD R&D Research Engine

## Goal

Turn external information into inspectable hypotheses, then choose FIELD formulas from actual controlled trials.

## Source lanes

| Lane | Use | Default evidence weight |
| --- | --- | ---: |
| Peer-reviewed research | mechanism / extraction / sensory science | 0.95 |
| Official guide | producer brewing guidance / technical method | 0.90 |
| Product page | exact ingredient identity / label / nutrition | 0.85 |
| Professional source | cafe/trainer benchmark | 0.75 |
| YouTube | market/pro technique benchmark | 0.55 |
| Lemon8 | market/social practice | 0.45 |
| Social/community | idea discovery | 0.40 |
| Gemini / AI summary | secondary hypothesis only | 0.30 |

Weights do **not** determine the winning recipe. They only indicate how much confidence to place in an external claim before FIELD testing.

## Ingestion

The UI accepts an HTTPS source URL and calls `/api/research`.

The endpoint:
- rejects localhost/private-network targets;
- checks every redirect target;
- accepts HTTPS only;
- limits source size;
- strips script/style/noscript HTML;
- bounds fetch time;
- returns public text/metadata for human verification.

YouTube currently uses public oEmbed metadata. Transcript values must be entered only after a transcript or the video itself has been verified.

Gemini share, Lemon8 and other JS-heavy pages may not expose useful server-rendered text. A failed/partial extraction is not converted into invented evidence; the user can still save the source URL with manually verified notes.

## Trial scoring

Formula Evaluator uses only actual tested trials. PLANNED and RUNNING trials are excluded from ranking.

Structured sensory dimensions, each 0–5:
- Taste 25%
- Body 25%
- Menu character / identity 20%
- T10 dilution performance 15%
- Overall 15%

Historical text-only sensory results remain valid but receive no fabricated numeric score.

Confidence is separate from sensory score and rises with:
- T0/T5/T10 coverage;
- T15;
- repeatability;
- ingredient/SKU snapshot;
- linked evidence refs;
- sensory/production lock state.

## Decision labels

- `UNTESTED` — no actual sensory result
- `NEEDS_STRUCTURED_SCORE` — tested but not quantitatively scoreable yet
- `PROVISIONAL` — structured sensory evidence exists
- `STRONG_CANDIDATE` — high score + adequate evidence confidence
- `SENSORY_WINNER` — FIELD sensory lock; production validation still pending
- `PRODUCTION_READY` — all production gates passed
- `REJECT` — failed trial

## Non-negotiable rule

External evidence may suggest *what to test*. Only FIELD trial data may determine *which formula wins*.


## Automatic Research Scout

`/api/research-discover` creates channel-specific searches for the current menu and performs best-effort public-web discovery. The UI then calls the existing safe `/api/research` reader for discovered URLs and shows readable previews plus obvious units such as g, mL, °C, seconds and minutes.

Safety rules:
- discovered sources are **unverified by default**;
- the scout never writes a source into verified Evidence automatically;
- a source that cannot be read remains visible as a URL rather than receiving fabricated content;
- search failure falls back to manual quick-search/URL ingestion;
- external discovery cannot PASS, SENSORY_LOCK or Production LOCK a formula.

## AI R&D Advisor

The Advisor operates only on trials with actual result states such as `NEEDS_ADJUSTMENT`, `PASS`, `FAIL` or `HOLD`.

It:
1. reads FIELD sensory timeline/notes and structured scores;
2. identifies a directional defect only when evidence is specific enough;
3. parses measurable formula variables in g/mL;
4. changes exactly one variable in a small step;
5. explains the sensory reason for that change;
6. carries source refs into the candidate;
7. creates only a `PLANNED` candidate for human review;
8. detects an equivalent existing PLANNED/RUNNING trial and refuses to duplicate it.

Examples of guarded rules include reducing a measurable sweetener when the actual result explicitly says sweetness leads, increasing the primary flavour ingredient when character is explicitly weak, and reducing measurable water when dilution is the identified defect.

If the sensory evidence does not point to a safe direction, the engine returns `NEEDS_HUMAN_DIRECTION` instead of guessing.

`SENSORY_LOCKED` and `LOCKED` formulas are immutable to automatic formula changes.

## Research Coach v1

The dashboard uses an audited coach layer over the candidate engine. It shows observation coverage, missing controls, linked and deduplicated evidence, exact one-variable validation and a baseline comparison plan. Negated/ambiguous feedback and incomplete formula parsing block automatic candidate preparation. High scores alone no longer justify adjustment. Saved candidate Trials preserve a versioned researchPlan snapshot; methods are clearly separated from FIELD tasting evidence. See [evaluation, inspected sources and limits](RESEARCH_COACH_EVALUATION.md). This is an inspectable rules-based workflow, not a newly trained model or a demonstrated advantage over Claude.
