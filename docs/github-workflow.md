# GitHub-native project management

GitHub is the source of truth for OpsPilot implementation planning.

## Tracker

- Issues: <https://github.com/SyedTashfin/OpsPilot/issues>
- Project board: <https://github.com/users/SyedTashfin/projects/2>
- Milestones:
  - `V1 MVP`
  - `V2 Production`
  - `V3 Enterprise`

## Project board status

The GitHub Project uses the `OpsPilot Status` single-select field as the professional workflow board:

- `Backlog`
- `Ready`
- `In Progress`
- `Review`
- `Done`

The default GitHub `Status` field is also maintained for compatibility, but `OpsPilot Status` is the canonical board column field.

## Completed historical issues

Issues #1–#6 are completed and preserved as closed GitHub Issues so numbering matches the implementation history. Issue #6 was completed through the GitHub branch/PR workflow.

## Required implementation workflow

For every implementation issue:

1. Read the GitHub Issue.
2. Create a feature branch named `feature/issue-NNN-short-title`.
3. Implement only that issue.
4. Verify:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - `pnpm docker:config`
   - Docker Compose/runtime verification when applicable
5. Commit with Conventional Commits and reference the issue number.
6. Push the branch.
7. Open a Pull Request with:
   - summary
   - tests performed
   - architectural decisions
   - screenshots for UI changes
8. Do not begin the next issue until the current issue is complete and reviewed.

## Retired local issue files

The old Markdown issue files were moved to `docs/archive/completed-issues/` for historical reference only. They are not the primary tracker and must not be used to drive new implementation work.
