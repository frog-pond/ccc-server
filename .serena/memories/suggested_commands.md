# Suggested Commands for ccc-server

## Task Runner
**PREFERRED:** Use `mise run <task>` where possible (CI uses these)

## Development Commands

### Install Dependencies
```bash
npm ci           # Clean install (preferred for CI)
npm install      # Regular install
```

### Build
```bash
mise run build   # Clean build (removes dist and .tsbuildinfo, runs tsc)
npm run build    # Alternative
```

### Watch Mode (Auto-compile & Restart)
```bash
mise run watch           # Recommended for development
npm run watch            # Alternative
mise run build:watch     # TypeScript watch only (no restart)
```

### Run Server - Development
```bash
mise run stolaf-college    # Run St. Olaf server (sets INSTITUTION env var)
mise run carleton-college  # Run Carleton server (sets INSTITUTION env var)
npm run start:dev          # Generic dev start (requires INSTITUTION env)
```

### Run Server - Production
```bash
mise run start:prod   # NODE_ENV=production
npm run start:prod    # Alternative
```

## Testing Commands

### Unit Tests (Vitest)
```bash
mise run test     # Run all unit tests
npm test          # Alternative
```

### Smoke Tests (Integration)
```bash
mise run test:stolaf-college    # Smoke test St. Olaf endpoints
mise run test:carleton-college  # Smoke test Carleton endpoints
npm run test:stolaf-college     # Alternative
npm run test:carleton-college   # Alternative
```

**Note:** Smoke tests run `scripts/smoke-test.sh`, which:
- Starts server in SMOKE_TEST mode
- Validates `/ping` and most `/v1` routes
- Some routes intentionally skipped (see script for details)

## Code Quality Commands

### Linting
```bash
mise run lint    # ESLint with cache, max-warnings=0
npm run lint     # Alternative
```

### Formatting
```bash
mise run pretty         # Format source/ and scripts/ with Prettier
mise run p              # Check formatting (no write)
mise run pretty:check   # Alias for 'p'
npm run pretty          # Alternative
```

## Git Commands (macOS/Darwin)
```bash
git status              # Check status
git add <files>         # Stage specific files (NEVER use -A without git status first)
git commit -m "msg"     # Commit staged changes
git log --oneline       # View commit history
git diff                # View unstaged changes
git diff --staged       # View staged changes
```

## System Commands (macOS)
```bash
ls -la                  # List files (including hidden)
cd <directory>          # Change directory
pwd                     # Print working directory
cat <file>              # Display file contents
grep -r "pattern" .     # Search for pattern recursively
find . -name "*.ts"     # Find TypeScript files
```

## Environment Variables
- `INSTITUTION` - Required: `stolaf-college` or `carleton-college`
- `NODE_ENV` - `development` or `production`
- `NODE_PORT` - Server port (default: 3000)
- `SMOKE_TEST` - Set to disable port binding during tests
- `BON_APPETIT_API_USERNAME` - Basic auth for BonApp API v2
- `BON_APPETIT_API_PASSWORD` - Basic auth for BonApp API v2
