# R&D cross-device sync — implementation scope

Continue issue #8 from main 9655591. Phase 1 synchronizes immutable Trials and Evidence for the same signed-in operator across devices. Dedicated Supabase only; never use POS infrastructure. Formula Registry remains derived from Trials; Ingredient Master remains the existing local reference, not a remotely editable master in this phase.

Acceptance: authenticated account isolation; durable pending snapshot before network; idempotent retries; same-ID/different-content conflict stops the entire batch; server enforces Trial/LOCK validation; local backup before applying remote records; storage/network failures cannot display sync success. Preserve original device data and require explicit consent before uploading it. Fresh cloud devices start with empty data, not baseline recipes.

Verification: existing tests, client failure tests, real PostgreSQL-compatible migration tests, production build and browser layout/flow checks. Hosted migration, deployment and physical PC/phone/tablet acceptance require the authorized Supabase connection and owner data; do not infer them from local tests.
