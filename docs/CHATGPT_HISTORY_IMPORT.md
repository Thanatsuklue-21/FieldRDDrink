# FIELD R&D ChatGPT History Import

## Current historical import

The reviewed batch in `src/field-chat-history.js` contains five stable-ID Trial
candidates. It is a provenance-labeled transcription of records already
confirmed in FIELD project sources, not a ChatGPT API integration. It does not
create sensory scores, trial dates, or evidence links that were not present in
the source. The Pure Matcha 5 g record remains `HOLD`; it cannot replace the
current 4 g Trial.

The History screen performs a read-only Cloud preflight through the signed-in
operator's existing `rd_sync` RPC. It shows each recipe, status, provenance,
new/duplicate/conflict totals, and requires a separate confirmation. The
confirmation re-reads Cloud, rejects changed/conflicting IDs, writes only new
records through the authenticated client and existing RLS-protected RPC, and
checks the returned Cloud collection before reporting success. Failed network
syncs leave the durable outbox intact for idempotent retry. Historical records
remain append-only; no import path updates or deletes an existing Trial.

Duplicate detection first uses stable IDs and then a conservative recipe
fingerprint based on the normalized menu and ingredient/gram pairs parsed from
the formula. If the app cannot confidently parse the meaningful ingredients,
it does not infer equivalence.

## Future ChatGPT import (not implemented)

FIELD R&D cannot read a user's private ChatGPT conversations on its own. A
future importer should accept a user-selected ChatGPT data export or an
explicitly shared conversation file, parse it locally, then show a provenance
review screen before creating any Trial. The parsed file must preserve source
conversation/message identifiers where available, quote or link evidence, and
represent unknown trial dates, scores, ingredient amounts, and approval states
as unknown. It must use the same stable-ID, duplicate/conflict, confirmation,
Auth/RLS, outbox, and readback guarantees as the current import. No automatic
background access or undocumented private-history endpoint is in scope.

Acceptance of that future path requires fixtures from a real user-provided
export with sensitive content removed, parser tests for malformed and partial
exports, and an explicit review of how export IDs map to stable Trial IDs.
