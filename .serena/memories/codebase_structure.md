# ccc-server Codebase Structure

## Root Directory Structure
```
ccc-server/
├── .config/          # mise task runner configuration
├── .github/          # GitHub Actions workflows
├── docs/             # Project documentation
├── nginx/            # Nginx configuration for deployment
├── scripts/          # Build and test scripts
├── source/           # TypeScript source code (main)
├── types/            # Custom TypeScript type definitions
├── dist/             # Compiled JavaScript output (gitignored)
└── node_modules/     # Dependencies (gitignored)
```

## Source Code Organization (`source/`)

### Institution-Specific Modules
- `source/ccci-stolaf-college/` - St. Olaf College API
  - `index.ts` - Institution router setup
  - `v1/index.ts` - v1 API routes registration
  - `v1/*.ts` - Individual endpoint implementations (menu, calendar, contacts, etc.)
  - `v1/*.test.ts` - Unit tests next to implementations

- `source/ccci-carleton-college/` - Carleton College API (same structure)

### Shared Modules
- `source/ccc-server/` - **Server core**
  - `index.ts` - Entry point
  - `server.ts` - Main server setup, middleware, institution selection
  - `context.ts` - Koa context type definitions

- `source/ccc-lib/` - **Common utilities**
  - `constants.ts` - Shared constants
  - `html-to-markdown.ts` - HTML conversion
  - `html.ts` - HTML utilities
  - `http.ts` - HTTP helpers
  - `url.ts` - URL manipulation
  - `keysOf.ts` - Type-safe object key helpers

- `source/calendar/` - **Calendar integration**
  - `google.ts` - Google Calendar API
  - `ical.ts` - iCalendar parsing
  - `ical.test.ts` - iCal tests
  - `types.ts` - Calendar type definitions

- `source/menus-bonapp/` - **Bon Appétit menu integration**
  - `index.ts` - Main menu API functions
  - `index.test.ts` - Menu tests
  - `helpers.ts` - Menu helper functions
  - `types.ts` - Public menu types
  - `types-bonapp.ts` - Bon Appétit API schemas (Zod)

- `source/feeds/` - **Feed parsing**
  - `rss.ts` - RSS feed parser
  - `wp-json.ts` - WordPress JSON API
  - `types.ts` - Feed type definitions

- `source/student-orgs/` - **Student organizations**
  - `presence.ts` - Organization presence data
  - `types.ts` - Organization types

## Key Files

### Configuration
- `package.json` - NPM dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `.config/mise.toml` - Task runner configuration (preferred)
- `eslint.config.js` - ESLint configuration
- `vitest.config.ts` - Test runner configuration
- `.env` - Environment variables (gitignored)
- `.env.sample` - Environment variable template

### Documentation
- `README.md` - Getting started guide
- `AGENTS.md` - AI assistant collaboration rules
- `.github/copilot-instructions.md` - Copilot-specific instructions
- `docs/Task.md` - Current task specification

### Testing
- `scripts/smoke-test.sh` - Integration test script
- `*.test.ts` - Unit tests (co-located with implementations)

### Deployment
- `Dockerfile` - Container image definition
- `docker-compose.yml` - Multi-container setup
- `nginx/` - Reverse proxy configuration

## Module Dependencies Flow
```
ccc-server/index.ts
  └─> ccc-server/server.ts
       ├─> ccci-stolaf-college/index.ts
       │    └─> ccci-stolaf-college/v1/*.ts
       │         ├─> menus-bonapp/
       │         ├─> calendar/
       │         ├─> feeds/
       │         └─> ccc-lib/
       └─> ccci-carleton-college/index.ts
            └─> ccci-carleton-college/v1/*.ts
                 ├─> menus-bonapp/
                 ├─> calendar/
                 ├─> feeds/
                 └─> ccc-lib/
```

## Naming Patterns
- `index.ts` - Module entry point or router
- `*.test.ts` - Unit tests
- `types.ts` - Public type definitions
- `types-*.ts` - External API schemas (e.g., `types-bonapp.ts`)
- `helpers.ts` - Helper/utility functions
- `v1/` - API version 1 endpoints

## Build Output
- Compiled to `dist/` preserving source structure
- Source maps generated for debugging
- `.tsbuildinfo` for incremental compilation
