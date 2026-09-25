# Repository restructure Phase 1 scope ledger

## Status

Phase 1 local repository hygiene is complete in the working tree. This phase does not complete the repository restructure: no application directory, deployment root, external service configuration, or runtime endpoint is moved.

No Phase 1 file is staged or committed by this work.

## Phase 1-owned files and hunks

Runtime and package metadata:

- `.nvmrc`: pins Node `22.13.0`.
- `package.json`: owns only `packageManager`, `engines.node`, and the mobile workspace selectors in `scripts.mobile:build`.
- `package-lock.json`: owns only root engine metadata plus the three renamed mobile workspace names and workspace-link entries. npm does not currently serialize the root `packageManager` field into this lockfile.
- `backend/package.json`, `user/package.json`, `admin/package.json`, and `restaurant/package.json`: own only the package `name` and `engines.node` additions.
- `backend/package-lock.json`, `user/package-lock.json`, `admin/package-lock.json`, and `restaurant/package-lock.json`: own only the corresponding root package name and engine metadata generated from each package manifest.
- `mobile/apps/customer/package.json`, `mobile/apps/restaurant-mobile/package.json`, and `mobile/apps/shipper/package.json`: own only the package-name changes.
- `mobile/apps/customer/package-lock.json`: removal of the stale app-local lockfile; the root workspace lockfile governs this app.
- `.github/workflows/backend-ci.yml`, `.github/workflows/web-ci.yml`, and `.github/workflows/mobile-ci.yml`: own the Node `22.13.0` setup values, `.nvmrc` path triggers, and renamed mobile matrix selectors.
- `backend/Dockerfile`, `user/Dockerfile`, `admin/Dockerfile`, and `restaurant/Dockerfile`: own only the Node `22.13-alpine` base-image changes.
- `README.md`, `docs/ARCHITECTURE.en.md`, and `docs/ARCHITECTURE.vi.md`: own only the Node runtime requirement updates.

Repository hygiene and documentation:

- `.gitignore`: owns the `.DS_Store` rules. `PLAN.md`, `docs/feature-specs/`, `docs/testing.vi.md`, `docs/migrations.vi.md`, and `docs/superpowers/` remain ignored pending a dedicated documentation review. `docs/plans/`, `docs/design/`, and `docs/operations/` remain trackable.
- `.DS_Store`, `backend/.DS_Store`, and `backend/uploads/.DS_Store`: removal of operating-system metadata only.
- `DESIGN-apple.md` to `docs/design/DESIGN-apple.md`: path relocation only. The on-disk content hash was preserved; content edits that existed before Phase 1 remain user-owned.
- `shared/tokens.css` and the affected CSS comments under `user/src/`: own only the reference update to `docs/design/DESIGN-apple.md`.
- `docs/operations/backend-uploads.md`: records the observed local upload behavior and the deferred ownership decision.
- `docs/plans/repository-restructure-phase1.md`: this scope ledger.

## Pre-existing Customer redesign changes

The Customer Mobile redesign predates Phase 1 and must not be staged with a Phase 1 change:

- All modified files under `mobile/apps/customer/src/`, `mobile/apps/customer/App.tsx`, and the untracked `mobile/apps/customer/src/components/common/GlassSurface.tsx` are user-owned redesign work.
- In `mobile/apps/customer/package.json`, the `expo-blur` and `expo-image-picker` dependency hunks are redesign work. Phase 1 owns only the package-name hunk.
- In root `package-lock.json`, the `expo-blur` addition and `expo-image-picker` dependency/version/integrity hunks are redesign work. Phase 1 owns only the root engine metadata and renamed mobile workspace/link hunks.

These mixed files require hunk-level staging if Phase 1 is committed separately.

## Deferred gates

- Root and app `app.json` files, EAS project identifiers, Vercel/Render configuration, and deployed root paths remain frozen and unverified. Their verification and any path mutation move to the Phase 4 gate.
- The ownership and retention classification of `backend/uploads` remains deferred until a data owner verifies database references, fixture requirements, and retention needs. All 59 tracked image files are preserved; Phase 1 removes only `backend/uploads/.DS_Store`.
- No endpoint, payment, wallet, order-state, Socket.IO, GPS, or authorization behavior is changed.

Phase 1 therefore establishes local naming, runtime, lockfile, and hygiene consistency. External configuration and repository path migration are not completed in this phase.
