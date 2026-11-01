# FIELD R&D Lab

Separate beverage R&D application for FIELD Café.

## Current guarantees

- Immutable-by-UI experiment history: saved trials have no edit/delete controls.
- Evidence states distinguish `SENSORY_LOCKED` from production `LOCKED`.
- Production LOCK requires T0/T5/T10, exact ingredient/SKU snapshot, repeatability, dilution, cup/ice, costing, SOP and QC readiness.
- Ingredient Master surfaces known identity and missing evidence instead of guessing.
- Browser storage migrates v1/v2 records to v3, preserving FIELD sensory evidence and correcting unperformed ML-02 to `PLANNED`.
- Backups export trials plus Ingredient Master. Restore validates the payload and keeps a device-local pre-import recovery snapshot before replacement.
- CI runs tests and production build.

## Storage

Without cloud configuration, storage remains device-local. This branch adds opt-in Supabase synchronization of immutable Trials and Evidence for the same signed-in operator across devices, a durable local outbox, conflict rejection, server-side LOCK validation and account-isolated history. Original local records are not uploaded automatically. FIELD POS data/database must not be reused.

See [cloud setup, limits and device acceptance](docs/CLOUD_SYNC_SETUP.md). Code tests and a build do not prove that a hosted database is configured, deployed or accepted on physical devices. Ingredient Master and separate approval/role workflows are outside this first phase.

## Development

```bash
npm install
npm test
npm run build
```


## Research Hub & Formula Evaluator

- Research Hub stores evidence by menu from peer-reviewed papers, official guides, product pages, professional sources, YouTube, Lemon8, Gemini/AI summaries and other social sources.
- AI Research Scout can generate multi-channel searches automatically, discover public HTTPS sources, fetch readable previews, extract obvious measurements, and stage the result as **unverified Evidence** for review. Discovery never auto-verifies or auto-locks a formula.
- Public HTTPS URLs can be ingested through `/api/research`. The server-side fetcher blocks private/local network targets, re-validates redirects, limits payload size and strips executable HTML before returning a text preview.
- YouTube ingestion currently imports public oEmbed metadata only; transcript/formula values still require verified transcript/manual evidence.
- JavaScript-heavy or access-restricted Gemini/Lemon8 pages may return partial or no extract. The UI explicitly supports manual URL + verified notes rather than inventing missing content.
- Internet evidence is ranked by source class, relevance and verification, but cannot PASS or LOCK a FIELD formula by itself.
- Trials can record structured 0–5 scores for Taste, Body, Character, T10/Dilution and Overall, plus Evidence refs.
- Formula Evaluator ranks only actually tested trials; PLANNED/RUNNING candidates are excluded. It reports sensory score, confidence and the next validation need.
- AI R&D Advisor converts actual sensory defects into a **single-variable PLANNED candidate**, explains why that variable is being changed, links available evidence, and blocks duplicate candidates. `SENSORY_LOCKED` and `LOCKED` formulas are never mutated automatically.
- Historical trials without structured scores remain valid evidence and are labelled as needing structured scoring instead of receiving fabricated numbers.

## Research Coach

The dashboard audits the Trial's linked evidence, shows missing measurements/process controls, verifies an exact one-variable recipe delta, and prepares a baseline comparison plan. Negated/ambiguous feedback asks for clarification; untested and locked trials cannot generate altered recipes. Prepared candidates remain PLANNED and retain a versioned plan/citation snapshot when explicitly saved. See [inspected research sources, evaluation and limitations](docs/RESEARCH_COACH_EVALUATION.md). This is an inspectable rules-based tool, not a trained foundation model or demonstrated superiority over Claude.
