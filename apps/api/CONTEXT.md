# API context — drone delivery approval

## Model and transitions
`Branch.droneDeliveryApplication` is a private application snapshot. It includes address/coordinates, contact name/phone, handover notes, submission identifier/time/actor and the latest review reason/time/actor.

- Missing application means `not_registered`; old enabled flags do not imply approval.
- An owner or assigned manager can submit from `not_registered` or `rejected` into `pending`.
- An administrator reviews an exact pending `submissionId` into `approved` or `rejected`, with a required reason.
- Concurrent/stale submissions and decisions return a conflict; they do not replace a pending/approved profile.
- `droneDeliveryEnabled` is a separate operational switch. Approval never enables it. Enabling requires approved status; disabling retains approval.
- Submission/review decisions use the existing audit trail, with submission ID and reason. Existing audit writes are best-effort, not transactional.

## Access and privacy
- `GET /api/branch/managed`: branches owned by or assigned to caller. Lazily ensures an existing legacy owner's Merchant/MAIN mapping.
- `GET/POST /api/branch/:id/drone-application`: private read/submission, authorized through `requireBranchAccess`.
- `POST /api/branch/:id/drone-application/decision`: administrators only.
- `GET /api/branch/admin/list`: administrators only; supports `applicationStatus` filter.
- Public detail/list/nearby and public merchant branch data exclude the entire application. Aggregations explicitly remove it; the model excludes it by default.
- General branch create/update APIs do not accept approval or operation fields.

## Checkout compatibility
Quote and order placement share `resolveCheckoutLocation`. The cart is authoritative for its restaurant/branch. Drone checkout requires an operational branch, active merchant, approved application and enabled switch; a missing mapped branch is denied, never grandfathered. Legacy restaurant checkout also checks its original opening hours/lock and any existing MAIN branch/merchant operational state.

The operation switch is checked only for new checkout. It must not cancel/change received orders or prevent drone assignment to them.

## Legacy mapping
See [ADR](docs/adr/0001-branch-drone-application.md). The lazy mapping preserves Restaurant IDs, deterministic MAIN branch IDs, old user roles and dependent food/cart/order/wallet records. It never runs the bulk migration. Existing mappings are reused, not overwritten.

## PayOS payment confirmation
See [ADR 0002](docs/adr/0002-payos-on-demand-reconciliation.md). The signed webhook and authenticated on-demand verification share one conditional payment claim. Ownership is checked before querying PayOS; browser redirect parameters are not evidence. Only pending unpaid PayOS orders are queried, with bounded gateway timeout and no background sweep. Only the first confirmation starts delivery/assignment; late payments preserve cancelled/final states and require manual review rather than automatic refund. Unpaid cancellation requires gateway confirmation and an unpaid conditional update. Customer confirmation emits `orderStatusUpdated`.

## Out of scope
Brand upgrade, manager account creation, per-branch food availability, airspace zones, new drone selection algorithms and actual flight operations.
