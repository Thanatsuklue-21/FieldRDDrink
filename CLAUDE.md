# CLAUDE.md — FIELD R&D Lab

Claude Code reads this file at the start of every session. Keep it short and current. When a decision below changes, update this file in the same PR.

## What this is
FIELD R&D Lab is the drink-recipe trial app for FIELD, a solo-run drink shop in Lat Lum Kaeo, Pathum Thani. It is live at field-rd-drink.vercel.app. The UI is Thai.

- Stack: Vite + React (`src/`), Vercel API routes (`api/`), optional Supabase cloud sync (`supabase/`).
- This app is separate from FIELD POS (`Thanatsuklue-21/field-pos`). **Never reuse POS data or the POS database.**

## Read first
- `README.md`: guarantees, storage, Research Hub and Coach.
- `docs/CLOUD_SYNC_SETUP.md` and `docs/DEVICE_IMPORT_SAFETY_2026-11-01.md` before any storage, sync or import work.
- `docs/RD_ROADMAP.md` and `docs/PRODUCTION_PLAN.md` before new features.

## Commands
- `npm install` → `npm test` (node --test `tests/*.test.mjs`) → `npm run build`.
- `npm run dev` for local work.

## Evidence rules (never weaken)
- **Saved trials are immutable.** Do not add edit or delete controls for them. A correction is a new trial.
- `SENSORY_LOCKED` is not the same as production `LOCKED`.
  - Production LOCK needs: T0/T5/T10, an exact ingredient/SKU snapshot, repeatability, dilution, cup/ice, costing, SOP and QC readiness.
  - Never auto-promote a trial to LOCK.
- Never change a `SENSORY_LOCKED` or `LOCKED` formula automatically. AI suggestions stay `PLANNED` and change one variable at a time.
- Internet evidence (papers, YouTube, Lemon8, AI summaries) can never PASS or LOCK a FIELD formula on its own. Imported evidence stays **unverified** until the owner reviews it.
- Never invent numbers.
  - A trial with no structured score is shown as "needs scoring". Do not fill in scores.
  - A missing measurement is shown as missing, not guessed.
- The tasting truth is the trial recorded on the original device plus a verified backup. A seed recipe or a remembered formula is not truth.
- Import must not overwrite data:
  - It must be immutable-ID aware and must reject conflicts.
  - Restore always keeps a pre-import recovery snapshot.
- Cloud sync is opt-in and isolated per account. Never upload local records automatically.
- Passing tests and a build do not prove the hosted database works on real devices. Write `NOT VERIFIED` until a device test passes.
- Never commit keys, `.env` files, trial backups or customer data.

## Shop facts recipes must use (owner-approved, Nov 2026)
- **Cup:** 16 oz straight PET cup, 98 mm rim. Tube ice shop-wide. Cup weight must match the owner's measured average; the app currently uses 230 g, the POS 210 g, and these must be reconciled.
- **Equipment:**
  - Duchess CM1480B (58 mm, tea only).
  - Apresso NOVA + AIO+ grinder (coffee only).
  - Kettle set to 70 °C.
- **Shots:** 20 → 40 g in 25–30 s by default. Medium roast only for now.
- **Pure Matcha:** Yamito **4 g**, 40 g water at 70 °C, whisk 30 s, no syrup. This is `SENSORY_LOCKED`; do not change it to 5 g.
- **Matcha latte:** test 5 g against 4 g in a blind tasting.
- **Coconut drinks:**
  - Senorita (Mitr Phol) Nam-Hom coconut syrup + water. No fresh coconut water.
  - Coconut Americano: 20 g syrup + 120 g water + shot.
  - Coconut matcha: 5 g matcha, 40 g water at 70 °C, 20 g syrup, 105 g water.
- **Condensed milk:** Carnation Plus is sweetened condensed milk (65% milk), not creamer. Check the label on each lot.
- **Sweetness:** `หวาน` 100% · `หวานน้อย` 50% · `ไม่หวาน` 0%. Do not use the word "ปกติ".
- **Opening menu (12):**
  - อเมริกาโน่
  - ลาเต้
  - เอสเย็น
  - กาแฟโบราณ (made from fresh beans through the machine, not boran powder)
  - ชาใต้
  - เพียวมัทฉะ
  - มัทฉะลาเต้
  - มัทฉะมะพร้าว
  - อเมริกาโน่มะพร้าว
  - โกโก้ (instant)
  - บ๊วยโซดา
  - อเมริกาโน่ร้อน

  No blended drinks.
- **Costing:**
  - Prices are 40–60 THB.
  - Any promo must leave profit ≥ 25 THB/cup.

## Working style
- Reply to the owner in Thai: short, practical, numbers first.
- Make small PRs with tests, one concern per PR.
- When sources conflict, mark it `CONFLICT` with dates and stop. Do not guess.
