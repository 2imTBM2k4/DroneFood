# Backend endpoint contract snapshot

Generated from the on-disk source on 2026-09-23. This is a structural refactor guardrail, not permission to change endpoint behavior, authorization, financial rules, or state transitions.

All API requests first pass `cors`, `express.json({ limit: "2mb" })`, and `requestContext` (`backend/app.js:29-34`). `/api/order/*` additionally passes mount middleware `cleanOrderPayload` (`backend/app.js:38-55`). In the tables, `public` means there is no route-level `protect`; controller/service checks may still reject a request. `protect` means any authenticated role unless an `authorize(...)` middleware is also shown.

## Food — mount `/api/food` at `backend/app.js:52`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/food/add` | `protect`; `uploadMiddleware.single("image")`; `validate(addFoodSchema)` | `backend/routes/foodRoute.js:23` |
| GET | `/api/food/list` | `optionalAuth`; `validate(listFoodQuerySchema, "query")` | `backend/routes/foodRoute.js:24` |
| GET | `/api/food/:id` | public | `backend/routes/foodRoute.js:25` |
| POST | `/api/food/remove` | `protect`; `validate(removeFoodSchema)` | `backend/routes/foodRoute.js:26` |
| POST | `/api/food/update` | `protect`; `uploadMiddleware.single("image")`; `validate(updateFoodSchema)` | `backend/routes/foodRoute.js:27` |
| PATCH | `/api/food/:id/availability` | `protect`; `validate(foodAvailabilitySchema)` | `backend/routes/foodRoute.js:28` |

## User — mount `/api/user` at `backend/app.js:53`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/user/register` | `authLimiter`; `validate(registerSchema)` | `backend/routes/userRoute.js:51` |
| POST | `/api/user/login` | `authLimiter`; `validate(loginSchema)` | `backend/routes/userRoute.js:52` |
| POST | `/api/user/logout` | public | `backend/routes/userRoute.js:53` |
| POST | `/api/user/forgot-password` | `authLimiter` | `backend/routes/userRoute.js:54` |
| POST | `/api/user/reset-password` | `authLimiter` | `backend/routes/userRoute.js:55` |
| POST | `/api/user/refresh-token` | `authLimiter` | `backend/routes/userRoute.js:56` |
| GET | `/api/user/me` | `protect` | `backend/routes/userRoute.js:59` |
| GET | `/api/user/transactions` | `protect` | `backend/routes/userRoute.js:60` |
| GET | `/api/user/reverse-geocode` | `protect`; `validate(reverseGeocodeQuerySchema, "query")` | `backend/routes/userRoute.js:61` |
| GET | `/api/user/geocode` | `protect`; `validate(geocodeAddressQuerySchema, "query")` | `backend/routes/userRoute.js:62` |
| PUT | `/api/user/update-address` | `protect`; `validate(updateAddressSchema)` | `backend/routes/userRoute.js:63` |
| PUT | `/api/user/profile` | `protect`; `validate(updateProfileSchema)` | `backend/routes/userRoute.js:64` |
| PUT | `/api/user/change-password` | `protect`; `validate(changePasswordSchema)` | `backend/routes/userRoute.js:65` |
| PUT | `/api/user/avatar` | `protect`; `uploadMiddleware.single("avatar")` | `backend/routes/userRoute.js:66` |
| GET | `/api/user/list` | `protect`; `authorize("admin")` | `backend/routes/userRoute.js:69` |
| GET | `/api/user/stats` | `protect`; `authorize("admin")`; `validate(statsQuerySchema, "query")` | `backend/routes/userRoute.js:70` |
| POST | `/api/user/lock` | `protect`; `authorize("admin")`; `validate(lockUserSchema)` | `backend/routes/userRoute.js:71` |
| PUT | `/api/user/update-by-admin` | `protect`; `authorize("admin")`; `validate(updateByAdminSchema)` | `backend/routes/userRoute.js:72` |
| DELETE | `/api/user/delete` | `protect`; `authorize("admin")`; `validate(deleteUserSchema)` | `backend/routes/userRoute.js:73` |

## Cart — mount `/api/cart` at `backend/app.js:54`

`router.use(protect)` applies to every row (`backend/routes/cartRoute.js:19`).

| Method | Full path | Additional middleware | Source |
| --- | --- | --- | --- |
| GET | `/api/cart/get` | none | `backend/routes/cartRoute.js:21` |
| POST | `/api/cart/add` | `validate(addToCartSchema)` | `backend/routes/cartRoute.js:22` |
| POST | `/api/cart/update-line` | `validate(updateLineSchema)` | `backend/routes/cartRoute.js:25` |
| POST | `/api/cart/remove-line` | `validate(lineKeySchema)` | `backend/routes/cartRoute.js:26` |
| POST | `/api/cart/clear` | none | `backend/routes/cartRoute.js:27` |

## Order and payment — mount `/api/order` at `backend/app.js:55`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/order/quote` | `protect`; `validate(deliveryQuoteSchema)` | `backend/routes/orderRoute.js:28` |
| GET | `/api/order/vnpay-return` | public callback | `backend/routes/orderRoute.js:29` |
| GET | `/api/order/vnpay-ipn` | public provider IPN | `backend/routes/orderRoute.js:30` |
| POST | `/api/order/payos/webhook` | public provider webhook; signature verified in service | `backend/routes/orderRoute.js:31` |
| POST | `/api/order/place` | `protect`; `validate(placeOrderSchema)` | `backend/routes/orderRoute.js:32` |
| POST | `/api/order/verify` | `protect`; `validate(verifyOrderSchema)` | `backend/routes/orderRoute.js:33` |
| POST | `/api/order/retry-payos` | `protect`; `validate(retryPayosPaymentSchema)` | `backend/routes/orderRoute.js:34` |
| GET | `/api/order/userorders` | `protect` | `backend/routes/orderRoute.js:35` |
| GET | `/api/order/:id/customer-detail` | `protect` | `backend/routes/orderRoute.js:36` |
| GET | `/api/order/list` | `protect` | `backend/routes/orderRoute.js:37` |
| POST | `/api/order/status` | `protect`; `validate(updateStatusSchema)` | `backend/routes/orderRoute.js:38` |
| GET | `/api/order/status-stats` | `protect`; `authorize("admin")` | `backend/routes/orderRoute.js:39` |

`payosWebhook` first verifies/settles an order payment; when the order handler reports the event as ignored, the same signed webhook body is offered to the shipper wallet PayOS handler (`backend/controllers/orderController.js:116-129`). Thus `/api/order/payos/webhook` is also the current PayOS ingress for wallet deposits/top-ups. `/api/wallet/payos/deposit-return` below is a browser return endpoint, not settlement authority.

## Restaurant — mount `/api/restaurant` at `backend/app.js:56`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/restaurant/list` | `optionalAuth` | `backend/routes/restaurantRoute.js:27` |
| GET | `/api/restaurant/me/bank-account` | `protect`; `authorize("restaurant_owner")` | `backend/routes/restaurantRoute.js:29` |
| PUT | `/api/restaurant/me/bank-account` | `protect`; `authorize("restaurant_owner")`; `validate(bankAccountSchema)` | `backend/routes/restaurantRoute.js:30` |
| PUT | `/api/restaurant/:id` | `protect`; `authorize("restaurant_owner", "admin")`; `uploadMiddleware.single("image")`; `validate(updateRestaurantSchema)` | `backend/routes/restaurantRoute.js:32` |
| POST | `/api/restaurant/` | `protect`; `uploadMiddleware.single("image")`; `validate(createRestaurantSchema)` | `backend/routes/restaurantRoute.js:41` |
| DELETE | `/api/restaurant/` | `protect`; `authorize("admin")`; `validate(deleteRestaurantSchema)` | `backend/routes/restaurantRoute.js:49` |
| GET | `/api/restaurant/:id` | `protect` | `backend/routes/restaurantRoute.js:51` |
| PATCH | `/api/restaurant/:id/open-state` | `protect`; `authorize("restaurant_owner", "admin")`; `validate(setOpenStateSchema)` | `backend/routes/restaurantRoute.js:53` |
| PUT | `/api/restaurant/:id/lock` | `protect`; `authorize("admin")`; `validate(lockRestaurantSchema)` | `backend/routes/restaurantRoute.js:61` |

## Drone — mount `/api/drone` at `backend/app.js:57`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/drone/addresses/:orderId` | `protect` | `backend/routes/droneRoute.js:44` |
| POST | `/api/drone/assign` | `protect`; `authorize("admin", "restaurant_owner")`; `validate(assignDroneSchema)` | `backend/routes/droneRoute.js:45` |
| POST | `/api/drone/reassign` | `protect`; `authorize("admin")`; `validate(reassignDroneSchema)` | `backend/routes/droneRoute.js:46` |
| POST | `/api/drone/preflight` | `protect`; `authorize("admin")`; `validate(preflightCheckSchema)` | `backend/routes/droneRoute.js:55` |
| POST | `/api/drone/arrived-restaurant` | `protect`; `authorize("admin")`; `validate(orderTargetSchema)` | `backend/routes/droneRoute.js:56` |
| POST | `/api/drone/handover` | `protect`; `authorize("admin", "restaurant_owner")`; `validate(orderTargetSchema)` | `backend/routes/droneRoute.js:57` |
| POST | `/api/drone/arrived-customer` | `protect`; `authorize("admin")`; `validate(orderTargetSchema)` | `backend/routes/droneRoute.js:58` |
| POST | `/api/drone/fallback-consent` | `protect`; `validate(fallbackConsentSchema)` | `backend/routes/droneRoute.js:59` |
| POST | `/api/drone/scan-qr` | `protect`; `validate(scanQRSchema)` | `backend/routes/droneRoute.js:61` |
| POST | `/api/drone/confirm-delivery` | `protect`; `validate(confirmDeliverySchema)` | `backend/routes/droneRoute.js:62` |
| POST | `/api/drone/cargo-weight` | `protect`; `authorize("admin")`; `validate(cargoWeightSchema)` | `backend/routes/droneRoute.js:63` |
| GET | `/api/drone/history/all` | `protect`; `authorize("admin")`; `validate(historyQuerySchema, "query")` | `backend/routes/droneRoute.js:65` |
| GET | `/api/drone/history/:id` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:66` |
| GET | `/api/drone/stats/overview` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:68` |
| POST | `/api/drone/reset-all-stuck` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:69` |
| POST | `/api/drone/:id/reset` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:70` |
| POST | `/api/drone/:id/charge` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:71` |
| GET | `/api/drone/` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:73` |
| GET | `/api/drone/:id` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:74` |
| POST | `/api/drone/create` | `protect`; `authorize("admin")`; `validate(createDroneSchema)` | `backend/routes/droneRoute.js:75` |
| PUT | `/api/drone/:id` | `protect`; `authorize("admin")`; `validate(updateDroneSchema)` | `backend/routes/droneRoute.js:76` |
| DELETE | `/api/drone/:id` | `protect`; `authorize("admin")` | `backend/routes/droneRoute.js:77` |

## Config and audit

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/config/fees` | public; mount `backend/app.js:58` | `backend/routes/configRoute.js:8` |
| GET | `/api/audit/` | `protect`; `authorize("admin")`; mount `backend/app.js:59` | `backend/routes/auditRoute.js:9` |

## Shippers — mount `/api/shippers` at `backend/app.js:60`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/shippers/` | `protect`; `authorize("admin")` | `backend/routes/shipperRoute.js:9` |
| GET | `/api/shippers/me` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:10` |
| GET | `/api/shippers/me/bank-account` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:11` |
| PUT | `/api/shippers/me/bank-account` | `protect`; `authorize("shipper")`; `validate(bankAccountSchema)` | `backend/routes/shipperRoute.js:12` |
| PUT | `/api/shippers/me/location` | `protect`; `authorize("shipper")`; `validate(locationSchema)` | `backend/routes/shipperRoute.js:13` |
| PUT | `/api/shippers/me/status` | `protect`; `authorize("shipper")`; `validate(statusSchema)` | `backend/routes/shipperRoute.js:14` |
| GET | `/api/shippers/me/orders/available` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:15` |
| GET | `/api/shippers/me/orders/current` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:16` |
| GET | `/api/shippers/me/orders/history` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:17` |
| POST | `/api/shippers/me/orders/:id/accept` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:18` |
| POST | `/api/shippers/me/orders/:id/pick-up` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:19` |
| POST | `/api/shippers/me/orders/:id/arrive` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:20` |
| POST | `/api/shippers/me/orders/:id/complete` | `protect`; `authorize("shipper")` | `backend/routes/shipperRoute.js:21` |
| POST | `/api/shippers/me/orders/:id/decline` | `protect`; `authorize("shipper")`; `validate(declineSchema)` | `backend/routes/shipperRoute.js:22` |
| POST | `/api/shippers/orders/:id/extend-search` | `protect`; `authorize("user")` | `backend/routes/shipperRoute.js:23` |
| PUT | `/api/shippers/:userId/approval` | `protect`; `authorize("admin")`; `validate(approvalSchema)` | `backend/routes/shipperRoute.js:24` |

The plural mount `/api/shippers` is part of the contract.

## Wallet — mount `/api/wallet` at `backend/app.js:61`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/wallet/shipper/me` | `protect`; `authorize("shipper")` | `backend/routes/walletRoute.js:9` |
| GET | `/api/wallet/shipper/transactions` | `protect`; `authorize("shipper")` | `backend/routes/walletRoute.js:10` |
| GET | `/api/wallet/shipper/earnings-report` | `protect`; `authorize("shipper")` | `backend/routes/walletRoute.js:11` |
| POST | `/api/wallet/shipper/deposit/payos` | `protect`; `authorize("shipper")`; `validate(depositPaymentSchema)` | `backend/routes/walletRoute.js:12` |
| POST | `/api/wallet/shipper/earnings/payos` | `protect`; `authorize("shipper")`; `validate(depositPaymentSchema)` | `backend/routes/walletRoute.js:13` |
| GET | `/api/wallet/payos/deposit-return` | public browser return | `backend/routes/walletRoute.js:14` |
| GET | `/api/wallet/vnpay/deposit-ipn` | public provider IPN | `backend/routes/walletRoute.js:15` |
| GET | `/api/wallet/vnpay/deposit-return` | public browser return; same handler as deposit IPN | `backend/routes/walletRoute.js:16` |

## Restaurant withdrawals — mount `/api/restaurant-withdrawals` at `backend/app.js:62`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/restaurant-withdrawals/` | `protect`; `authorize("restaurant_owner")`; `validate(createWithdrawalSchema)` | `backend/routes/restaurantWithdrawalRoute.js:9` |
| GET | `/api/restaurant-withdrawals/` | `protect`; `authorize("restaurant_owner")` | `backend/routes/restaurantWithdrawalRoute.js:10` |
| GET | `/api/restaurant-withdrawals/transactions` | `protect`; `authorize("restaurant_owner")` | `backend/routes/restaurantWithdrawalRoute.js:11` |
| POST | `/api/restaurant-withdrawals/:id/approve` | `protect`; `authorize("admin")` | `backend/routes/restaurantWithdrawalRoute.js:12` |
| POST | `/api/restaurant-withdrawals/:id/paid` | `protect`; `authorize("admin")`; `validate(paidWithdrawalSchema)` | `backend/routes/restaurantWithdrawalRoute.js:13` |
| POST | `/api/restaurant-withdrawals/:id/reject` | `protect`; `authorize("admin")`; `validate(rejectWithdrawalSchema)` | `backend/routes/restaurantWithdrawalRoute.js:14` |

## Shipper withdrawals — mount `/api/withdrawals` at `backend/app.js:63`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/withdrawals/shipper` | `protect`; `authorize("shipper")`; `validate(createWithdrawalSchema)` | `backend/routes/withdrawalRoute.js:9` |
| GET | `/api/withdrawals/shipper` | `protect`; `authorize("shipper")` | `backend/routes/withdrawalRoute.js:10` |
| GET | `/api/withdrawals/admin` | `protect`; `authorize("admin")` | `backend/routes/withdrawalRoute.js:11` |
| GET | `/api/withdrawals/:id/payout-details` | `protect`; `authorize("admin")` | `backend/routes/withdrawalRoute.js:12` |
| POST | `/api/withdrawals/:id/approve` | `protect`; `authorize("admin")` | `backend/routes/withdrawalRoute.js:13` |
| POST | `/api/withdrawals/:id/paid` | `protect`; `authorize("admin")`; `validate(paidWithdrawalSchema)` | `backend/routes/withdrawalRoute.js:14` |
| POST | `/api/withdrawals/:id/reject` | `protect`; `authorize("admin")`; `validate(rejectWithdrawalSchema)` | `backend/routes/withdrawalRoute.js:15` |

## Shipper account closure — mount `/api/shipper/account-closure` at `backend/app.js:64`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/shipper/account-closure/` | `protect`; `authorize("shipper")`; `validate(createClosureSchema)` | `backend/routes/shipperAccountClosureRoute.js:9` |
| PUT | `/api/shipper/account-closure/bank-details` | public token form; `validate(updateClosureBankSchema)` | `backend/routes/shipperAccountClosureRoute.js:10` |
| POST | `/api/shipper/account-closure/:id/request-bank-details` | `protect`; `authorize("admin")` | `backend/routes/shipperAccountClosureRoute.js:11` |
| POST | `/api/shipper/account-closure/:id/approve` | `protect`; `authorize("admin")` | `backend/routes/shipperAccountClosureRoute.js:12` |

Known defect, recorded without fixing it: the email service defaults its browser form URL to `/shipper/closure-bank-details` on `FRONTEND_URL` (`backend/services/shipperAccountClosureService.js:11-18`), but Customer Web declares no such route (`user/src/App.jsx:67-92`). The API update endpoint above exists; the browser page route does not. This mismatch is outside the path-only refactor and must not be silently corrected during file moves.

## Vouchers — mount `/api/vouchers` at `backend/app.js:65`

`router.use(protect, authorize("admin"))` applies to every row (`backend/routes/voucherRoute.js:14`).

| Method | Full path | Additional middleware | Source |
| --- | --- | --- | --- |
| GET | `/api/vouchers/` | `validate(listVoucherQuerySchema, "query")` | `backend/routes/voucherRoute.js:15` |
| POST | `/api/vouchers/` | `validate(createVoucherSchema)` | `backend/routes/voucherRoute.js:16` |
| PUT | `/api/vouchers/:id` | `validate(voucherIdParamSchema, "params")`; `validate(updateVoucherSchema)` | `backend/routes/voucherRoute.js:17` |
| PATCH | `/api/vouchers/:id/enabled` | `validate(voucherIdParamSchema, "params")`; `validate(voucherEnabledSchema)` | `backend/routes/voucherRoute.js:18` |

## Refunds — mount `/api/refunds` at `backend/app.js:66`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| POST | `/api/refunds/request` | `protect`; `authorize("user")`; `validate(requestRefundSchema)` | `backend/routes/refundRoute.js:8` |
| GET | `/api/refunds/` | `protect`; `authorize("admin")`; `validate(refundListQuerySchema, "query")` | `backend/routes/refundRoute.js:9` |
| GET | `/api/refunds/:id/payout-details` | `protect`; `authorize("admin")`; `validate(refundIdParamSchema, "params")` | `backend/routes/refundRoute.js:10` |
| POST | `/api/refunds/:id/mark-paid` | `protect`; `authorize("admin")`; `validate(refundIdParamSchema, "params")`; `validate(markRefundPaidSchema)` | `backend/routes/refundRoute.js:11` |
| POST | `/api/refunds/:id/reject` | `protect`; `authorize("admin")`; `validate(refundIdParamSchema, "params")`; `validate(rejectRefundSchema)` | `backend/routes/refundRoute.js:12` |

## Address book — mount `/api/address-book` at `backend/app.js:67`

`router.use(protect)` applies to every row (`backend/routes/addressBookRoute.js:19`).

| Method | Full path | Additional middleware | Source |
| --- | --- | --- | --- |
| GET | `/api/address-book/` | none | `backend/routes/addressBookRoute.js:20` |
| POST | `/api/address-book/` | `validate(createAddressEntrySchema)` | `backend/routes/addressBookRoute.js:21` |
| PATCH | `/api/address-book/:id` | `validate(addressEntryParamsSchema, "params")`; `validate(updateAddressEntrySchema)` | `backend/routes/addressBookRoute.js:22` |
| PUT | `/api/address-book/:id/default` | `validate(addressEntryParamsSchema, "params")` | `backend/routes/addressBookRoute.js:23` |
| DELETE | `/api/address-book/:id` | `validate(addressEntryParamsSchema, "params")` | `backend/routes/addressBookRoute.js:24` |

## Order reviews — mount `/api/order-reviews` at `backend/app.js:68`

| Method | Full path | Route middleware / auth | Source |
| --- | --- | --- | --- |
| GET | `/api/order-reviews/food/:foodId` | public | `backend/routes/orderReviewRoute.js:9` |
| POST | `/api/order-reviews/:orderId/:targetType/:targetId` | `protect`; `validate(submitReviewDecisionSchema)` | `backend/routes/orderReviewRoute.js:11` |

## Notifications — mount `/api/notifications` at `backend/app.js:69`

`router.use(protect)` applies to every row (`backend/routes/notificationRoute.js:8`).

| Method | Full path | Additional middleware | Source |
| --- | --- | --- | --- |
| GET | `/api/notifications/` | `validate(notificationListQuerySchema, "query")` | `backend/routes/notificationRoute.js:9` |
| GET | `/api/notifications/unread-count` | none | `backend/routes/notificationRoute.js:10` |
| POST | `/api/notifications/read-all` | none | `backend/routes/notificationRoute.js:11` |
| POST | `/api/notifications/:id/read` | `validate(notificationIdParamSchema, "params")` | `backend/routes/notificationRoute.js:12` |

## Push tokens — mount `/api/push-tokens` at `backend/app.js:70`

`router.use(protect)` applies to every row (`backend/routes/pushTokenRoute.js:8`).

| Method | Full path | Additional middleware | Source |
| --- | --- | --- | --- |
| POST | `/api/push-tokens/register` | `validate(registerPushTokenSchema)` | `backend/routes/pushTokenRoute.js:9` |
| POST | `/api/push-tokens/unregister` | `validate(unregisterPushTokenSchema)` | `backend/routes/pushTokenRoute.js:10` |

## Health and static content

| Method | Full path | Middleware / behavior | Source |
| --- | --- | --- | --- |
| GET | `/api/health` | public direct handler; returns 200 only when Mongoose state is connected | `backend/app.js:72-81` |
| GET/HEAD | `/images/*` | `express.static("uploads")`; filesystem root is working-directory-relative | `backend/app.js:36` |

## Refresh procedure

Run these read-only commands from repository root, then update this Markdown and review the diff:

```powershell
rg -n 'app\.use|app\.(get|post|put|patch|delete)' backend/app.js
rg -n -U 'router\.(get|post|put|patch|delete)\([\s\S]*?\);|foodRouter\.(get|post|put|patch|delete)\([\s\S]*?\);|userRouter\.(get|post|put|patch|delete)\([\s\S]*?\);|restaurantRouter\.(get|post|put|patch|delete)\([\s\S]*?\);|auditRouter\.(get|post|put|patch|delete)\([\s\S]*?\);|configRouter\.(get|post|put|patch|delete)\([\s\S]*?\);' backend/routes
rg -n 'router\.use|authorize\(|protect|optionalAuth|authLimiter|uploadMiddleware|validate\(' backend/routes
```

Join each route suffix to its mount in `backend/app.js`, preserving declaration order because parameter routes can shadow later routes. Compare PayOS/VNPay endpoints and the account-closure known defect explicitly. A refresh is complete only when every route declaration and `router.use` middleware appears in the snapshot and the backend integration suite passes.
