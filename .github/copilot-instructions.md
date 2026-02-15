# Copilot Instructions for ccc-server

## Project Overview
- **Purpose:** Node.js backend server acting as a caching proxy for college-specific APIs and data sources (St. Olaf, Carleton).
- **Architecture:**
  - Modular structure under `source/` for each institution (`ccci-stolaf-college`, `ccci-carleton-college`).
  - Each institution exposes a `/v1` API router with endpoints for food menus, calendars, contacts, news, orgs, etc.
  - Main entry: `source/ccc-server/server.ts` selects institution via `INSTITUTION` env var and wires up middleware/routes.
  - Shared utilities in `source/ccc-lib/` and `source/calendar/`.
- **Data Flow:**
  - Requests enter via Koa server, routed by institution, handled by modular endpoint files.
  - Some endpoints proxy or transform external data (e.g., Google Calendar, BonApp menus).

## Developer Workflows

- **Preferred task runner:** This repo uses `mise` task definitions in `.config/mise.toml`. Use `mise run <task>` where possible; CI relies on these tasks.
- **Install:** `npm install` (CI uses `npm ci` — you can run `mise run npm ci` in environments that support it)
- **Development:**
  - Watch/reload: `npm run watch` (runs both TypeScript compilation and server in watch mode) or use `mise run build:watch` + `mise run start:watch` in separate terminals
  - Institution-specific dev: `mise run stolaf-college` or `mise run carleton-college` (these set `INSTITUTION` and depend on `build`)
- **Build:** `mise run build` (same as `npm run build`)
- **Production:** `mise run start:prod` (or `npm run start:prod`)
- **Testing / TDD workflow:**
  - This repository practices TDD for "agentic" development. Add tests first, run them, implement until green.
  - Unit tests: `mise run test` (runs AVA after building). Test files follow existing patterns: `*.test.ts` next to source (see `menu.test.ts`, `index.test.ts`, `ical.test.ts`).
  - Smoke tests: `mise run test:stolaf-college` / `mise run test:carleton-college` — these run `scripts/smoke-test.sh`, start the server in SMOKE_TEST mode and validate `/ping` plus most `/v1/routes` (some routes are intentionally skipped; see the script for details).
- **Lint/Format:**
  - Lint: `mise run lint` (or `npm run lint`)
  - Format: `mise run pretty` (or `npm run pretty`)

## Key Conventions & Patterns
- **TypeScript:** Strict, ES modules, custom types in `source/types/` and context in `source/ccc-server/context.ts`.
- **Routing:**
  - All API endpoints registered via Koa Router in each institution's `v1/index.ts`.
  - `/v1/routes` endpoint lists all available routes for introspection/testing.
- **Environment Variables:**
  - `INSTITUTION` required for server startup (`stolaf-college` or `carleton-college`).
  - `SMOKE_TEST` disables port binding for test runs.
  - `NODE_PORT` sets server port (default 3000).
- **Middleware:**
  - Standard Koa stack: logging, compression, etag, cache-control, body parsing, Sentry error handling.
- **Error Handling:**
  - Sentry integrated via `@sentry/node`.
- **Testing Skips:**
  - See `scripts/smoke-test.sh` for routes skipped due to auth, broken endpoints, or slow responses.

## Integration Points
- **External APIs:**
  - Google Calendar, BonApp, RSS, WP-JSON, etc. (see respective endpoint files)
- **Docker:**
  - Dockerfile and `docker-compose.yml` provided for containerized deployment.
-- **CI:**
  - GitHub Actions in `.github/workflows/node.js.yml` run the `mise`-based checks and smoke tests for both institutions. The canonical task definitions live in `.config/mise.toml`.

## Examples
- To add a new endpoint for both colleges, update each institution's `v1/index.ts` and implement the handler in a new or existing file.
- To debug a failing smoke test, check `scripts/smoke-test.sh` for skip logic and endpoint validation details.

---

For questions or unclear conventions, ask for clarification or review the referenced files for examples.

## TDD & agent guidance
- Tests are the contract: write a failing AVA test (unit or integration), implement code in `source/`, run `mise run test` until green.
- Prefer small, focused tests next to implementation files; mirror existing tests (examples: `source/menus-bonapp/menu.test.ts`, `source/calendar/ical.test.ts`).
- Use `/v1/routes` and `scripts/smoke-test.sh` to validate integration endpoints during PRs. Smoke tests are used in CI to catch regressions.
- When adding endpoints, update the relevant `v1/index.ts` for each institution and add both unit tests and a smoke/integration test when the change touches external APIs or routing.