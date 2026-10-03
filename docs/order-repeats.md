# Linked work repetitions

Internal order staff can repeat a sent work order using a brief reason and up to three optional photos. The original status, debt, payments and invoices are not changed. The child starts in design with new approval records and a new catalogue-based delivery commitment.

- Warranty: child subtotal, IGV, total and line prices are zero. `repeat_reference_total` is the current catalogue value, **not** production cost or debt.
- Paid: current catalogue price × original units (normal IGV-inclusive pricing); staff acknowledge that the charge was agreed with the clinic. No old discount or express surcharge is inherited.
- Patient, clinic, product and clinical selection are copied. Corrective instructions belong in the required reason. Responsibility, payments, invoices, files and design approvals are never cloned.
- The request UUID is bound to source, actor, type, reason, amount and photo hashes. Replaying identical input returns the same child; a new intentional repetition has a new UUID.

## Deployment

Apply `backend/src/db/migration_935_order_repeats.sql` on a backed-up staging database first, then production through the approved migration process. Deploy the backend and frontend together after the schema exists. The application has not executed this migration on the VPS.

Photos use dedicated PostgreSQL BYTEA rows (max 3 × 5 MB per repetition), with staff-only authenticated attachment downloads, no-store and nosniff. They are never placed in public uploads or Supabase public storage, and binary content is excluded from detail/list responses. No extra VPS filesystem volume is needed. Allow a 15 MB multipart request at the proxy (including form overhead, e.g. 16 MB) and budget database/backups accordingly. Backup access must remain private. Encoded image containers are validated; this is not a full malware scan or image re-encoding service.

Evidence has RLS enabled with no browser policies; direct PUBLIC/anon/authenticated table grants are revoked. The backend database connection must be the table owner or an appropriately privileged server-only role; verify insert/download with that connection in staging. Never grant evidence access to browser/PostgREST roles to resolve a deployment issue.

The previously discussed **60-day HTML retention is not applied to these photos**. The Exocad HTML viewer is outside this change.

## Verification and rollback

From repository root:

```text
node --test backend/src/modules/orders/orderRepeats.test.js
node --test frontend/src/modules/orders/orderRepeat.test.js
```

Tests use isolated transaction doubles and local HTTP servers, not the production database. Before deployment, verify migration/trigger and concurrent UUID replay against a disposable PostgreSQL database, then manually check the modal/navigation on desktop and mobile.

Rollback boundary: the repeat domain/repository/service/upload module, migration 935, dedicated frontend modal/links/helpers/styles/tests, and their integration points in order service/controller/routes/detail. Roll back application code first; preserve existing repeat columns/photos and records. Removing the sent-order protection trigger permits old rollback behavior again. Do not delete child orders or photos to roll back an application deployment.
