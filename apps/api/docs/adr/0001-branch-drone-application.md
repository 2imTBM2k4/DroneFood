# ADR 0001 — Branch-scoped drone delivery approval

Status: accepted by phase-1 requirements.

## Context
All independent restaurants and brand branches must register for drone delivery. Existing legacy Restaurant data cannot grant permission through an enabled flag or be bulk-migrated without inspection. The feature must reuse Branch and the existing audit trail, without a separate application collection.

## Decision
Store a private application snapshot on Branch, independent from `droneDeliveryEnabled`. Use an exact submission ID and conditional atomic state transition for each submission/review. Use existing audit logging for decision history.

Resolve checkout location and eligibility in a shared function for quote and order placement, including legacy Restaurant IDs. New drone orders fail closed when no approved/enabled Branch exists. Existing accepted orders are independent of later switch changes.

For a legacy owner accessing managed locations, reuse or lazily create only the Merchant/MAIN mapping for that owner's existing restaurant. Extract the pure mapping functions from the existing migration into a shared utility so IDs and baseline fields stay compatible. Preserve old roles and all dependent records. Do not run the migration or clone Restaurant records.

## Consequences
No grandfathering or automatic enablement. No new model or dependency. Explicit private endpoints provide the application, while public responses omit it even on aggregation paths. Legacy and new data coexist until a separately authorized migration. Audit keeps its current best-effort semantics; atomic state transitions prevent duplicate decisions but do not make audit writes transactional.
