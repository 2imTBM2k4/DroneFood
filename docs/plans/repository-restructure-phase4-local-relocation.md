# Phase 4: local repository relocation

## Scope completed locally

The repository source is organized into stable local roots:

- `apps/api`
- `apps/customer-web`, `apps/restaurant-web`, and `apps/admin-web`
- `apps/customer-mobile`, `apps/restaurant-mobile`, and `apps/shipper-mobile`
- `packages/contracts`, `packages/api-client`, and `packages/web-ui`

Root workspaces, Docker build contexts, local compose configuration, CI workflows, package manifests, and file dependencies refer to these roots. The application entrypoints, endpoint paths, Socket.IO events, storage keys, payment flows, GPS behavior, and Expo `app.json` files are unchanged by this relocation.

## Deployment handoff deferred

Vercel root-directory settings, Render service and cron root-directory settings, EAS project/source configuration, and any deployment-only GitHub checks are external configuration. They are deliberately deferred until the deployment owner updates those dashboards. This local migration does not edit `app.json`, Vercel, Render, or EAS settings.

## Local validation required before deployment changes

1. Regenerate or verify every local package lockfile after a clean install.
2. Run API lint and tests, web lint and production builds, mobile typechecks, and Android exports.
3. Run `docker compose config --quiet` and `git diff --check`.
4. After external root directories are updated, deploy each service from its new `apps/...` path and verify its health endpoint or browser build.

## Rollback

If a provider still points at an old directory, restore that provider's previous root-directory setting first. Do not revert source paths selectively: the workspace, Docker, CI, and package file references must stay aligned.
