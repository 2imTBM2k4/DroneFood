# Multi-Restaurant Carts and Explore UI Design

**Date:** 2026-09-25  
**Status:** Proposed for implementation  
**Scope:** Customer API, customer web, and customer mobile

## 1. Purpose

Allow one customer to keep items from multiple restaurants without mixing them into one order. Each restaurant has an independent cart, detail view, and checkout. Completing one checkout must never remove or mutate another restaurant's cart.

This work also completes the previously requested customer-mobile Explore changes:

- remove the voucher-success notification;
- keep the active-order indicator compact and limited to Explore;
- remove the floating cart bar from Explore;
- move the active-order indicator to the floating bar position above the bottom navigation;
- keep the delivery address and search controls visible while scrolling;
- use a light liquid-glass surface at the top of Explore, then compact it and transition it toward the restaurant-list background as the user scrolls.

## 2. Confirmed Product Decisions

- A customer can have at most one cart per restaurant and any number of restaurant carts.
- The cart index is ordered by most recently updated cart first.
- Each cart card displays only the restaurant name, total item quantity, estimated delivery time, and distance.
- Item quantity is the sum of line quantities, not the number of distinct lines.
- No global total item count or subtotal is shown on the cart index.
- Without a selected delivery address with valid coordinates, a card displays only the restaurant name and item quantity.
- A closed restaurant's card shows `Quán đang đóng cửa` beside the item quantity. The customer may inspect, edit, or delete the cart but may not request a quote or place an order.
- The navigation cart badge displays the number of non-empty restaurant carts.
- On both web and mobile, the whole card opens its cart detail. There is no separate `Chi tiết` button.
- Checkout creates an order for one selected cart. Other carts remain unchanged.
- Adding an item from a new restaurant creates another cart without a replace-cart prompt.

## 3. Data Model

Each MongoDB `Cart` document represents one customer's cart at one restaurant:

```text
Cart
  _id
  userId
  restaurantId
  items[]
  createdAt
  updatedAt
```

The existing item structure, option snapshots, notes, line keys, and server-side price calculation remain authoritative. `restaurantId` becomes a required top-level reference instead of being inferred from the first populated food item.

A compound unique index on `{ userId: 1, restaurantId: 1 }` guarantees one cart per customer/restaurant pair. Empty carts are deleted rather than retained.

Distance and ETA are derived values and are not stored on the cart. Restaurant open/closed status is also evaluated when the cart list or detail is requested.

### Legacy migration

Before creating the compound index, a migration will:

1. Load each legacy cart and populate its food references.
2. Remove carts that contain no valid items.
3. Derive `restaurantId` from the first valid line.
4. Verify that all remaining lines belong to that restaurant. Any inconsistent document is logged and preserved for manual inspection rather than silently deleting items.
5. Set the cart's top-level `restaurantId` and then create the compound unique index.

The existing model prevents mixed-restaurant legacy carts, so normal legacy documents migrate one-to-one.

## 4. API Design

All cart routes require customer authentication.

### Cart index

`GET /api/cart?addressEntryId=<optional>` returns:

```json
{
  "success": true,
  "carts": [
    {
      "cartId": "...",
      "restaurant": {
        "id": "...",
        "name": "...",
        "isOpen": true
      },
      "itemCount": 3,
      "distanceKm": 4.2,
      "etaMin": 25,
      "updatedAt": "..."
    }
  ],
  "cartCount": 1
}
```

`distanceKm` and `etaMin` are `null` when no valid selected address is supplied or when coordinates are unavailable. A coordinate failure for one restaurant must not fail the full cart list.

Distance uses the selected delivery address and the restaurant coordinates. ETA uses the same general estimate and formatter as the Explore restaurant cards. Exact shipping distance, method, and price remain part of checkout quote calculation.

### Cart detail and mutations

- `GET /api/cart/:cartId` returns one fully serialized cart and restaurant state.
- `POST /api/cart/add` accepts the existing food/options/note payload. The server derives the restaurant from the food and atomically finds or creates `(userId, restaurantId)`.
- `POST /api/cart/:cartId/update-line` updates a line in that cart.
- `POST /api/cart/:cartId/remove-line` removes a line and deletes the cart when its final line is removed.
- `DELETE /api/cart/:cartId` clears only that cart.

Every detail and mutation query includes both `_id: cartId` and `userId: authenticatedUserId`. A cart belonging to another user is indistinguishable from a missing cart and returns `404`.

Legacy routes may be retained only where their meaning is unambiguous. The old single-cart `GET`, clear, quote, and placement behavior must not choose an arbitrary cart.

### Quote and order placement

`POST /api/order/quote` and `POST /api/order/place` require `cartId`. The server ignores client-supplied item prices and restaurant identifiers, then:

1. Loads the selected cart scoped to the authenticated user.
2. Verifies that it is non-empty and every populated food belongs to the cart's restaurant.
3. Verifies the restaurant exists, is approved, and is currently open.
4. Calculates the delivery quote and validates vouchers for this cart only.
5. Creates one order containing this cart's item snapshot.

For COD and zero-payable voucher orders, the selected cart is cleared after order creation succeeds. For online payment, the order stores its `sourceCartId` and source cart version. Payment failure or cancellation leaves the cart intact. On confirmed payment, cleanup affects only the source cart: delete it when unchanged, or remove only the purchased snapshot quantities if the cart was edited after payment began. Webhook retries are idempotent.

## 5. Web Experience

### Cart index

`/cart` renders summary cards ordered by `updatedAt` descending. The entire card is keyboard-accessible and clickable, opening `/cart/:cartId`. It contains no detail button, item rows, subtotal, or global item total.

Card metadata states are:

```text
Restaurant name
3 món · 25–30 phút · 4,2 km
```

```text
Restaurant name
3 món
```

```text
Restaurant name
3 món · Quán đang đóng cửa
```

### Cart detail and checkout

`/cart/:cartId` contains the current cart editor and its checkout action. Checkout navigation carries the cart ID explicitly; direct visits and refreshes reload that cart from the API. A closed restaurant keeps editing enabled but disables checkout with a clear explanation.

The navbar badge is `cartCount`, the number of restaurant carts, and is hidden at zero. Any web floating cart affordance shown on a restaurant page is scoped to that restaurant's cart.

## 6. Mobile Experience

The Cart tab becomes the cart index. Pressing a summary card navigates to a dedicated `CartDetail` screen keyed by `cartId`. Returning to the index refreshes or invalidates only the affected cart data while keeping the overall list current.

The detail screen keeps the existing line editing, removal, voucher, pricing, and checkout experience, but all operations are scoped by `cartId`. A closed restaurant permits edits and deletion while disabling checkout.

The bottom navigation badge displays the number of restaurant carts. Restaurant detail's floating cart bar displays only the current restaurant cart and opens that cart's detail.

### Explore header and floating status

At the top of Explore, the delivery address and search controls retain their current visual prominence within a translucent liquid-glass surface. As content scrolls, the header remains sticky, becomes slightly more compact, increases opacity, and transitions toward the restaurant-list background color (`#F8FAFC`). The transition is driven by a bounded scroll progress value rather than a binary jump.

The floating cart bar is not rendered on Explore. When an active delivery exists, the compact active-order control occupies the former floating-cart position above the bottom tab bar and is rendered only on Explore. Other tabs do not show it. Restaurant detail may still render its restaurant-scoped cart bar.

The already requested removal of the `Áp mã thành công` notification remains part of the final verification scope.

## 7. State and Cache Rules

- Clients store a cart index plus details keyed by `cartId`; they do not flatten all lines into one global cart.
- Cart count is derived from non-empty cart summaries returned by the server.
- Add, update, remove, clear, and successful checkout invalidate the affected detail and cart index.
- Address changes invalidate cart summaries so distance and ETA are recalculated.
- A restaurant page selects its cart by `restaurantId`; absence of a matching cart means its floating cart bar is hidden.
- Voucher and checkout state belong to the selected cart and are reset when moving to another cart.

## 8. Error Handling and Integrity

- Concurrent first additions use an atomic upsert plus the compound unique index; a duplicate-key race is retried as a normal update.
- Missing or unauthorized carts return `404`.
- Dangling food references are excluded. If no valid lines remain, the cart is deleted.
- Missing coordinates omit distance and ETA without failing the list.
- Locked, deleted, or closed restaurants cannot be quoted or ordered. Closed restaurants remain editable; deleted restaurants expose deletion/cleanup rather than checkout.
- A checkout request whose cart changed between quote and placement is rejected with a conflict response so the customer can review updated totals.
- Payment creation failures do not clear a cart. Payment confirmation cleanup is idempotent and scoped to the recorded source cart.

## 9. Testing Strategy

### API

- Multiple restaurant carts for one user and isolation between users.
- Atomic create/add behavior and the compound unique constraint.
- Independent line update, removal, final-line cleanup, and cart clear.
- Cart summary ordering, summed quantities, address/no-address metadata, and closed state.
- Quote and placement require and authorize `cartId`.
- COD, vouchers, zero-payable orders, PayOS, and VNPay affect only the selected cart.
- Payment failure retains the cart; successful and repeated confirmation cleanup is safe.
- Migration covers normal, empty, dangling, and inconsistent legacy carts.

### Customer web

- Summary card content and omission of totals/detail buttons.
- Whole-card keyboard/mouse navigation to the correct cart.
- Missing-address and closed-restaurant variants.
- Cart-count badge and restaurant-scoped cart affordance.
- Detail edits and checkout route persistence.

### Customer mobile

- Cart index rendering, card press navigation, detail refresh, and cart-count badge.
- Restaurant-scoped floating cart bar.
- Closed and missing-address variants.
- Explore liquid-glass-to-solid scroll transition and sticky controls.
- Floating active-order placement and Explore-only visibility.
- Absence of the voucher-success alert.

### Regression

Existing restaurant availability, delivery fee, voucher, payment, active-order, and order notification tests remain passing. Production builds/type checks for the API, customer web, and customer mobile must succeed.

## 10. Rollout

1. Back up and migrate cart data.
2. Deploy the API schema, indexes, and cart/order endpoints.
3. Deploy customer web and mobile clients using explicit cart IDs.
4. Monitor migration warnings, duplicate-key retries, cart authorization failures, quote conflicts, and payment cleanup.
5. Remove unambiguous legacy adapters only after active clients no longer use them.

## 11. Non-Goals

- A single order containing food from multiple restaurants.
- A combined multi-restaurant checkout or combined delivery fee.
- Persisting ETA as a guaranteed delivery commitment.
- Displaying a cart-index subtotal or global item total.
- Changing restaurant/admin order-management behavior beyond receiving correctly scoped orders.
