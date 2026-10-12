# Domain docs

## Layout

This repository uses a multi-context domain-documentation layout.

- `CONTEXT-MAP.md` at the repository root maps a task to its relevant application or shared package.
- Each context owns a `CONTEXT.md` near the code it documents.
- Architecture Decision Records (ADRs) live in the relevant context's `docs/adr/` directory.

## Consumer rules

Before designing, changing, or reviewing behavior:

1. Read `CONTEXT-MAP.md` to identify the affected context or contexts.
2. Read every relevant `CONTEXT.md` before making domain assumptions.
3. Read applicable ADRs before changing a decision they cover.
4. Record a new ADR when a durable architecture or domain decision affects a context.
5. Keep cross-context terminology consistent; update the relevant context documents when a change alters business meaning or boundaries.

## Initial context map

Create or expand `CONTEXT-MAP.md` as contexts gain domain documentation. It should point to contexts such as applications under `apps/` and shared packages under `packages/`.
