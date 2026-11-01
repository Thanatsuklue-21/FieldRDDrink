# Add opt-in R&D Trial/Evidence cloud sync with durable outbox

Trials entered on one device currently remain local. This change adds opt-in Supabase authentication and immutable Trial/Evidence synchronization for the same operator across devices. A saved record enters a durable local outbox before transmission; identical replay is safe and conflicting content for an existing ID stops the entire batch.

The dedicated R&D migration enforces per-account reads, no direct client writes/deletes, server-side Production LOCK gates and immutable server history. Original device storage remains intact. Initial import requires explicit operator confirmation and a recovery copy; fresh cloud devices do not upload baseline recipes. Formula Registry derives from synced Trials. Ingredient Master, staff roles and explicit approval-event workflows remain future work.

Initial upload includes a read-only preflight showing new/matching/conflicting records and both versions of changed fields. Confirmation rechecks current server/source data; conflicts stop upload and changed previews require a fresh confirmation. Each RPC binds the intended account UUID to the authenticated user to reject session-switch misrouting.

Validation: 57 automated tests pass, including actual SQL execution under PGlite for authorization, RLS, whole-batch rollback, LOCK gates and intended-account mismatch rejection. Client tests cover preflight/stale plans, offline/lost-response replay, concurrent local saves, corruption/quota failures, account binding and incomplete replies. Production build passes with Lucide's module-level directive warning. Synthetic browser QA verifies independent-device read, conflict details/blocked import, duplicate detection, explicit successful import, cleared pending queue and hidden history after sign-out. Responsive checks found no horizontal overflow and action targets >=48px.

Deployment gates: connect the authorized dedicated Supabase project, apply the migration, configure public R&D hosting variables, verify real Supabase Auth and physical PC/Android/tablet acceptance, and perform only owner-approved source-device migration. No hosted schema, real Trial data, deployment or POS data changed. Keep this PR draft until those gates pass. Do not close issue #8.

Relates to #8.
