# Backend working-directory contract

Date: 2026-09-23 (Asia/Bangkok)

This snapshot records every backend path whose meaning depends on the process working directory. Repository moves must preserve these resolved locations without exposing environment values or changing upload behavior.

## Current runtime contract

The required host working directory for normal backend commands is the current `backend/` directory:

```powershell
Set-Location C:\Users\Admin\Documents\Working\DroneFood\backend
npm.cmd run dev
```

The reason is observable in three path families:

1. `backend/server.js:1-2` calls `dotenv.config()` without an explicit path. It reads `.env` relative to `process.cwd()`. The same default-cwd behavior exists in `backend/config/cloudinary.js:1-4`, `backend/jobs/expireShipperOrders.js:1-5`, `backend/migrate-images.js:1-10`, `backend/scripts/sync_drone_history.mjs:1-3`, `backend/seeds/seedDrones.js:1-5`, `backend/seeds/migrateRefundBankAccounts.cjs:8`, `backend/seeds/migrateWalletPaymentPayosIndex.cjs:1`, and `backend/seeds/migrateVoucherRedemptionIndexes.cjs:10`. The last three CommonJS migrations use `require("dotenv").config()` without a `path`, so direct invocation also requires cwd `backend/` today and cwd `apps/api/` after the planned move.
2. `backend/app.js:36` mounts `express.static("uploads")`. With cwd `backend/`, `/images/*` resolves from `backend/uploads/*`.
3. Multer starts from relative destinations `uploads/foods`, `uploads/restaurants`, or `uploads/avatars`; it tests/creates those relative paths and passes the relative path to Multer (`backend/config/multer.js:5-25`). Filenames are `Date.now()` plus the original extension (`backend/config/multer.js:27-31`).

Starting the current entry point from the repository root with `node backend/server.js` would instead make dotenv look for root `.env`, serve root `uploads`, and write uploaded files below root `uploads`. That invocation does not satisfy the current contract.

## Explicit dotenv paths

Four CommonJS migrations/seeds are independent of cwd for `.env` because they resolve `../.env` from their own directory:

- `backend/seeds/migrateOrderReviewIndexes.cjs:6-10`
- `backend/seeds/migrateUsdToVnd.cjs:12-18`
- `backend/seeds/migrateUserAddressBook.cjs:11-15`
- `backend/seeds/seedData.cjs:218-225`

Their module imports are also relative to the script file. This explicit behavior must remain app-root-relative after a move.

`backend/seeds/backfillRestaurantCoords.js:5-6` documents and assumes execution from `backend/`; its `dotenv/config` import uses dotenv's default cwd lookup. `backend/migrate-images.js:18,30` additionally builds local upload paths from `process.cwd()` and can delete migrated local files, so it must never be run from another cwd accidentally.

## npm entry points

`backend/package.json:7-20` defines these scripts:

| Script | Command relative to backend package root |
| --- | --- |
| `dev` | `nodemon server.js` |
| `server` | `nodemon server.js` |
| `seed:drones` | `node seeds/seedDrones.js` |
| `test` | `vitest run` |
| `migrate:usd-to-vnd` | `node seeds/migrateUsdToVnd.cjs` |
| `migrate:wallet-payos` | `node seeds/migrateWalletPaymentPayosIndex.cjs` |
| `migrate:order-review-indexes` | `node seeds/migrateOrderReviewIndexes.cjs` |
| `migrate:voucher-redemption-index` | `node seeds/migrateVoucherRedemptionIndexes.cjs` |
| `migrate:refund-bank-accounts` | `node seeds/migrateRefundBankAccounts.cjs` |
| `jobs:expire-shipper-orders` | `node jobs/expireShipperOrders.js` |
| `lint` | `eslint . --max-warnings 0` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |

There is no production `start` script. Production Docker runs `node server.js` directly.

## Docker and Compose

- Compose builds the backend with context `./backend` and loads `./backend/.env` (`docker-compose.yml:2-8`). These paths are resolved from the directory containing the Compose project invocation.
- Both Docker stages set `WORKDIR /app`; package manifests and then the entire backend build context are copied into `/app` (`backend/Dockerfile:2-14`).
- Runtime command is `CMD ["node", "server.js"]` (`backend/Dockerfile:16-18`). The container cwd is therefore `/app`; dotenv reads `/app/.env` when one exists in the container environment, and relative upload/static paths resolve below `/app/uploads`.
- Compose injects environment variables from the host `backend/.env`; it does not mount a persistent upload volume. The current container upload filesystem is therefore container-local and must not be assumed durable.

## Required cwd before and after the planned move

| Context | Before move | After `backend` becomes `apps/api` | Required invariant |
| --- | --- | --- | --- |
| Direct development/server command | cwd `backend/` | cwd `apps/api/` | `server.js`, `.env`, and `uploads/` are siblings at the app root. |
| Backend npm scripts | run from `backend/` (or a package-aware command that sets that package root as cwd) | run from `apps/api/` or its workspace/package root | Default dotenv and relative upload paths resolve at the API app root. |
| One-off default-dotenv scripts | cwd `backend/` | cwd `apps/api/` | Never invoke them with repository root as cwd unless their code is first changed and separately verified. |
| Explicit-dotenv CJS migrations | any cwd for `.env` resolution; commonly `backend/` | any cwd for `.env` resolution; commonly `apps/api/` | Their `__dirname/../.env` target must continue to point at the API app root. |
| Docker runtime | cwd `/app` | cwd `/app` | The new Compose build context must be `./apps/api`; `CMD`, copied source, and `/app/uploads` semantics stay unchanged. |
| Compose env file | host `./backend/.env` | host `./apps/api/.env` | Update the path in the same path-only move; never print or commit its values. |

Phase 4 verification must start the API from its new app root, upload one disposable test image, fetch it through `/images/<relative-path>`, and confirm no repository-root `uploads/` directory was created. Docker verification must resolve Compose configuration without retaining expanded secret output and must confirm `/api/health` from the built container.
