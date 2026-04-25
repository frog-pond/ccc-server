# ccc-server Project Overview

## Purpose
Node.js backend server acting as a **caching proxy** for college-specific APIs and data sources, serving St. Olaf College and Carleton College.

## Tech Stack
- **Runtime:** Node.js v22.20.0 (managed via mise)
- **Language:** TypeScript (strict mode, ES modules)
  - Target: ESNext
  - Module: NodeNext
  - Incremental builds with `.tsbuildinfo`
- **Framework:** Koa (v2.16.2) for HTTP server
- **Testing:** Vitest for unit tests
- **Validation:** Zod for schema validation
- **Error Monitoring:** Sentry (@sentry/node)
- **Task Runner:** mise (preferred) with fallback to npm scripts

## Architecture

### Modular Institution Structure
- `source/ccci-stolaf-college/` - St. Olaf College endpoints
- `source/ccci-carleton-college/` - Carleton College endpoints
- Each institution exposes `/v1` API router with endpoints for:
  - Food menus
  - Calendars
  - Contacts
  - News
  - Organizations
  - Hours
  - Jobs, etc.

### Shared Modules
- `source/ccc-lib/` - Common utilities (HTML, HTTP, URL handling)
- `source/calendar/` - Calendar integration (Google Calendar, iCal)
- `source/feeds/` - RSS and WP-JSON parsing
- `source/menus-bonapp/` - Bon Appétit menu integration
- `source/student-orgs/` - Student organization data

### Server Entry Point
- `source/ccc-server/server.ts` - Main server setup
- `source/ccc-server/index.ts` - Entry point
- Institution selected via `INSTITUTION` environment variable (`stolaf-college` or `carleton-college`)

## Data Flow
1. Requests enter via Koa server
2. Routed by institution
3. Handled by modular endpoint files
4. Some endpoints proxy/transform external data (Google Calendar, BonApp menus, RSS feeds)
5. Responses cached and compressed

## Key Features
- Caching proxy for external APIs
- Institution-specific routing
- Middleware stack: logging, compression, etag, cache-control
- Sentry error handling
- `/v1/routes` endpoint for introspection
