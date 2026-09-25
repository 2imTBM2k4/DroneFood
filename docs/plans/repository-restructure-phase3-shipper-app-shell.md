# Phase 3: Shipper mobile app shell

## Scope

This phase establishes one app-shell boundary for the Shipper mobile app without changing behavior. It does not change Customer, Restaurant, backend, payments, order rules, deployment configuration, or `app.json`.

## Layout

Before:

```text
mobile/apps/shipper/
  App.tsx                 # Expo entry delegate and full app shell combined
  components/
  pushNotifications.ts
```

After:

```text
mobile/apps/shipper/
  App.tsx                 # minimal Expo entry delegate
  src/application/ShipperApp.tsx # QueryClient provider and full Shipper app shell
  components/
  pushNotifications.ts
```

`src/application` is deliberately used instead of `src/app`, because Expo Router treats an `app` directory as a routing convention.

## Preserved invariants

- The Expo entry remains `index.ts` -> `App.tsx` -> `ShipperApp.tsx`; `App.tsx` only delegates to the shell.
- The same singleton `QueryClient` remains in the app shell. Query keys, polling/refetch intervals, enablement conditions, query functions, invalidations, and state transitions remain unchanged.
- The native background task name remains `drone-food-shipper-location`. Its module-level registration remains active before the app component renders.
- Foreground and background location permissions, foreground watcher lifecycle, background location delivery, test-only `EXPO_PUBLIC_SHIPPER_TEST_LOCATION` and `EXPO_PUBLIC_SHIPPER_TEST_ROUTE` behavior, token refresh, and the location payload (`lat`, `lng`) remain unchanged.
- SecureStore/localStorage keys remain `shipperAccessToken` and `shipperRefreshToken`. Socket.IO connection/authentication, join events, listeners, cleanup, push registration, API endpoints, request payloads, UI actions, and Vietnamese messages remain unchanged.

## Validation

- Run `npm.cmd run typecheck --workspace=@drone-food/shipper-mobile`.
- Run `npm.cmd run export:android --workspace=@drone-food/shipper-mobile`.
- Run `git diff --check`.

## Rollback

Move `src/application/ShipperApp.tsx` back to `App.tsx` and restore the original entry module. This is a source-layout-only move; it needs no data migration, API migration, native configuration rollback, or GPS contract change.
