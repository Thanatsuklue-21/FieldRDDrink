# FIELD R&D Lab

Separate beverage R&D application for FIELD Café.

## Current guarantees

- Immutable-by-UI experiment history: saved trials have no edit/delete controls.
- Evidence states distinguish `SENSORY_LOCKED` from production `LOCKED`.
- Production LOCK requires T0/T5/T10, exact ingredient/SKU snapshot, repeatability, dilution, cup/ice, costing, SOP and QC readiness.
- Ingredient Master surfaces known identity and missing evidence instead of guessing.
- Browser storage migrates v1/v2 records to v3, preserving FIELD sensory evidence and correcting unperformed ML-02 to `PLANNED`.
- Backups export trials plus Ingredient Master.
- CI runs tests and production build.

## Storage

The current release remains device-local. Hosted R&D database, authenticated multi-device sync, durable server-side audit history and outbox recovery are still separate production work. FIELD POS data/database must not be reused.

## Development

```bash
npm install
npm test
npm run build
```
