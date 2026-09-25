# Repository restructure baseline

Date: 2026-09-23 (Asia/Bangkok)

This document freezes the observable repository contract before any file moves. It is a verification baseline, not authorization to change API behavior, payment or wallet rules, order state transitions, Socket.IO semantics, storage keys, mobile identifiers, or GPS behavior.

## Revision and worktree state

- Branch: `main` (tracking `origin/main`)
- Commit: `73896dcdb554ab063bdb2196bdbd22ae6a122f61`
- The worktree was already dirty before Phase 0: 32 modified files and one untracked file.
- The existing changes are concentrated in `mobile/apps/customer/**` plus the root `package-lock.json`; the untracked file is `mobile/apps/customer/src/components/common/GlassSurface.tsx`.
- Phase 0 did not modify, revert, format, or stage any of those existing changes. Validation commands generated only ignored build/coverage output.
- Because Customer Mobile source and its package manifest are dirty, its successful checks describe the current on-disk state, not the committed revision by itself.

## Toolchain observed

| Tool | Observed version | Repository declaration |
| --- | --- | --- |
| Node.js | `v24.21.0` | Root `package.json:9-11` declares `>=20`; CI pins Node 20 in `.github/workflows/{backend,mobile,web}-ci.yml`. |
| npm | `11.19.0` | No `packageManager` field is declared at root. |
| Docker | `29.7.2` | Local CLI; reading `%USERPROFILE%/.docker/config.json` produced an access warning. |
| Docker Compose | `v5.5.1` | `docker-compose.yml` is the current repository definition. |

The intended refactor runtime baseline is **Node.js >=22.13.x**. Expo's official SDK reference lists Node.js 22.13.x as the minimum for Expo SDK 57: https://docs.expo.dev/versions/latest/. The repository is not yet aligned: root `package.json:9-11` allows Node 20, all three CI workflows pin Node 20, and `backend/Dockerfile:2,9` uses Node 20. Phase 1 must update and verify those declarations before dependency or lockfile consolidation; Phase 0 only records the mismatch.

## Local installed-dependency validation

The full lint/test/build/export suite below is explicitly **local installed-dependency validation**. It proves that the current on-disk source runs against the already-installed `node_modules`; it does not prove that a fresh install can reproduce that dependency tree. No install or update command was run.

| Check | Command and working directory | Result |
| --- | --- | --- |
| Backend lint | `npm.cmd run lint` in `backend` | **PASS** — exit 0, no warnings. |
| Backend full test | `npm.cmd test -- --run` in `backend` | **PASS** — 27 test files, 198 tests. |
| Backend coverage | `npm.cmd run test:coverage` in `backend` | **PASS** — 27 test files, 198 tests. Statements 55.28% (1820/3292), branches 42.36% (935/2207), functions 56.17% (282/502), lines 57.05% (1703/2985). |
| Customer web lint | `npm.cmd run lint` in `user` | **PASS** — exit 0. |
| Customer web build | `npm.cmd run build` in `user` | **PASS** — 2,083 modules; main JS 1,018.35 kB (316.38 kB gzip). Vite warned that a chunk exceeds 500 kB. |
| Restaurant web lint | `npm.cmd run lint` in `restaurant` | **PASS** — exit 0. |
| Restaurant web build | `npm.cmd run build` in `restaurant` | **PASS** — 1,914 modules; main JS 335.27 kB (110.46 kB gzip). |
| Admin web lint | `npm.cmd run lint` in `admin` | **PASS** — exit 0. |
| Admin web build | `npm.cmd run build` in `admin` | **PASS** — 2,766 modules; main JS 726.36 kB (221.81 kB gzip). Vite warned that a chunk exceeds 500 kB. |
| Mobile package builds and app typechecks | `npm.cmd run mobile:typecheck` at repository root | **PASS** — built `@drone-food/contracts` and `@drone-food/api-client`; typechecked Customer, Shipper, and Restaurant Mobile. |
| Customer Android export | `npm.cmd run export:android` in `mobile/apps/customer` | **PASS** — 1,117 modules; Hermes bundle about 3 MB; exported to ignored `dist`. Repeated non-fatal `NO_COLOR`/`FORCE_COLOR` warnings. |
| Restaurant Android export | `npm.cmd run export:android` in `mobile/apps/restaurant-mobile` | **PASS** — 745 modules; Hermes bundle about 2 MB; exported to ignored `dist`. Repeated non-fatal `NO_COLOR`/`FORCE_COLOR` warnings. |
| Shipper Android export | `npm.cmd run export:android` in `mobile/apps/shipper` | **PASS** — 733 modules; Hermes bundle about 2 MB; exported to ignored `dist`. Repeated non-fatal `NO_COLOR`/`FORCE_COLOR` warnings. |
| Compose resolution | `docker compose config` at repository root | **PASS** — all four services resolved. Docker emitted two non-fatal access warnings for the user-level Docker config. The command expands `backend/.env`, so captured output must be treated as sensitive and must not be committed. |

**FAIL:** none among the requested Phase 0 checks.

Warnings are baseline observations, not failures: Customer/Admin web chunk size, Expo color-variable warnings, and Docker user-config access warnings.

### Lockfile dry-run validation

Before running these checks, `npm.cmd ci --help` was inspected. npm 11.19.0 documents `--dry-run` as making no changes. Each command below was then run as the literal `npm.cmd ci --dry-run`, completed within four seconds, and exited without writing dependency or lock files.

| Working directory | Result | Exact observation |
| --- | --- | --- |
| Repository root | **PASS** | Exit 0; `up to date`. This is the install root for all configured mobile workspaces. |
| `backend` | **PASS** | Exit 0; `up to date`. |
| `user` | **PASS WITH DRIFT** | Exit 0, but the dry-run would add 7 packages, remove 5, and change 2. The installed Customer Web dependency tree therefore does not exactly match its lockfile. |
| `admin` | **PASS** | Exit 0; `up to date`. |
| `restaurant` | **PASS** | Exit 0; `up to date`. |
| `mobile/apps/customer` | **PASS VIA ROOT WORKSPACE** | Exit 0; `up to date`. From this directory, `npm prefix` resolves to the repository root and `npm root` resolves to root `node_modules`; npm therefore validates the root workspace lock, not the nested lockfile. |

No requested dry-run was skipped or failed.

Customer Mobile currently has a conflicting nested `mobile/apps/customer/package-lock.json`. Its root package entry lists only 8 dependencies, while the current `mobile/apps/customer/package.json` and root workspace entry list 19. Missing entries include the Expo runtime/config/location/notification packages and several React Native packages. The current mobile CI executes `npm ci` at repository root and configures `cache-dependency-path: package-lock.json` (`.github/workflows/mobile-ci.yml:32-39,45-49`), so **root `package-lock.json` is authoritative in CI; the nested Customer lock is ignored by that workflow**. Phase 1 must remove or deliberately reconcile this ambiguity; Phase 0 does not edit either lockfile.

## Immutable route contracts

### Backend mount paths

The mount table below is defined by `backend/app.js:36` and `backend/app.js:52-72`. File moves must preserve these public paths unless a separate behavior change is explicitly approved.

| Public mount/path | Current owner |
| --- | --- |
| `/images` | static `backend/uploads` |
| `/api/food` | `backend/routes/foodRoute.js` |
| `/api/user` | `backend/routes/userRoute.js` |
| `/api/cart` | `backend/routes/cartRoute.js` |
| `/api/order` | `backend/routes/orderRoute.js` |
| `/api/restaurant` | `backend/routes/restaurantRoute.js` |
| `/api/drone` | `backend/routes/droneRoute.js` |
| `/api/config` | `backend/routes/configRoute.js` |
| `/api/audit` | `backend/routes/auditRoute.js` |
| `/api/shippers` | `backend/routes/shipperRoute.js` |
| `/api/wallet` | `backend/routes/walletRoute.js` |
| `/api/restaurant-withdrawals` | `backend/routes/restaurantWithdrawalRoute.js` |
| `/api/withdrawals` | `backend/routes/withdrawalRoute.js` |
| `/api/shipper/account-closure` | `backend/routes/shipperAccountClosureRoute.js` |
| `/api/vouchers` | `backend/routes/voucherRoute.js` |
| `/api/refunds` | `backend/routes/refundRoute.js` |
| `/api/address-book` | `backend/routes/addressBookRoute.js` |
| `/api/order-reviews` | `backend/routes/orderReviewRoute.js` |
| `/api/notifications` | `backend/routes/notificationRoute.js` |
| `/api/push-tokens` | `backend/routes/pushTokenRoute.js` |
| `/api/health` | direct health handler in `backend/app.js:72` |

The individual HTTP verbs and suffixes remain owned by the corresponding route files. Phase 4 must compare the resolved Express route table before and after moving files, with particular attention to payment callbacks/webhooks and the plural `/api/shippers` mount.

### Public browser routes

- Customer web (`user/src/App.jsx:67-92`): `/`, `/restaurants`, `/food` (redirect), `/restaurant/:id`, `/cart`, `/checkout`, `/verify`, `/myorders`, `/myorders/:id`, `/profile`, `/product/:id`, `/reset-password/:token`, `/order` (redirect), `/placeorder` (redirect), `/payment` (redirect).
- Restaurant web (`restaurant/src/App.jsx:65-78`): `/login`, `/register`, `/` (redirect), `/dashboard`, `/add` (redirect), `/list`, `/orders`, `/edit-restaurant`, `/withdrawals` (redirect), `/wallet`.
- Admin web (`admin/src/App.jsx:73-88`): `/`, `/list-restaurants`, `/list-users`, `/orders`, `/drones`, `/shippers`, `/vouchers`, `/finance`, `/refunds`, `/withdrawals`, `/audit`. Authentication is rendered conditionally in `admin/src/App.jsx:55-68`; there is no separate `/login` route.
- SPA fallback rewrites exist for Customer and Restaurant in `user/vercel.json:1-5` and `restaurant/vercel.json:1-5`. No `admin/vercel.json` exists locally.

## Immutable client storage keys

Renaming any of these keys would log users out, lose UI state, or break in-progress delivery state. Preserve the values during structural moves.

| Surface | Keys | Source |
| --- | --- | --- |
| Customer web auth | `token`, `refreshToken` | `user/src/api/customerClient.js:23-27`, `user/src/components/LoginPopup/LoginPopup.jsx:74-76` |
| Shared web theme | `mode` | `user/src/components/Navbar/Navbar.jsx:21-45`, `restaurant/src/components/Navbar/Navbar.jsx:15-28`, `admin/src/components/Navbar/Navbar.jsx:14-26` |
| Customer web address/cart legacy state | `activeAddressId`, `cartItems`, `cartRestaurantId` | `user/src/context/StoreContext.jsx:21`, `user/src/context/StoreContext.jsx:48-49`, `user/src/context/StoreContext.jsx:316-340` |
| Customer drone delivery | `drone_arrived_${order._id}`, `drone_arrived_time_${order._id}`, `drone_location_${order._id}` | `user/src/components/DroneDelivery/DroneDelivery.jsx:176-177`, `user/src/components/DroneDelivery/DroneDelivery.jsx:246` |
| Restaurant web | `token`, `restaurantId`, `mode` | `restaurant/src/context/AuthContext.jsx:14`, `restaurant/src/context/AuthContext.jsx:90-102`, `restaurant/src/components/Navbar/Navbar.jsx:15-28` |
| Admin web | `token`, `userRole`, `mode` | `admin/src/context/AuthContext.jsx:44-51`, `admin/src/context/AuthContext.jsx:60`, `admin/src/components/Navbar/Navbar.jsx:14-26` |
| Customer Mobile | `customerAccessToken`, `customerRefreshToken` | `mobile/apps/customer/src/api/client.ts:37-38` |
| Restaurant Mobile | `restaurantAccessToken` | `mobile/apps/restaurant-mobile/src/api/client.ts:33` |
| Shipper Mobile | `shipperAccessToken`, `shipperRefreshToken` | `mobile/apps/shipper/App.tsx:45-46` |

Mobile storage uses Expo SecureStore on native platforms and a localStorage-compatible wrapper on web (`mobile/apps/customer/src/api/client.ts:45-85`, `mobile/apps/restaurant-mobile/src/api/client.ts:37-69`, `mobile/apps/shipper/App.tsx:78-113`).

## Immutable Socket.IO contracts

Application-level event strings found in the server and consumers:

| Direction | Event | Source/consumer locations |
| --- | --- | --- |
| Client to server | `joinRestaurant` | `backend/server.js:56`; `restaurant/src/pages/Orders/Orders.jsx:126`; `mobile/apps/restaurant-mobile/App.tsx:129` |
| Client to server | `joinShipper` | `backend/server.js:61`; `mobile/apps/shipper/App.tsx:417` |
| Client to server | `joinCustomer` | `backend/server.js:64`; `user/src/pages/OrderDetail/OrderDetail.jsx:178`; `mobile/apps/customer/App.tsx:349` |
| Client to server | `joinNotifications` | `backend/server.js:65` |
| Server to client | `newOrder` | `backend/controllers/orderController.js:12,34`; Restaurant web/mobile listeners at `restaurant/src/pages/Orders/Orders.jsx:131` and `mobile/apps/restaurant-mobile/App.tsx:132` |
| Server to client | `shipperOrderOffer` | `backend/controllers/orderController.js:19,43`, `backend/controllers/shipperController.js:56`; `mobile/apps/shipper/App.tsx:418` |
| Server to client | `orderStatusUpdated` | `backend/utils/orderRealtime.js:15`; Customer web/mobile listeners at `user/src/pages/OrderDetail/OrderDetail.jsx:179` and `mobile/apps/customer/App.tsx:352` |
| Server to client | `shipperLocationUpdated` | `backend/utils/orderRealtime.js:81`; Customer web/mobile listeners at `user/src/pages/OrderDetail/OrderDetail.jsx:180` and `mobile/apps/customer/App.tsx:357` |
| Server to client | `notificationCreated` | `backend/services/notificationService.js:71` |

Socket room name formats are also contracts: `restaurant_${restaurantId}`, `shipper_${userId}`, `customer_${userId}`, and the notification room derived by `roomFor` in `backend/services/notificationService.js`.

Framework lifecycle event names (`connection`, `connect`, `connect_error`, `finish`) are not application payload contracts but must continue to be wired after file moves.

## Expo/native identity and GPS contracts

| App/config | Android package | iOS bundle ID | EAS project mapping |
| --- | --- | --- | --- |
| Customer Mobile | **UNRESOLVED:** not declared in `mobile/apps/customer/app.json:18-29` | **UNRESOLVED:** not declared in `mobile/apps/customer/app.json:18-29` | **UNRESOLVED:** no app-local project ID. Root `app.json:3-9` contains project ID `23f8fd97-4a2f-46c6-bc63-858569eda9c2`, owner `2004.tranbinhminh`, slug `dronefood`; ownership must be confirmed externally before moving it. |
| Restaurant Mobile | `com.dronefood.restaurant` | `com.dronefood.restaurant` | **UNRESOLVED:** no app-local project ID in `mobile/apps/restaurant-mobile/app.json`. Runtime push setup reads `EXPO_PUBLIC_EAS_PROJECT_ID`. |
| Shipper Mobile | `com.dronefood.shipper` | `com.dronefood.shipper` | `35abea49-fe95-4958-a520-0f0ae904fa2a`, owner `2004.tranbinhminh` in `mobile/apps/shipper/app.json:43-48`. |

The Shipper background location task name is exactly `drone-food-shipper-location` (`mobile/apps/shipper/App.tsx:44`). Its definition is at line 181 and it is passed unchanged to start/stop checks at lines 368-369, 468, and 495. Renaming it can orphan an OS-registered task and requires a separately planned native migration.

## Environment variable names

Only names are recorded here; values are intentionally excluded.

- Backend runtime (`backend/app.js`, `backend/server.js`, `backend/config/**`, `backend/services/**`, `backend/utils/**`): `ALLOWED_ORIGINS`, `BANK_ACCOUNT_ENCRYPTION_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `FRONTEND_URL`, `JWT_SECRET`, `LOG_LEVEL`, `MONGODB_URI`, `NODE_ENV`, `PAYOS_API_KEY`, `PAYOS_CANCEL_URL`, `PAYOS_CHECKSUM_KEY`, `PAYOS_CLIENT_ID`, `PAYOS_DEPOSIT_CANCEL_URL`, `PAYOS_DEPOSIT_RETURN_URL`, `PAYOS_RETURN_URL`, `PAYOS_WEBHOOK_URL`, `PORT`, `SHIPPER_CLOSURE_FORM_URL`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `TRACKASIA_KEY`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_REFUND_API_URL`, `VNPAY_REFUND_CREATE_BY`, `VNPAY_REFUND_IP_ADDR`, `VNPAY_RETURN_URL`, `VNPAY_TMN_CODE`.
- Backend scripts/seeds additionally accept `MONGO_URI` as a fallback in `backend/seeds/backfillRestaurantCoords.js:12`.
- Web build-time: `VITE_API_URL` is used in all three web apps; `VITE_TRACKASIA_KEY` is used by Customer web at `user/src/lib/trackasia.js:6`. The example files also currently declare `VITE_TRACKASIA_KEY` for Admin and Restaurant even though no runtime reference was found.
- Mobile build/runtime: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_EAS_PROJECT_ID`; Shipper also supports `EXPO_PUBLIC_SHIPPER_TEST_LOCATION` and `EXPO_PUBLIC_SHIPPER_TEST_ROUTE` (`mobile/apps/shipper/App.tsx:29,53,65`).
- `docker-compose.yml:5-6` loads `backend/.env`. Any path migration must update this reference without logging or committing expanded values.

## Current workspace, CI, and local deployment paths

- Root npm workspaces are exactly `mobile/packages/*` and `mobile/apps/*` (`package.json:5-7`). Backend and web apps are not root workspaces.
- Workspace packages: `mobile/packages/contracts` (`@drone-food/contracts`) and `mobile/packages/api-client` (`@drone-food/api-client`).
- Workspace apps: `mobile/apps/customer` (`customer`), `mobile/apps/restaurant-mobile` (`restaurant-mobile`), and `mobile/apps/shipper` (`shipper`).
- Standalone package roots: `backend`, `user`, `restaurant`, and `admin`.
- Web CI matrix is `[user, admin, restaurant]` with each app as `working-directory` and lockfile owner (`.github/workflows/web-ci.yml:29-43`).
- Backend CI uses `backend` and `backend/package-lock.json` (`.github/workflows/backend-ci.yml:25-36`).
- Mobile CI installs at root, runs `mobile:typecheck`, then exports matrix `[customer, shipper, restaurant-mobile]` by workspace (`.github/workflows/mobile-ci.yml:29-49`).
- Compose build ownership (`docker-compose.yml:2-41`): Backend context `./backend`; Customer/Admin/Restaurant web use root context with `user/Dockerfile`, `admin/Dockerfile`, and `restaurant/Dockerfile`.

## External deployment exit gates — UNVERIFIED

Every mapping in this section is **UNVERIFIED**. Phase 0 did not log in to Vercel, Render, Expo/EAS, payment providers, DNS, or any other external control plane. These items must be captured from their control planes before any related path change, deployment-root change, or root/app-local `app.json` mutation:

- **Vercel:** project-to-directory mapping, production/preview branch settings, build/install commands, output directories, environment variables, domains, and whether Admin is deployed through Vercel despite having no local `vercel.json`.
- **Render:** service IDs/names, repository root directory, build/start commands, health-check path, environment groups/secrets, deploy branch, auto-deploy setting, persistent disk expectations, and cron/job definitions. No `render.yaml`/`render.yml` is present locally.
- **EAS/Expo:** which project owns the root EAS project ID, Customer and Restaurant project IDs/owners, App Store/Play Store application identifiers, credentials, build/update profiles, channels/branches, and whether environment values come from EAS environments or local files. No `eas.json` is present locally.
- **Other external consumers:** OAuth/payment-provider callback registrations, PayOS/VNPay webhook/return URLs, DNS/reverse-proxy roots, monitoring probes, Atlas network rules, and any VPS/tmux scripts outside the repository.

These are hard exit gates. Phase 4 must not begin until the mappings are recorded and a deploy rollback path exists. The root `app.json` and every app-local `app.json` must remain unchanged until EAS ownership is verified. Local source alone is insufficient to infer these values safely.

## Detailed Phase 0 artifacts

- `docs/plans/backend-endpoint-contract-snapshot.md` freezes every Express endpoint, route-local middleware, and auth role.
- `docs/plans/socketio-contract-snapshot.md` freezes handshake, room, payload, and customer GPS privacy behavior.
- `docs/plans/backend-working-directory-contract.md` freezes dotenv, static upload, Multer, Docker, and working-directory assumptions.
- `docs/plans/backend-uploads-manifest.md` records every tracked upload by observable path and SHA-256 without inferring ownership or deletion policy.
