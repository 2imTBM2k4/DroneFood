# Repository restructure Phase 2B: mobile contracts and API client

Date: 2026-09-23 (Asia/Bangkok)

## Goal and scope

This phase makes the existing mobile packages accurate and proves one low-risk
consumer boundary. It does not move files, change backend responses, or alter
authentication, query keys, payment, order-state, notification, or GPS behavior.
The in-progress Customer Mobile redesign remains untouched.

## Source evidence

- `backend/app.js` mounts `backend/routes/configRoute.js` at `/api/config`.
- `backend/routes/configRoute.js` handles `GET /fees` and returns a top-level
  object: `{ success: true, ...getDeliveryRates() }`.
- `backend/config/fees.js` defines the expanded fields as
  `shipperRatePerKm`, `droneRatePerKm`, `currency: "VND"`, and `serviceFee`.
- Before this phase, `DeliveryFees` instead declared `shipper` and `drone`, and
  `getDeliveryFees()` passed this endpoint through the generic `{ data }`
  unwrapping path. A successful call therefore returned `undefined` at runtime.
- Backend validation and the order model accept exactly `"shipper"` and
  `"drone"` for `deliveryMethod`. The shared `DeliveryMethod` contract already
  describes the same pair.

## Public package API

`@drone-food/contracts` keeps the existing `DeliveryFees` name while aligning
its fields with the backend response:

```ts
interface DeliveryFees {
  shipperRatePerKm: number;
  droneRatePerKm: number;
  currency: "VND";
  serviceFee: number;
}
```

`DeliveryMethod` remains the union derived from the exported
`deliveryMethods` tuple: `"shipper" | "drone"`.

`@drone-food/api-client` keeps its public methods and endpoint paths. Generic
methods still unwrap normal `{ success: true, data }` responses. Only
`getDeliveryFees()` reads the fee endpoint's documented top-level shape and
returns the four fee fields without the transport-only `success` flag.

## Adoption decision

Restaurant Mobile now declares `@drone-food/contracts` as a workspace
dependency and uses `DeliveryMethod` for `Order.deliveryMethod`. This is a
type-only replacement of an identical local union; emitted runtime behavior and
order rendering remain unchanged.

No active application adopts `@drone-food/api-client` in this phase. Customer
Mobile is the only current app with broad API calls matching the package's
intended surface, but its source is under an in-progress redesign. Its Axios
client also implements Customer-specific SecureStore keys, refresh-token
single-flight retry, and session-expiry callbacks that the fetch-based shared
client does not provide. Replacing that client would change authentication and
error behavior. Restaurant and Shipper do not currently consume the fee,
address-book, or generic food-list helpers. Adding an unused client instance
would be dead code rather than real adoption.

## Anti-pattern guards

- Do not change `/api/config/fees` or add a second backend response envelope to
  accommodate a client parser.
- Do not replace an app's Axios facade until token refresh, storage keys, error
  messages, cancellation, and response shapes have parity tests.
- Do not import source files from `mobile/packages/*`; consume package exports.
- Do not duplicate `DeliveryMethod` in new mobile DTOs.
- Do not broaden shared contracts from visually similar DTOs without checking
  the backend route, validation, and serialized response.
- Do not add package dependencies to an app until active source imports them.

## Verification

Run from the repository root unless a command supplies a prefix:

```powershell
npm.cmd run test --workspace=@drone-food/api-client
npm.cmd run build --workspace=@drone-food/contracts
npm.cmd run typecheck --workspace=@drone-food/contracts
npm.cmd run build --workspace=@drone-food/api-client
npm.cmd run typecheck --workspace=@drone-food/api-client
npm.cmd run typecheck --workspace=@drone-food/customer-mobile
npm.cmd run typecheck --workspace=@drone-food/restaurant-mobile
npm.cmd run typecheck --workspace=@drone-food/shipper-mobile
npm.cmd run export:android --workspace=@drone-food/customer-mobile
npm.cmd run export:android --workspace=@drone-food/restaurant-mobile
npm.cmd run export:android --workspace=@drone-food/shipper-mobile
npm.cmd test --prefix backend -- tests/unit/fees.test.js
npm.cmd ci --dry-run
git diff --check
```

The API-client test uses a real `Response` object with the backend's top-level
JSON shape. It proves the regression directly without copying the parser into
the test. A second case proves that existing `{ success, data }` methods still
unwrap their response exactly as before.

### Result on 2026-09-23

- API-client regression suite: **PASS**, 2 tests.
- Contracts and API-client build/typecheck: **PASS**.
- Customer, Restaurant, and Shipper Mobile typecheck: **PASS**.
- Customer, Restaurant, and Shipper Android export: **PASS**.
- Existing backend fee unit suite: **PASS**, 2 tests.
- Root `npm.cmd ci --dry-run`: **PASS**. The dry-run reports the expected
  workspace-link rename reconciliation from Phase 1 (`customer`, `shipper`, and
  `restaurant-mobile` to their `@drone-food/*` names) without writing files.
- `git diff --check`: **PASS**. Git reports existing LF-to-CRLF notices only.

## Rollback

1. Restore Restaurant Mobile's local `"drone" | "shipper"` property type and
   remove its `@drone-food/contracts` dependency.
2. Restore the previous `DeliveryFees` fields and the previous
   `getDeliveryFees()` implementation.
3. Remove the API-client test script and test file.
4. Regenerate the root lockfile so it matches the restored manifests.

No backend, Customer Mobile, payment, order-state, notification, or GPS source
needs to change during rollback.
