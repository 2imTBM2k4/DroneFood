# Phase 3: Web app shell boundaries

## Scope

This phase keeps the existing top-level `user`, `admin`, and `restaurant` applications in place while giving each web client a named application shell:

- `user/src/application/CustomerWebApp.jsx`
- `admin/src/application/AdminWebApp.jsx`
- `restaurant/src/application/RestaurantWebApp.jsx`

Each `src/App.jsx` is now a one-line compatibility entry that re-exports its corresponding application shell. The Vite entrypoints continue importing `src/App.jsx`, so build and deployment entry paths remain unchanged.

## Invariants

- Route tables, redirects, route nesting, guards, context access, API URL fallbacks, page-transition behavior, toast configuration, layouts, component props, and stylesheet imports are unchanged.
- Only relative imports required by the new `src/application` depth change from `./` to `../`.
- Existing `@drone-food/web-ui` imports remain in their application shells.
- No page/component logic, dependencies, Vite configuration, backend, mobile client, deployment setting, or top-level directory changes are included.

## Validation

Run these checks from the repository root after the move:

```powershell
npm.cmd run lint --prefix user
npm.cmd run build --prefix user
npm.cmd run lint --prefix admin
npm.cmd run build --prefix admin
npm.cmd run lint --prefix restaurant
npm.cmd run build --prefix restaurant
git diff --check
```

## Rollback

Restore the three original `src/App.jsx` implementations and remove the corresponding `src/application/*WebApp.jsx` files. No routing, data, environment, or deployment migration is involved, so the rollback is limited to those six source files.
