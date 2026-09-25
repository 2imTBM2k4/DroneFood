# Repository restructure Phase 2A: web UI package

## Goal and scope

`shared/` is now the private workspace package `@drone-food/web-ui`. It stays in
its current physical location during this phase. Customer, admin, and restaurant
web applications consume only declared package exports; package internals keep
using relative imports.

This phase does not move applications, change API contracts, or alter payment,
order, wallet, notification, or GPS behavior.

## Public exports

| Import path | Public value |
| --- | --- |
| `@drone-food/web-ui/components/NotificationBell` | Default `NotificationBell` component |
| `@drone-food/web-ui/components/OptionGroupBuilder` | Default builder plus `validateOptionGroups` and `normaliseOptionGroups` |
| `@drone-food/web-ui/components/StateBlock` | Default `EmptyState`, named `EmptyState` and `ErrorState` |
| `@drone-food/web-ui/components/ToastNotification` | Default and named `ToastNotification` |
| `@drone-food/web-ui/utils/money` | Named `formatVND` |
| `@drone-food/web-ui/utils/toast` | Default and named `notify`, plus named `toast` |
| `@drone-food/web-ui/tokens.css` | Shared design tokens and base utilities |
| `@drone-food/web-ui/toast.css` | Shared toast presentation |
| `@drone-food/web-ui/favicon.svg` | Shared favicon source asset |

There is intentionally no root export. Consumers must name the public subpath so
dependencies stay visible and package internals can change without breaking apps.

## Dependency rules

- Web applications declare `"@drone-food/web-ui": "file:../shared"`. This works
  both from the root npm workspace and when `npm ci` runs inside an individual
  web application.
- `react` and `react-toastify` are peer dependencies because the host app owns
  their runtime instances. The supported ranges cover the versions already used
  by the three web applications.
- Each app's Vite config deduplicates `react`, `react-dom`, and `react-toastify`
  and aliases their package names, including subpath imports, to absolute paths
  below that app's own `node_modules`. This ensures imports originating in the
  linked `shared/` package use the host app's React 18 and Toastify version rather
  than a dependency hoisted at the repository root. This follows Vite's
  [`resolve.alias` and `resolve.dedupe` guidance](https://vite.dev/config/shared-options.html#resolve-alias).
- Add every future third-party runtime import to `shared/package.json`. Do not
  rely on a dependency being hoisted from the repository root.
- Import only the subpaths listed in `exports`. Do not reach into `shared/` with
  relative paths and do not import source from another application.
- Keep imports between files inside `shared/` relative.

## Copy-ready imports

```jsx
import NotificationBell from "@drone-food/web-ui/components/NotificationBell";
import { EmptyState, ErrorState } from "@drone-food/web-ui/components/StateBlock";
import OptionGroupBuilder, {
  normaliseOptionGroups,
  validateOptionGroups,
} from "@drone-food/web-ui/components/OptionGroupBuilder";
import { formatVND } from "@drone-food/web-ui/utils/money";
import notify from "@drone-food/web-ui/utils/toast";
import "@drone-food/web-ui/toast.css";
```

```css
@import "@drone-food/web-ui/tokens.css";
```

## Docker implications

The web Dockerfiles use the repository root as their build context. Each build
copies `shared/` to `/app/shared` before running the app-local `npm ci`, allowing
the `file:../shared` dependency in the app lockfile to resolve. The application
source is then copied and built exactly as before. Vite resolves package peers
from `/app/<application>/node_modules`, so the image does not depend on a
repository-root `node_modules`. A Docker build started with a web directory as
its context cannot resolve the package and is unsupported.

## Rollback

1. Restore relative imports in `user/`, `admin/`, and `restaurant/`.
2. Remove `@drone-food/web-ui` from their manifests and regenerate each lockfile
   with `npm install --package-lock-only` in that application.
3. Remove `shared` from the root workspace and regenerate the root lockfile.
4. Restore the previous Dockerfile copy order.
5. Delete `shared/package.json` after no package imports remain.

No source files need to move during rollback.

## Verification

Run from the repository root unless a command explicitly changes directory:

```powershell
rg -n '([.][.]/)+shared|@import\s+["'']([.][.]/)+shared' user/src admin/src restaurant/src
npm.cmd ci --dry-run
npm.cmd ci --dry-run --prefix user
npm.cmd ci --dry-run --prefix admin
npm.cmd ci --dry-run --prefix restaurant
npm.cmd run lint --prefix user
npm.cmd run build --prefix user
npm.cmd run lint --prefix admin
npm.cmd run build --prefix admin
npm.cmd run lint --prefix restaurant
npm.cmd run build --prefix restaurant
npm.cmd run mobile:typecheck
docker compose config
git diff --check
```

The `rg` command must return no active source/config imports. Each npm command,
Docker Compose validation, and whitespace check must exit successfully.
