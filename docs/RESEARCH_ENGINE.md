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
