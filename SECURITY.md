# Security Policy

## Supported scope

SyedTashfin/OpsPilot is currently a local-first portfolio demonstration. It is not a production SaaS and has no public cloud deployment in this repository state.

## Reporting

Please open a private security advisory or contact the repository owner for suspected vulnerabilities. Do not include live secrets, production data, or credentials in public issues.

## Secret handling

- Do not commit provider keys, database passwords, session secrets, access codes, cookies, CSRF tokens, or production connection strings.
- `.env.example` contains placeholders and local-only defaults; use untracked `.env` files for real local values.
- The committed `pnpm security:scan` check is a deterministic guard, not a replacement for GitHub secret scanning or push protection.

## Current limitations

- GitHub secret scanning, push protection, Dependabot alerts, and CodeQL availability depend on repository visibility/account plan and must be enabled by a human owner where supported.
- No production incident integrations, production database, or cloud deployment are supported yet.
