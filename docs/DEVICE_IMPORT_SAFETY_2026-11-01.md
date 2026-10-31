# Cross-device R&D safety: controlled manual exchange (2026-11-01)

## Important state
This is **not** online cross-device sync. R&D Trials and Evidence still live in browser storage. The UI now displays this on every page, rather than only on Dashboard. Hosted dedicated R&D DB/auth/outbox remains [Issue #8](https://github.com/Thanatsuklue-21/FieldRDDrink/issues/8).

## Safe workflow before the hosted DB exists
1. On each device independently choose **สำรองข้อมูล**, retaining a copy (never share backup in public GitHub/issues; it may contain business research).
2. On the destination device use **รวมข้อมูลจากอีกเครื่อง (ไม่ทับ)**.
3. Imported trials and evidence with **new IDs** are appended; identical IDs+data are idempotently skipped. If an existing ID has different content, the entire import is rejected; it neither overwrites nor silently chooses a winner.
4. A local recovery snapshot is saved before applying the merged collection with existing verified two-key transactional rollback helper.
5. Repeat export/import for the other device. This is manual exchange; if you create new Trial offline on either device afterward, they diverge again until a new exchange.

## Limitations / explicit failure paths
- Browser localStorage is not a server database, not tamper-proof, and simultaneous tab writes are not transactionally serialized. Do not infer cross-device freshness from this feature.
- A conflict must be reconciled from original trial records by a human. Never change an approved Trial or Evidence in place as an automatic "fix".
- Existing **กู้คืนแบบแทนข้อมูล** still exists for deliberate full Restore, with its previous backup/rollback protection. It must not be mistaken for safe merge.
- This does not change production-lock semantics or erase previously stored data.
- Never enable automatic migration or force import without verified backups and owner authorization.

## Verification
New node unit tests cover insert, replay, object key order, ID duplicates, conflicts and Evidence. Full existing `npm test` and `npm run build` must pass in CI before merge. Real PC/phone/tablet exchange and recovery remain manual acceptance gates.
