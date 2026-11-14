# FIELD R&D — Next Development Roadmap

Ordered by value to a solo café R&D workflow. Each item keeps the existing
guarantees: Supabase Auth + RLS, append-only Trials, stable IDs, review-before-save,
outbox + Cloud readback, and no invented scores, dates or LOCK states.

## 1. Close PR #11 (now)
- Hosted acceptance with the owner account (History → ตรวจสอบ → เลือก → ยืนยัน →
  readback → refresh → sign out/in → second device). Record evidence in
  FIELD_MASTER_CONTROL_LIVE.
- Decide per row for `possibleDuplicates` (ML-01 ↔ Matcha Latte syrup 15 g,
  PM-02 ↔ Pure Matcha historical 5 g). Default is "do not import".

## 2. ChatGPT Data Export importer (user-supplied file only)
- Accept the official export ZIP / `conversations.json` (newer exports may be
  sharded as `conversations-000.json` …). Parse locally in the browser.
- Each conversation stores messages as a `mapping` graph with parent/child
  links because edits create branches; walk from `current_node` to the root to
  get the active branch, and keep other branches out of candidates.
- Candidate extraction is suggestion-only: grams, °C, seconds, menu names.
  Every candidate keeps provenance `{conversation_id, message_id, create_time,
  quoted excerpt}`; stable Trial ID = hash of (conversation_id, message_id,
  menu). Unknown dates/scores stay empty.
- Reuse `previewFieldChatHistory`-style planning (stable ID → fingerprint →
  possible duplicate → conflict) and the same confirm + `rd_sync` path.
- Fixtures: a sanitized real export; parser tests for malformed/partial files.

## 3. Structured sensory data
- Overall liking on the 9-point hedonic scale (1 dislike extremely … 9 like
  extremely) per tasting time T0/T5/T10/T15.
- Just-About-Right 5-point scales for sweetness, matcha intensity, milkiness,
  bitterness, dilution. With ≥ 2 tasters, add penalty analysis (mean liking
  drop when "too much / too little").
- Store raw ratings per taster, never only averages; keep free-text notes.

## 4. Recipe model instead of free-text formula
- `ingredients: [{ingredientId, grams, tempC?, role}]` linked to the existing
  ingredient master. Enables exact duplicate detection, cost per cup, and
  "changed variable" diffs between Trials automatically.
- Keep `formula` text for display/back-compat; derive it from the structure.

## 5. Ops hardening
- Run Supabase Security Advisor (`supabase db advisors`) in CI next to the
  PGlite migration test.
- Pin `latest` dependencies in package.json to exact versions (lockfile exists,
  but explicit ranges make upgrades reviewable). Align CI pnpm version with the
  lockfile.
- Add a Playwright mobile smoke test (Android viewport) for the import flow.
