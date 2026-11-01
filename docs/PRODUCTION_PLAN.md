# FIELD R&D Lab — Production Completion Plan

## Goal
Make FIELD R&D Lab simple enough for one operator, resistant to human error, and safe for real beverage R&D records while remaining fully separate from FIELD POS.

## Quality principles inherited from FIELD POS
1. Guide the operator to the next action; do not make them guess.
2. Validate before commit; never fail silently.
3. Historical evidence is append-only from normal UI.
4. Recovery is safer than destructive editing.
5. Every important action gives visible feedback.
6. Mobile-first: large targets, no hidden/overlapped critical actions.
7. Treat local persistence failures as errors, never as “zero records”.
8. Release only after build + critical-flow verification.

## Delivery phases
### P0 — Reliable local operation
- Storage schema version and strict validation.
- Detect corrupted/unavailable browser storage.
- Durable pending-write/outbox before committing a Trial to the visible log.
- Idempotent Trial IDs.
- Recovery banner and JSON backup.
- LOCK gate and required-field validation.

Acceptance: create Trial → reload → same Trial; duplicate submit does not create duplicate ID; failed storage write is visible; no historical edit/delete control.

### P1 — R&D workflow
- Guided New Trial form in logical sections.
- One-variable warning.
- T0/T5/T10/T15 sensory timeline.
- Formula Registry separates LOCKED vs development.
- Readiness gates: repeatability, dilution, cup/ice, costing, SOP, POS, QC.
- Formula evolution links source Trial IDs.

### P2 — Hosted persistence
- Provision a dedicated FIELD R&D database, never FIELD POS DB.
- Server-side append-only Trial writes.
- Idempotency key for create Trial.
- Formula version records reference immutable Trial IDs.
- Local outbox sync/retry for network loss.
- Migration/import from local JSON backup.

### P3 — Production verification
- Automated build/test.
- Mobile smoke test.
- Create/save/reload/history/registry/backup.
- Offline write → reconnect → exact replay.
- Verify no destructive historical actions.
- Verify deployment and runtime errors.

## Current constraint
P2 phase 1 code is available in this branch: opt-in Supabase Auth, immutable Trials/Evidence, RLS, append-only RPC, durable outbox and guarded local import. See `docs/CLOUD_SYNC_SETUP.md`. Hosted provisioning, deployment, real-data migration and physical PC/phone/tablet acceptance still require the authorized dedicated R&D connection. Do not infer runtime completion from code or local tests. Never use guessed credentials or FIELD POS data.
