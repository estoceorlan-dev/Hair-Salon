# Role Access - Phase 3

Phase 3 implements this conservative access matrix. Undefined overrides and broader non-manager business access remain denied. Stylist and beautician are separate roles with the same initial own/assigned access. Grants live in PostgreSQL and are reloaded for every authenticated request; hiding navigation is an additional UI convenience.

| Capability | Manager | Receptionist / cashier | Stylist / beautician | Customer |
| --- | --- | --- | --- | --- |
| Dashboard | Sample operational view | Sample operational view | No salon totals | No |
| View appointment schedule | All | All | Assigned only | Own only |
| View customer service history | All via customer ID | All via customer ID | No | Own only |
| View personal earnings | Own only | No; policy TBD | Own only; undefined amounts remain null | No |
| Create/edit employee accounts, roles, active status, passwords | Yes | No | No | No |
| Register an account | Employee accounts via manager | Via manager | Via manager | Customer registration only |
| Change own password / sign out | Yes | Yes | Yes | Yes |
| Customer management | Page access; editing Phase 4 | Page access; editing Phase 4 | No | Profile edits future |
| Service catalog management | Page access; editing Phase 4 | No | No | No |
| POS | Sample cart; checkout disabled | Sample cart; checkout disabled | No | No |
| Inventory | Sample page; operational writes future | No; TBD | No; TBD | No |
| Payroll / financial reports / settings / logs | Placeholder page access | No; TBD | No | No |
| Book/reschedule/cancel or mark service progress | Future workflow | Future workflow | Future assigned workflow | Future own workflow |
| Refunds/voids/payments/payroll payouts | Disabled pending definition | Disabled | Disabled | Disabled |

The manager grants are `dashboard.view`, `customers.manage`, `appointments.manage`, `sales.manage`, `inventory.manage`, `employees.manage`, `payroll.manage`, `reports.view`, `settings.manage`, `logs.view`, `services.manage`, and `earnings.own`. Cashiers receive the first four. Stylists/beauticians receive `appointments.assigned` and `earnings.own`; customers receive `appointments.own` and `history.own`. A grant for a future module only reaches its 501 placeholder until the workflow is implemented; it never permits an undefined payment or financial operation.

Account management also checks the manager role. Manager account edits revoke affected sessions, and the last active manager cannot be demoted/deactivated. Inactive user/profile records lose access immediately. Customer registration always creates a fresh customer profile; claiming/linking an existing profile is not exposed.

Assigned appointment queries filter by the authenticated employee profile. Customer bookings/history filter by the authenticated customer profile. Other customer IDs and appointments outside that scope return 404. Financial history is not exposed to service staff. Personal commission reads contain the service snapshot and recorded commission fields only; they do not calculate earnings or reveal another employee's records.

Future decisions include cashier inventory/report access, service-progress updates, manager overrides, customer account linking, and payroll policies. See [authentication contracts](authentication.md) and [business definitions](business-rules.md).
