# Foundation Preview Guide

## Current milestone

1. Start `npm run dev:all` and open `http://localhost:5173`.
2. Choose **Preview employee workspace**. The entry screen intentionally collects no credentials.
3. Review the existing sample Dashboard, Appointments, and Inventory screens.
4. Navigate Customers, Services, Employees, Payroll, Reports, and Activity Logs. Each has its own placeholder URL/page.
5. Open Settings. After `db:local:setup`, the API and data storage should report connected; screens still show preview records.
6. Open POS, search/add sample items, and review the estimated subtotal. Tax remains undefined. Cash, GCash, Maya, card, and the payment action are disabled.
7. Reload `/app/pos` to verify routing. The preview mode survives in this browser tab; the sample cart is intentionally not saved.
8. Exit the preview, then choose **Preview customer booking**. Select sample service/date/time and review the selection. The screen explicitly confirms nothing has been reserved or saved.

No real sign-in, payments, receipts, reservations, operational inventory updates, or payroll calculations are demonstrated yet. PostgreSQL holds separate fictitious fixtures and hashed-password demo accounts for later integration. Request logs describe API traffic; they are not the database business event workflow.

## Later persisted presentation (Phases 2-10)

After policies and fixtures are agreed: authenticate by role -> create/review a booking -> complete service -> perform the approved checkout -> show receipt, stock/history/commission changes -> generate reconciled sales reports and payroll -> restart and verify persistence. Exact demo dates, amounts, consumption quantities, rates, and expected results remain placeholders.
