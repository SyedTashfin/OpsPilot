# OpsPilot v1.0.0 Release Notes

OpsPilot v1.0.0 is the first complete release candidate of the local-first AI operations copilot demo.

## Summary

This release demonstrates a full AI incident-investigation vertical slice:

1. BeautyCorp synthetic services generate operational telemetry.
2. OpsPilot detects a recommendation-service latency incident.
3. The API runs a deterministic investigation workflow over logs, metrics, deployments, and runbooks.
4. Runbook RAG retrieves relevant operational guidance from pgvector.
5. A single LLM generation produces a structured root-cause report.
6. Langfuse optionally traces the workflow, tool observations, and LLM generation.
7. The dashboard visualizes the incident, evidence, timeline, root cause, confidence, and trace link.

## Release assets

- Dashboard screenshots: `docs/assets/screenshots/issue-010-dashboard/`
- Architecture diagrams: `docs/architecture/README.md`
- Full changelog: `CHANGELOG.md`
- Release checklist: `docs/release/v1.0.0-checklist.md`

## Verification summary

The RC1 verification suite passed on `main`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm docker:config
pnpm docker:build
```

Live smoke checks also passed:

- Docker Compose services healthy.
- Deterministic investigation demo produced a report.
- Langfuse public trace API returned the expected `investigation.workflow` trace with 5 observations.
- Dashboard browser smoke loaded the UI, displayed incidents, included Langfuse content, and had no horizontal overflow.

## Important local URLs

| Surface   | URL                    |
| --------- | ---------------------- |
| Dashboard | http://localhost:3000  |
| API       | http://localhost:4000  |
| Langfuse  | http://localhost:3001  |
| Ollama    | http://localhost:11434 |

## Known limitations

This is a focused v1.0.0 portfolio-grade release, not an enterprise product.

Out of scope:

- evaluation framework
- prompt management
- authentication / RBAC
- multi-tenancy
- production cloud deployment
- Kubernetes / Terraform
- automatic remediation
- real external observability integrations

## Recommended reviewer path

```bash
pnpm install
cp .env.example .env
OLLAMA_PORT=11435 pnpm docker:up
DATABASE_URL=postgres://opspilot:***@localhost:5432/opspilot \
RAG_EMBEDDING_PROVIDER=deterministic \
OPSPILOT_DEMO_FAKE_LLM=true \
pnpm demo:investigation
```

Then open:

```text
http://localhost:3000
```

Use the dashboard to inspect the incident, evidence, timeline, and Langfuse trace link.
