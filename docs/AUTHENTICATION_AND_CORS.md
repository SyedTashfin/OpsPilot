# Authentication and CORS Boundary

## Threat model and trust boundaries

OpsPilot's public portfolio demo exposes read-only operational data to browsers while protecting state-changing demo and investigation actions from unauthenticated or cross-site abuse. The browser is untrusted. Server-side configuration values such as the portfolio access code, session signing secret, provider credentials, database URLs, cookies, and CSRF tokens must not be embedded in static HTML/JS bundles or logged.

## Route matrix

| Route                                                                                                                                                    | Method | Public? | Protection                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/api/health`, `/api/services`, `/api/incidents`, `/api/logs`, `/api/llm/status`, `/api/runbooks/search`, investigation history/detail/report reads | GET    | Yes     | Explicit CORS allowlist for browser origins                                                                               |
| `/api/auth/login`                                                                                                                                        | POST   | Yes     | JSON only, access-code comparison, login rate limit                                                                       |
| `/api/auth/logout`                                                                                                                                       | POST   | No      | Requires valid session, CSRF header, JSON content type, and clears HttpOnly session cookie                                |
| `/api/demo/seed`, `/api/demo/telemetry/batch`, `/api/demo/detect-incident`, `/api/logs/batch`, `/api/incidents/:incidentId/investigations`               | POST   | No      | HttpOnly signed session, CSRF header, JSON content type, origin allowlist; investigation creation has an extra rate limit |

## Session and secret handling

A portfolio access code establishes a short-lived signed opaque cookie. The cookie is HttpOnly, SameSite=Lax, and Secure in production. The server returns a CSRF token only after login/session validation; it is required for state-changing API calls. Access codes, session cookies, auth headers, CSRF tokens, model credentials, and provider secrets are not injected into dashboard HTML or static JavaScript.

## Configuration

Development/test must explicitly provide `OPSPILOT_PORTFOLIO_ACCESS_CODE`, `OPSPILOT_SESSION_SECRET`, and `API_ALLOWED_ORIGINS` when protected mutation flows are exercised; when origins are unset outside production the API uses the repository's local dashboard origin `http://localhost:3000`. Production fails closed when auth is enabled and either auth secrets or explicit non-wildcard allowed origins are missing. Generate the production session secret with at least 32 high-entropy characters (for example from a password manager or `openssl rand -base64 32`) and use a portfolio access code of at least 12 characters; do not commit real values. Wildcard, malformed, credential-bearing, path/query/fragment, null, and non-http(s) origins are forbidden in production.

## CORS, CSRF, and rate limits

CORS credentials are returned only for configured allowed origins. Disallowed origins are rejected before route handling. Mutations require `application/json`, a valid session cookie, and the matching CSRF header. Login attempts and investigation creation are bounded with in-memory rate limits suitable for a single-node portfolio demo.

## Known limitations

Sessions and rate limits are in-memory and reset on process restart. This is appropriate for the bounded portfolio demo; a multi-node production deployment would need shared session/rate-limit storage and a fuller auth system.
