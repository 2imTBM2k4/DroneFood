# Phase 4 relocation record and external configuration handoff

Date: 2026-09-25 (Asia/Bangkok)

## Completed repository-local worktree relocation

Phase 4 has completed the repository-local top-level relocation in the
**worktree** using the map below. Application directories and internal package
paths now live under `apps/` and `packages/`; repository-local references and
CI paths were updated with that move. The 59 retained upload images moved
byte-for-byte from `backend/uploads/**` to `apps/api/uploads/**`; the old path
is historical.

No Vercel, Render, EAS, GitHub control-plane, DNS, payment-provider, or VPS
configuration was changed by this repository-local relocation. The remaining
work is to reconfigure and verify those external consumers before deployment.

This is not a single commit-ready relocation. The Customer Mobile move is
interleaved with the existing Customer redesign: `mobile/apps/customer/**` is
deleted in the worktree and `apps/customer-mobile/**` is present as untracked
content (including the redesign). It has **zero cached Customer paths**. The
non-Customer structural relocation entries are staged separately. Do not
interpret the completed worktree relocation as a staged, atomic full-repository
change.

### Git-index handoff

The current Git index contains the non-Customer structural relocation entries
created by the prior `git mv` operation, including 59 verified `R100` image
renames from `backend/uploads/**` to `apps/api/uploads/**`. The total number
of non-upload entries is intentionally not recorded here: it can change while
the relocation is reviewed and must be inspected in the index before a commit.

The Customer Mobile move and redesign are neither staged nor commit-ready. Do
not commit, stage, revert, or roll back `apps/customer-mobile/**` as part of
the structural relocation until the redesign is separated, reviewed, and
staged deliberately. This document and the related operations note are also
unstaged unless a later, deliberate review stages them. Before any commit,
review `git diff --cached --name-status` for the non-Customer relocation and
`git diff` plus `git ls-files --others --exclude-standard -- apps/customer-mobile`
for the Customer worktree state. Do not use `git add -A` in this worktree.

## Exact source-to-target map

| Current path | Target path | Notes |
| --- | --- | --- |
| `backend` | `apps/api` | Keep its own package lock, `.env.example`, Dockerfile, uploads, tests, and cwd-relative upload behavior together. |
| `user` | `apps/customer-web` | Customer web application; package name remains `@drone-food/customer-web`. |
| `admin` | `apps/admin-web` | Admin web application; package name remains `@drone-food/admin-web`. |
| `restaurant` | `apps/restaurant-web` | Restaurant-owner web application; package name remains `@drone-food/restaurant-web`. |
| `mobile/apps/customer` | `apps/customer-mobile` | Expo customer app; preserve `index.ts` -> `App.tsx` and app-local assets. |
| `mobile/apps/restaurant-mobile` | `apps/restaurant-mobile` | Expo restaurant app; preserve `index.ts` -> `App.tsx` and app-local assets. |
| `mobile/apps/shipper` | `apps/shipper-mobile` | Expo shipper app; preserve `index.ts` -> `App.tsx`, native task name, and app-local assets. |
| `mobile/packages/contracts` | `packages/contracts` | Package name remains `@drone-food/contracts`. |
| `mobile/packages/api-client` | `packages/api-client` | Package name remains `@drone-food/api-client`. |
| `shared` | `packages/web-ui` | Package name remains `@drone-food/web-ui`. |

`packages/native-ui` is a future package boundary, not a current source move.
Do not create an empty package in this relocation. The root `app.json` has an
unverified EAS mapping and remains in place until the EAS gate is resolved.

The target root is therefore:

```text
apps/
  api/
  customer-web/
  admin-web/
  restaurant-web/
  customer-mobile/
  restaurant-mobile/
  shipper-mobile/
packages/
  contracts/
  api-client/
  web-ui/
docs/
tooling/                 # no current source is moved here
```

## Completed repository-local changes

### Package metadata and lock ownership

- Root `package.json` and its lockfile now use explicit target workspace paths:
  `packages/web-ui`, `packages/contracts`, `packages/api-client`,
  `apps/customer-mobile`, `apps/restaurant-mobile`, and
  `apps/shipper-mobile`. Web apps and API retain independent locks; adding all
  `apps/*` as root workspaces remains a separate dependency-consolidation
  decision.
- The three web manifests now resolve `@drone-food/web-ui` through
  `file:../../packages/web-ui`; their app-local lockfiles were updated.
- `apps/restaurant-mobile` still resolves `@drone-food/contracts` through the
  root workspace lock. Package names, script names, API endpoints, storage
  keys, and public exports remain unchanged.

### Docker and Compose

- `docker-compose.yml` now uses `./apps/api` for the API build context and
  `.env`, and points web services at the moved Dockerfiles. Web services retain
  repository-root build context because they consume `packages/web-ui`.
- API and web Dockerfiles now use the moved paths; the web images copy
  `packages/web-ui` and their `apps/<web-app>` source/output paths. The root
  `.dockerignore` covers nested dependency and build output for the two-level
  `apps/*` layout.

### GitHub Actions

- Backend, Web, and Mobile CI path filters, working directories, cache paths,
  and matrices now use the relocated API, web, mobile, and package paths. Job
  names remain unchanged.
- No repository-local deployment workflow exists: the only checked-in GitHub
  workflows are the Backend, Web, and Mobile CI files above. Preserve their
  job names so branch-protection required-check rules do not silently break.

### Vite and web source imports

- The three Vite files still derive `appDirectory` from `import.meta.url`; their
  React/ReactDOM/Toastify absolute aliases follow the moved file without fixed
  root-relative paths. Active web imports retain `@drone-food/web-ui`, and the
  three path-dependent manifests now use the relocated file dependency.
- The Customer and Restaurant Vercel SPA rewrites moved unchanged with their
  apps. There is still no checked-in Admin Vercel configuration.

### Expo, Metro, and native paths

- Every app-local Expo entry remains `index.ts` importing `./App`; Customer,
  Restaurant, and Shipper app-local `app.json` files retain their relative
  asset/plugin paths. No `metro.config.*`, `babel.config.*`, or `eas.json` was
  added, and no `app.json` was changed. Expo package `main` values, app slugs,
  Android/iOS identities, the Shipper background task name
  `drone-food-shipper-location`, and EAS project fields remain unchanged.
- `packages/contracts` and `packages/api-client` now extend
  `../../tsconfig.base.json`; their `rootDir` and `outDir` remain unchanged.

### Documentation and local operational references

The following living documents now record the relocated paths: `README.md`,
`docs/ARCHITECTURE.en.md`, `docs/ARCHITECTURE.vi.md`,
`docs/RENDER_CRON.vi.md`, and `docs/operations/backend-uploads.md`. The Render
cron document currently records `apps/api`; it is repository documentation,
not evidence of the current or prior external dashboard Root Directory.

The Phase 0–3 snapshot and phase-plan documents deliberately record historical
paths as evidence. Do not rewrite their observations. Add one dated Phase 4
supersession note only if a reader could mistake the historical path for the
current layout. The relocation preflight is the canonical old-to-new mapping.

## Deferred external configuration

All entries below remain **UNVERIFIED** from repository source. They are
deferred external configuration tasks, not blockers for the completed local
path relocation. Confirm their exact values from the named control plane before
the corresponding service is deployed from its new repository root.

| Control plane | Confirm current value | Set/verify target value before deploy |
| --- | --- | --- |
| Vercel Customer project | Project identity, Root Directory (`user` if configured), install/build commands, output directory, production/preview branches, domains, and environment variables. | Root Directory `apps/customer-web`; the commands must still install the local `packages/web-ui` dependency and publish `dist`. |
| Vercel Restaurant project | Project identity, Root Directory (`restaurant` if configured), install/build commands, output directory, branches, domains, and environment variables. | Root Directory `apps/restaurant-web`; build from the checkout context that can see `packages/web-ui`; publish `dist`. |
| Vercel Admin project | Whether it exists despite no local `admin/vercel.json`, then its root/build/output/branch/domain/environment values. | Root Directory `apps/admin-web` and corresponding build/output settings. |
| Render API Web Service | Service identity, Root Directory (`backend` if configured), native-vs-Docker build mode, Build Command, Start Command, health check (`/api/health`), env groups/secrets, disk, branch, and auto-deploy setting. | Root Directory `apps/api`; if Docker is used, Dockerfile path/build context must both resolve to `apps/api`. |
| Render expiry Cron Job | The external dashboard's prior and current Root Directory are unverified. The tracked `docs/RENDER_CRON.vi.md` currently records `apps/api`, `npm ci`, `npm run jobs:expire-shipper-orders`, and schedule `* * * * *`; confirm the live service values. | Set and verify Root Directory `apps/api`; retain the same commands, schedule, environment group, and branch. |
| EAS/Expo Customer | Which project owns root `app.json` project ID `23f8fd97-4a2f-46c6-bc63-858569eda9c2`, its owner/slug, Customer's Android/iOS identifiers, credentials, profiles, channels/branches, update URLs, and environment source. | Confirm whether Customer needs an app-local EAS mapping after it moves to `apps/customer-mobile`; do not move or edit root `app.json` before this answer. |
| EAS/Expo Restaurant | Project ID/owner (not present in app-local config), Android/iOS credentials, profiles, channels/branches, update URLs, and `EXPO_PUBLIC_EAS_PROJECT_ID` environment ownership. | Confirm the app at `apps/restaurant-mobile` resolves to the same EAS project and identifiers. |
| EAS/Expo Shipper | Project ID `35abea49-fe95-4958-a520-0f0ae904fa2a`, owner, credentials, profiles, channels/branches, update URLs, and environment source. | Confirm the moved `apps/shipper-mobile/app.json` remains the selected app config with the identical IDs and native permissions. |
| GitHub | Required check names, any GitHub Actions workflow-path assumptions, repository Actions defaults, deployment environments/secrets, Pages settings, and any external deployment integration triggered from GitHub. | CI workflow paths above must be live; required check names remain unchanged. There is no checked-in deploy workflow or GitHub Pages configuration to migrate. |

PayOS/VNPay webhook and return URLs, DNS/reverse-proxy routes, monitoring
probes, and external VPS scripts are also deployment consumers. Confirm that
they point to the API hostname rather than a repository path; no URL change is
intended by this relocation.

## Commit, rollback, and deployment handoff

The non-Customer relocation may be reviewed for a deliberate, scoped commit.
Customer Mobile is excluded from that handoff: do not commit or roll back its
target directory as a whole. First separate the existing redesign from the
move, review both parts, and stage each intentionally. A whole-target rollback
would overwrite or discard untracked Customer redesign work and is therefore
not safe.

Before deployment, configure and verify the corresponding external entry in
[Deferred external configuration](#deferred-external-configuration), then
deploy one surface at a time with a health check and an agreed rollback target.
Rollback after a deployment switch first re-points the relevant Vercel/Render
root directory or EAS build selection to the prior known-good revision.

## Completed local validation record

The commands below were run from the repository root (unless a prefix is
shown) as the relocation validation record. The remaining validation is the
external control-plane and deployed-surface work listed above:

```powershell
npm.cmd ci --dry-run
npm.cmd ci --dry-run --prefix apps/api
npm.cmd ci --dry-run --prefix apps/customer-web
npm.cmd ci --dry-run --prefix apps/admin-web
npm.cmd ci --dry-run --prefix apps/restaurant-web

npm.cmd run lint --prefix apps/api
npm.cmd test --prefix apps/api
npm.cmd run lint --prefix apps/customer-web
npm.cmd run build --prefix apps/customer-web
npm.cmd run lint --prefix apps/admin-web
npm.cmd run build --prefix apps/admin-web
npm.cmd run lint --prefix apps/restaurant-web
npm.cmd run build --prefix apps/restaurant-web

npm.cmd run mobile:typecheck
npm.cmd run export:android --workspace=@drone-food/customer-mobile
npm.cmd run export:android --workspace=@drone-food/restaurant-mobile
npm.cmd run export:android --workspace=@drone-food/shipper-mobile

docker compose config --quiet
git diff --check
```

Root-context Docker image builds still require an available local Docker daemon.
The remaining `/api/health`, contract comparison, and production smoke checks
are deployment-surface validation after the applicable external configuration
gate is completed.
