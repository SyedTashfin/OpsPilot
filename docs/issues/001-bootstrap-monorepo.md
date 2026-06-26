# Issue 1 — Bootstrap TypeScript monorepo

## Objective

Create the OpsPilot monorepo skeleton using pnpm workspaces, shared TypeScript config, linting, formatting, and base package layout.

## Dependencies

None.

## Acceptance criteria

- `corepack pnpm install` works.
- `corepack pnpm lint` runs.
- `corepack pnpm typecheck` runs.
- Empty apps/packages compile.
- Repository contains initial `README.md`.
- `docs/adr/0001-monorepo.md` explains the monorepo choice.

## Deliverables

- Root workspace config
- Base app/package directories
- Shared strict TypeScript config
- ESLint and Prettier config
- Initial README
- ADR 0001

## Estimated effort

4–6 hours.
