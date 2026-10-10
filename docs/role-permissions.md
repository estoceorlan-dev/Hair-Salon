# Proposed Role Permissions

This is a planning placeholder, not an approved policy or implemented authorization layer. Confirm it before Phase 3. Current employee/customer preview selection controls navigation only; it provides no authentication or server role enforcement.

**Legend:** Proposed = candidate access; Own = restricted to the user's own records; Assigned = restricted to assigned work; TBD = undecided; No = proposed restriction.

| Capability | Manager | Receptionist / cashier | Stylist / beautician | Customer |
| --- | --- | --- | --- | --- |
| Operational dashboard | Proposed | Limited/TBD | Assigned/TBD | No |
| Customer profile/history | Proposed | Proposed | Assigned/TBD | Own/TBD |
| Create/update customer records | Proposed | Proposed | TBD | Own/TBD |
| Book/reschedule/cancel appointments | Proposed | Proposed | Assigned/TBD | Own |
| View appointment schedule | Proposed | Proposed | Assigned | Own |
| Mark service progress/completion | Proposed | TBD | Assigned | No |
| Define services/prices | Proposed | No | No | No |
| POS and checkout | Proposed | Proposed | No | No |
| Refund/void sale | Proposed | No/TBD | No | No |
| View inventory | Proposed | TBD | TBD | No |
| Restock/adjust inventory | Proposed | No/TBD | No/TBD | No |
| View low-stock alerts | Proposed | TBD | TBD | No |
| Manage employee accounts/roles | Proposed | No | No | No |
| Manage payroll/commission rules | Proposed | No | No | No |
| Approve payroll / record payout | Proposed | No | No | No |
| View earnings | Proposed | Own/TBD | Own/TBD | No |
| View financial reports | Proposed | Limited/TBD | Own/TBD | No |
| Change system settings | Proposed | No | No | No |
| View business activity logs | Proposed | No | No | No |

Before implementation, decide whether stylist and beautician share a role, which actions need manager override, how customers identify themselves, how inactive employees lose access, and which sensitive fields each role can see. Pending decisions must not become permissive API defaults. The future API must deny undefined permissions and test record ownership.
