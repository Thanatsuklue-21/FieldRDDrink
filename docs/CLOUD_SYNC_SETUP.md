# FIELD R&D cloud setup and acceptance

This branch implements phase 1 of issue #8: immutable Trials + Evidence for one operator signing into the **same Supabase account** across devices. Formula Registry derives from those Trials. Ingredient Master remains a local reference. It does not yet implement separate staff roles, editable formula versions, shared workspaces or explicit approval-event workflows. Existing saved IDs cannot be overwritten, including PLANNED records; corrections require a new Trial with a reference to the old ID.

## Connect the dedicated R&D project

1. Verify the Supabase project is dedicated to FIELD R&D, separate from POS. Back up any existing R&D tables before applying changes. Do not apply this migration twice or to a project with conflicting `rd_records` / `rd_sync` names.
2. Apply `supabase/migrations/202611010001_rd_sync.sql` through an authorized Supabase connection. It adds one table and an atomic append/read function. Browser roles have read-own access and RPC execution, with no direct write/update/delete privileges. RPC checks the signed-in identity and Production LOCK gates.
3. Provision a confirmed operator account with Supabase Auth. This app does not create accounts. Use the same operator on all devices. Do not grant public or unauthenticated table access.
4. Configure `VITE_RD_SUPABASE_URL` and `VITE_RD_SUPABASE_PUBLISHABLE_KEY` in the R&D hosting project and rebuild. The key must be the public/publishable key or legacy anon key, never a service-role/secret key. No database password belongs in Vite/browser configuration. Configure public environment values only after identifying the dedicated R&D project.
5. Sign in. First cloud use starts with an empty cloud cache and reads the server. It does **not** upload seeded baseline formulas. Original local keys remain intact.
6. Export a backup from each source device before migration. “ตรวจข้อมูลเดิมก่อนนำเข้า” performs a read-only server comparison, showing new records, exact matches and conflicting IDs/fields with both versions. Nothing is queued by the preview. “ยืนยันนำเข้ารายการใหม่” rechecks the server and source data, writes a recovery copy and queues new stored records only. If the proposed upload changed, the operator must review the refreshed preview and confirm again. Conflicts disable confirmation; exact matches are not sent again. Same-ID/different-content races are still rejected atomically by the server. Export both versions and review them; there is no last-write-wins option.

## Behavior and limits

- Newly saved Trials/Evidence commit to one durable local cloud envelope with an outbox before sending. Reads use that account/project envelope, never another account's records.
- Automatic retry happens after a save, reconnect, foregrounding, and every 30 seconds while open. This is polling, not real-time push. Network failure leaves pending records visible. An app already loaded can keep recording offline; first-time offline sign-in is not provided. This change does not add a service worker for loading the app offline.
- The server compares full JSON content by immutable ID; identical replay is accepted, conflicts stop the batch. Account writes serialize in the database. Browser tabs coordinate cache commits with Web Locks and refresh on storage events.
- Every RPC carries `p_owner` (the intended signed-in user UUID). The database checks it against `auth.uid()` before reading or appending. A token/session change cannot route the previous account's queued records into another account. This draft changes the RPC signature before its first hosted deployment; if an older draft schema was applied independently, stop and prepare a reviewed upgrade rather than rerunning the initial migration.
- Each sync returns full history. Requests above 5,000 new records or 10 MB are rejected without partial writes. Large-history pagination/batch upload is future work. Periodic local recovery copies can consume storage; quota errors stop commits visibly and preserve pending data.
- Sign-out keeps cache/outbox but hides the history. To switch accounts/projects on a shared browser, first export all records for the original account and verify that pending data reached its original server. The app intentionally refuses to reuse a different account's cache; it does not silently clear it.
- Backups continue exporting Trials and Evidence as JSON. Cloud restore-by-replacement is disabled. No automatic destructive migration, reset, production-data import, provider purchase, or deployment occurs in this branch.

## Required hosted and device acceptance

Do not call cross-device sync complete until the authorized hosted environment passes:

1. PC creates a synthetic Trial, Android and tablet read the same ID/content/revision.
2. Phone adds synthetic Evidence, PC/tablet receive it after sync.
3. Tablet saves offline, reconnects, and produces exactly one server record after replay.
4. Concurrent distinct saves survive; same-ID conflict preserves both sources and shows a conflict.
5. Sign-out hides records; another account cannot read/write them; direct REST inserts/updates/deletes fail.
6. Invalid LOCK is rejected by RPC, valid LOCK is immutable, backups and safe recovery are verified.
7. Owner-approved dry-run/import with real source-device data, deployed health, and the exact release version are recorded.

Local PostgreSQL-compatible tests use PGlite, not the live Supabase service. `scripts/qa-cloud-server.mjs` is an in-memory synthetic QA server for UI checks only; never deploy it or treat its mock login as authentication verification.
