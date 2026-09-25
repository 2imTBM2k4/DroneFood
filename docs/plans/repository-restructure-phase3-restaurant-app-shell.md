# Phase 3: Restaurant mobile app shell

## Scope

This phase establishes a single app-shell boundary for the Restaurant mobile app without changing its behavior. It does not change Customer, Shipper, backend, payment, order, GPS, `app.json`, or deployment configuration.

## Layout

Before:

```text
mobile/apps/restaurant-mobile/
  App.tsx                 # Expo entry delegate and app shell combined
  src/api/
  src/components/
  src/screens/
```

After:

```text
mobile/apps/restaurant-mobile/
  App.tsx                 # minimal Expo entry delegate
  src/application/RestaurantApp.tsx # QueryClient provider and Restaurant app shell
  src/api/
  src/components/
  src/screens/
```

## Preserved invariants

- The Expo entry remains `index.ts` -> `App.tsx`; `App.tsx` delegates to the app shell.
- The app shell owns the same singleton `QueryClient` and keeps all query keys, enablement conditions, query functions, and the 20-second restaurant-orders interval unchanged.
- Authentication storage, push registration/unregistration, Socket.IO transport/authentication, `joinRestaurant` event, new-order vibration, alert text, tab selection, and cleanup behavior remain unchanged.
- API calls, action sequencing, refetches, component props, Vietnamese error/success messages, and navigation behavior remain unchanged.

## Validation

- Run `npm.cmd run typecheck --workspace=@drone-food/restaurant-mobile`.
- Run `npm.cmd run export:android --workspace=@drone-food/restaurant-mobile`.
- Run `git diff --check`.

## Rollback

Move `RestaurantApp.tsx` back into `App.tsx` and restore the original relative imports. The change is a source-layout-only move and does not require data migration, API migration, or configuration rollback.
