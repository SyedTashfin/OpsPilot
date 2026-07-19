# Repository Governance Setup

This guide describes the committed controls and the GitHub settings a human owner should enable for the canonical repository, `SyedTashfin/OpsPilot`.

## Current reality

- Repository A, `SyedTashfin/OpsPilot`, is canonical.
- Repository B, `SyedTashfin/opspilot-agentic-operations`, remains a separate deployment/SSL prototype and is intentionally not merged into this history.
- Milestone 0 does not deploy, provision cloud resources, or port SSL.
- Codex did not enable repository settings; YAML and policy files are committed only.

## Committed controls

- PR/main quality workflow: `.github/workflows/quality.yml`.
- Dependabot version-update configuration: `.github/dependabot.yml`.
- Minimal CODEOWNERS: `.github/CODEOWNERS`.
- PR checklist template: `.github/pull_request_template/milestone-0.md`.
- Security policy: `SECURITY.md`.
- Contributor workflow: `CONTRIBUTING.md`.
- Deterministic docs and source secret checks: `pnpm docs:check` and `pnpm security:scan`.

## Required check names

Use these exact required checks after the workflow has run on GitHub:

- `quality / workspace quality`
- `quality / postgres pgvector integration`
- `quality / playwright e2e`

Do not require CodeQL in Milestone 0 for the current private repository unless a human confirms GitHub Advanced Security or public-repository CodeQL support.

## Branch protection for `main`

Recommended settings:

1. Require a pull request before merging.
2. Require approvals before merge.
3. Require conversation resolution before merge.
4. Require the three checks listed above to pass.
5. Require branches to be up to date before merge if queue/rebase policy is acceptable for the team.
6. Block force pushes.
7. Block branch deletion.
8. Restrict who can push to `main` if the plan/team supports it.
9. Keep workflow permissions least-privilege by default: repository Settings → Actions → General → Workflow permissions → Read repository contents permission, with write permission granted only per workflow/job when required.

## Settings available when supported by current plan/API

Enable when available for the repository owner/account:

- Dependabot alerts.
- Dependabot security updates.
- Secret scanning.
- Push protection.
- Private vulnerability reporting.

The committed Dependabot file schedules version-update PRs but does not prove alerts or security updates are enabled.

## Settings blocked or conditional on private-plan limits

- CodeQL/code scanning for private repositories may require GitHub Advanced Security or a public repository. It is intentionally not committed as an automatic required workflow in Milestone 0.
- Secret scanning and push protection availability also depend on plan/visibility.

## Post-publication or upgrade controls

After the repository is public or the account plan supports advanced security:

1. Add a CodeQL workflow for JavaScript/TypeScript.
2. Require the CodeQL check only after it has passed on the default branch.
3. Enable secret scanning and push protection.
4. Enable Dependabot alerts/security updates and confirm alert visibility.
5. Add release environment protection rules for production deployments.

## Deployment environment gate

When cloud deployment is introduced later, create a `production` environment with:

- Required human reviewers.
- Secrets scoped to the environment, not repository-wide where possible.
- Deployment branches limited to protected `main` or release branches.
- No automatic production deploy from arbitrary PR branches.

## V1 milestone inconsistency

Issue #11's CI criterion was not true on `main` before this Milestone 0 work. This PR prepares the correction, but the V1 milestone should not be closed while the PR is unmerged. Codex must not close issues or milestones.
