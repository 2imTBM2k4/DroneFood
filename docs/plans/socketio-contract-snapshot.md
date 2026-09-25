# Socket.IO contract snapshot

Date: 2026-09-23 (Asia/Bangkok)

This document freezes the observable Socket.IO contract before repository paths move. It records current behavior; it does not authorize event, payload, authorization, order-state, or GPS-policy changes.

## Connection authentication

The server middleware is `backend/server.js:40-53`.

- The access token is read first from `socket.handshake.auth.token` and otherwise from the `Authorization` handshake header after removing the literal `Bearer ` prefix (`backend/server.js:42`).
- A missing token fails the handshake with `Authentication required` (`backend/server.js:43`).
- The token is verified with `JWT_SECRET`. A decoded token whose `type` is `refresh` fails with `Access token required` (`backend/server.js:44-45`).
- The server loads the user by decoded `id`, selecting `role restaurantId locked`. A missing or locked user fails with `Unauthorized`; verification and other errors also become `Unauthorized` (`backend/server.js:46-52`).
- The loaded user is assigned to `socket.user`; room authorization is based on this database record, not client-supplied role data (`backend/server.js:46-49`).

Current clients put the access token in `auth.token`: Restaurant Web reads localStorage `token` (`restaurant/src/pages/Orders/Orders.jsx:122-123`), Restaurant Mobile uses its in-memory session token (`mobile/apps/restaurant-mobile/App.tsx:120-126`), Shipper Mobile uses its in-memory session token (`mobile/apps/shipper/App.tsx:414-418`), Customer Web uses `StoreContext.token` (`user/src/pages/OrderDetail/OrderDetail.jsx:123-125,153-155`), Customer Mobile uses its in-memory session token (`mobile/apps/customer/App.tsx:340-346`), and the three web notification navbars pass their access token through `shared/components/NotificationBell.jsx:70-95`.

## Client-to-server joins and rooms

All handlers are registered in `backend/server.js:55-71`.

| Event | Client payload | Authorization and resulting room |
| --- | --- | --- |
| `joinRestaurant` | `restaurantId` scalar | Joins `restaurant_${restaurantId}` only when `socket.user.role === "restaurant_owner"` and the authenticated user's `restaurantId` string equals the supplied value (`backend/server.js:56-60`). |
| `joinShipper` | none | Joins `shipper_${socket.user._id}` only for role `shipper` (`backend/server.js:61-63`). |
| `joinCustomer` | none | Every authenticated user may invoke it; the socket joins `customer_${socket.user._id}` (`backend/server.js:64`). Customer-only delivery data is still emitted only to the order owner's room as described below. |
| `joinNotifications` | none | Joins `restaurant_owner_${socket.user._id}` for `restaurant_owner`; all other roles join `${socket.user.role}_${socket.user._id}` (`backend/server.js:65-70`). Valid notification roles at creation are `user`, `restaurant_owner`, `shipper`, and `admin` (`backend/services/notificationService.js:5-10,65-68`). |

Room names are immutable string contracts: `restaurant_<restaurantId>`, `shipper_<userId>`, `customer_<userId>`, `restaurant_owner_<userId>`, `user_<userId>`, and `admin_<userId>`. `shipper_<userId>` is shared by order offers and shipper notifications.

## Server-to-client application events

| Event | Target room | Payload fields | Producers |
| --- | --- | --- | --- |
| `newOrder` | `restaurant_${restaurantId}` | A single `orderId` value, not an object. | Paid/zero-payable notification and COD placement in `backend/controllers/orderController.js:6-23,26-35`. Restaurant Mobile treats it as a refetch signal (`mobile/apps/restaurant-mobile/App.tsx:120-137`). Restaurant Web currently treats its argument as an order object (`restaurant/src/pages/Orders/Orders.jsx:131-135`); this producer/consumer mismatch is part of the baseline and must not be silently changed during a file move. |
| `shipperOrderOffer` | `shipper_${shipperId}` | Object with `orderId` and `expiresAt`. | Initial paid/COD offer in `backend/controllers/orderController.js:17-22,37-48`; extended search in `backend/controllers/shipperController.js:53-60`. Shipper Mobile uses it as an invalidation/navigation signal (`mobile/apps/shipper/App.tsx:414-422`). |
| `orderStatusUpdated` | `customer_${order.user}` | Object with `orderId`, `orderStatus`, `deliveryMethod`, `cancellationCode`, `reason`, `qrCode`, `qrScanned`, `cargoChecked`. Fields other than `orderId` may be absent/undefined according to the stored order. | `backend/utils/orderRealtime.js:6-24`, called after restaurant/admin status changes and shipper accept/pickup/arrive/complete flows. Customer consumers are `user/src/pages/OrderDetail/OrderDetail.jsx:153-181` and `mobile/apps/customer/App.tsx:340-355`. |
| `shipperLocationUpdated` | `customer_${order.user}` | Required: `orderId`, `location: { lat, lng }`, `updatedAt`. Optional: `route: { origin: { lat, lng }, geometry: [[lng, lat], ...], durationSeconds, generatedAt }`; `routeStatus` is `available` or `unavailable`. When status is `unavailable`, the stored route is deliberately omitted. | `backend/utils/orderRealtime.js:32-87`, called after an authenticated shipper location update at `backend/controllers/shipperController.js:14-17`. Consumers are `user/src/pages/OrderDetail/OrderDetail.jsx:159-180` and `mobile/apps/customer/App.tsx:357-386`. |
| `notificationCreated` | Notification room returned by `roomFor` | `{ _id, type, title, body, data, readAt, createdAt }`; `data` defaults to `{}`. `eventKey`, `recipient`, and `role` are persistence/deduplication inputs and are not emitted. | `backend/services/notificationService.js:7-20,65-77`. Web consumers join/listen in `shared/components/NotificationBell.jsx:70-95`. |

Socket.IO lifecycle event names used by clients are `connect` and `connect_error`; `connection` is used on the server. They are framework lifecycle events rather than application payloads, but their wiring must survive file moves.

## Customer GPS privacy and lifetime

The HTTP snapshot and live event enforce ownership independently:

- `GET /api/order/:id/customer-detail` requires an authenticated access token (`backend/routes/orderRoute.js:35-36`). `findCustomerDetail` queries by both `_id: orderId` and `user: userId`, so another customer receives the same not-found result as a missing order (`backend/repositories/orderRepository.js:40-47`; `backend/services/orderService.js:596-616`).
- HTTP tracking is returned only for a shipper delivery in one of two pairs: `orderStatus === "delivering"` with `shipperAssignmentStatus === "picked_up"`, or `orderStatus === "arrived_at_delivery"` with `shipperAssignmentStatus === "arrived"` (`backend/utils/orderRealtime.js:56-60`; `backend/services/orderService.js:619-640`). The shipper profile must also match the assigned shipper, `currentOrder`, and profile status `delivering` (`backend/services/orderService.js:622-627`).
- A live event re-queries the order by `currentOrder`, authenticated `shipperId`, and `deliveryMethod: "shipper"`, applies the same state-pair gate, and emits only to `customer_${order.user}` (`backend/utils/orderRealtime.js:62-87`). It is not broadcast to a generic customer, restaurant, admin, or shipper room.
- Before pickup no tracking is returned. Tracking remains allowed after arrival while the order is `arrived_at_delivery`/`arrived`. After completion, cancellation, assignment mismatch, or any other order-state pair, neither the HTTP helper nor the live emitter exposes a point because both paths apply `isCustomerTrackableShipperOrder` and the live query also requires the assigned `shipperId` (`backend/utils/orderRealtime.js:56-76`; `backend/services/orderService.js:619-627`). The integration tests directly cover HTTP tracking after pickup, HTTP tracking after arrival, HTTP suppression before pickup, emission only to the owner's room during active delivery, and suppression of a further live event after delivery (`backend/tests/integration/order.test.js:226-267,285-318,362-438`). Cancellation and assignment mismatch are code-gated but are not directly exercised by those integration cases.
- Invalid or missing coordinate pairs suppress tracking/event emission. Route geometry and timestamps are validated before a route is emitted (`backend/utils/orderRealtime.js:32-49,62-67`). Provider failure may retain the exact allowed GPS point while emitting `routeStatus: "unavailable"` and omitting the older route (`backend/utils/orderRealtime.js:77-87`; tests at `backend/tests/integration/order.test.js:320-360,440-483`).

### Staleness behavior currently implemented

`updatedAt` is an age indicator, not an exposure cutoff. The customer-detail helper does **not** compare `locationUpdatedAt` to the 90-second `LOCATION_STALE_MS`, and both web/mobile consumers display or store the supplied timestamp without hiding the point by age (`backend/services/orderService.js:619-640`; `user/src/pages/OrderDetail/OrderDetail.jsx:93-95,159-175`; `mobile/apps/customer/App.tsx:357-379`). The integration baseline intentionally returns timestamps older than 90 seconds (`backend/tests/integration/order.test.js:226-267,285-318`).

The separate 90-second freshness rule in `backend/services/shipperService.js:13,45-49,176-180` gates shipper availability/offer selection and is not currently applied to customer tracking. A structural refactor must preserve this distinction. Adding a customer-side staleness cutoff would be a behavior/privacy change requiring separate approval and tests.
