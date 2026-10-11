# Phase 4 — Master records and settings

Phase 4 adds persisted customer, service, employee profile/availability and manager settings workflows. Apply migration `005_master_data.sql` with `npm run db:migrate` (and `-- --target=demo` for the separate demo database). It adds employee contact/notes fields, receipt and payroll-period configuration keys, and catalog/customer indexes; existing records are preserved.

## Screens and access

- **Customers:** managers and receptionists/cashiers can search, filter, paginate, create and edit contact information, notes, preferred staff and active status. History shows completed paid transactions using immutable item snapshots, with pagination.
- **Services:** managers can create/edit codes, names, categories, optional prices/durations, active status and eligible staff. Deactivation is the supported removal operation; historical references remain intact.
- **Employees:** managers use Profiles & availability for contact details, nullable base-pay and commission inputs, and explicit availability/time-off intervals. Accounts & roles retains account creation, role/password changes, active status, last-manager protection and session revocation. Both lists have search, status filters and pagination.
- **Settings:** manager-only opening hours, closures, booking policy, receipt details, tax/discount configuration, base-pay basis, default commission and nonoverlapping payroll periods. Currency/timezone remain PHP and Asia/Manila. All payment labels remain disabled; neither UI nor API can enable them.
- **POS/customer portal:** both read the same active service catalog. Prices without definitions are not treated as zero. POS excludes unpriced services from the cart. The portal shows current eligible staff and no simulated availability slots. Navigation, reload, manual refresh and window focus fetch fresh catalog data; a refreshed POS cart resolves current prices and excludes deactivated/unpriced services.

## Data rules

Names, prices and durations are validated on the server. Money is supplied in integer centavos and returned as PostgreSQL BIGINT strings. Blank optional values are stored as null. Existing demo services retain their demo label. No prices, tax rates, pay amounts or commissions are automatically invented.

Possible duplicate customers are detected using case-insensitive exact names/emails or phone digits with punctuation removed, including inactive profiles. A create or changed identity matching another profile returns `409 DUPLICATE_CUSTOMER` and up to ten matching IDs/names. Staff can open/search those records, or submit a reason of at least ten characters to keep a separate profile; that decision is audited. Concurrent submissions are serialized. No automatic merge or account linking occurs. Editing a customer's contact email does not change the login email; deactivating a linked profile revokes its sessions.

New preferred staff and service assignments must reference active stylists/beauticians. Historical preferences may retain an inactive employee. Availability intervals require explicit offsets, start before end, and no overlapping entries for that employee; concurrent inserts serialize on the employee row. The UI sends Manila `+08:00` timestamps. Remove an interval before replacing it. Existing appointments are not moved or cancelled by configuration edits.

Hours support undefined, demo or manager-confirmed definitions. Undefined hours have no opening/closing times. A closed day has no times; an open day requires closing after opening. Closure dates must be valid and unique. Payroll date ranges are inclusive and cannot overlap. Financial configuration is stored for future workflows, not used to calculate or post sales, commissions or payroll in this phase.

Master-record and sensitive-setting mutations write an actor/action/reference/time audit record in the same transaction. Settings, service and financial-profile changes include before/after details. Customer logs record changed field names and duplicate decisions, avoiding unnecessary copies of contact notes. Availability removals and closure removals retain the removed details in the append-only audit. The audit viewer remains Phase 8.

## API contracts

All routes below require the existing HttpOnly session. Writes require a trusted Origin, `X-Romel-Request: browser`, and JSON (including `{}` for DELETE). Unknown body fields and invalid values return 422; missing records return 404; duplicate codes/dates and invalid relationships return 409. Writes either commit together with their audit or roll back.

| Route | Methods | Access / result |
| --- | --- | --- |
| `/api/customers` | GET, POST | Manager/cashier; list or create a walk-in profile |
| `/api/customers/:id` | PUT | Manager/cashier; full editable profile replacement |
| `/api/customers/:id/history` | GET | Manager/cashier or the owning customer only |
| `/api/services` | GET, POST | Manager catalog maintenance |
| `/api/services/:id` | PUT | Manager; full editable service replacement including eligible employee IDs |
| `/api/catalog` | GET | Manager/cashier/customer; active services and public eligible-staff names/IDs only |
| `/api/staff-options` | GET | Manager/cashier; active service staff IDs/names for preferences/assignments |
| `/api/employee-profiles` | GET | Manager; employee profile list |
| `/api/employee-profiles/:id` | PUT | Manager; phone, notes, basePayCents and commissionPolicy |
| `/api/employee-profiles/:id/availability` | GET, POST | Manager; list or add an interval |
| `/api/availability/:id` | DELETE | Manager; audited interval removal |
| `/api/employee-accounts` | GET, POST | Existing manager account workflow, now paginated |
| `/api/employee-accounts/:id` | PATCH | Existing manager role/password/status workflow |
| `/api/settings` | GET, PUT | Manager; read configuration or replace one allowlisted key/value/definitionState |
| `/api/settings/hours` | PUT | Manager; replace all seven distinct weekdays atomically |
| `/api/settings/closures` | POST | Manager; add date/reason |
| `/api/settings/closures/:id` | DELETE | Manager; audited closure removal |

Lists accept `page` (default 1) and `pageSize` (default 20, max 100); master lists accept `q`, `status=all|active|inactive`, and service/catalog lists also accept exact `category`. Responses contain `items`, `total`, `page`, `pageSize`; accounts retain `employees` and history retains `history` for compatibility. Catalog always filters active services. Staff options returns all active service staff for selectors. Existing `/me/history` retains its Phase 3 limit of 100 records.

## Verification and boundaries

`npm run test:db` includes six Phase 4 integration scenarios covering permissions/CSRF, strict validation, customer duplicate review and simultaneous requests, pagination/history ownership, catalog eligibility/deactivation, profile inputs, concurrent availability conflicts, settings/hours/closure/period validation, payment denial, audit entries and a new API instance reading saved records. It resets only the dedicated test database.

Headless Chrome smoke checks exercised customer create/edit/reload/history, service creation appearing in POS and customer choices, employee base pay and availability, settings/closure persistence, customer route denial, and 390px layouts for all four management screens. No browser exceptions were observed. Local smoke script/screenshots are in ignored `.local-runtime/ui-check/phase4-*`.

Booking availability calculation and saved reservations are Phase 5. Products/inventory are Phase 6. Checkout, financial policy application, receipts and commissions are later phases. Payment enablement remains separately deferred. Current configuration is ready for those workflows without claiming they are implemented.
