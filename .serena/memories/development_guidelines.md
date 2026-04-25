# Development Guidelines and Patterns for ccc-server

## TDD Workflow (MANDATORY)
1. **Write test first** - Create `*.test.ts` file next to implementation
2. **Run test** - Verify it fails with `mise run test`
3. **Implement** - Write minimum code to pass
4. **Verify** - Run `mise run test` until green
5. **Refactor** - Clean up while keeping tests green
6. **Smoke test** - Run `mise run test:<institution>` for integration check

**Example test pattern:**
```typescript
import {expect, test} from 'vitest'
import {functionName} from './index.js'

test('descriptive test name', async () => {
  const result = await functionName(input)
  expect(result).toEqual(expected)
})
```

## Adding New API Endpoints
1. Add route handler in `source/ccci-<institution>/v1/new-endpoint.ts`
2. Create test file `source/ccci-<institution>/v1/new-endpoint.test.ts`
3. Register route in `source/ccci-<institution>/v1/index.ts`
4. Verify appears in `/v1/routes` endpoint
5. Update smoke test if integration testing needed
6. Test with both institutions if shared code

## Zod Schema Patterns
Used for validating external API responses:

```typescript
import {z} from 'zod'

// Define schema
const MyApiResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  optional: z.string().optional(),
})

// Infer type
type MyApiResponse = z.infer<typeof MyApiResponseSchema>

// Validate
const data = MyApiResponseSchema.parse(response)
```

**Custom validators in types-bonapp.ts:**
- `zodNumericString` - String that's actually a number
- `zodNumericBoolean` - Number that's actually boolean (0/1)
- `zodYesNo` - "yes"/"no" strings
- `zodHtmlString` - HTML content as string
- `zod24Time` - 24-hour time format
- `zodCurrencyString` - Currency as string

## Koa Router Patterns
```typescript
import Router from '@koa/router'

const router = new Router()

router.get('/endpoint', async (ctx) => {
  // Fetch data
  const data = await fetchSomething()
  
  // Set response
  ctx.body = data
  
  // Optional: set cache headers
  ctx.cacheControl = {maxAge: 3600}
})

export default router
```

## Error Handling
- Koa middleware catches errors automatically
- Use `ctx.throw(statusCode, message)` for HTTP errors
- Sentry captures uncaught errors in production
- Return proper HTTP status codes (200, 404, 500, etc.)

## Caching Strategy
- Use `koa-cash` middleware for endpoint caching
- Set `ctx.cacheControl` for browser/CDN caching
- ETags automatically generated via `koa-etag`
- Conditional GET support via `koa-conditional-get`

## Environment Variables
Load from `.env` file via `dotenv`:
```typescript
import 'dotenv/config'

const apiKey = process.env.BON_APPETIT_API_USERNAME
if (!apiKey) throw new Error('Missing BON_APPETIT_API_USERNAME')
```

## HTTP Requests
Use built-in `fetch` or helpers from `source/ccc-lib/http.ts`:
```typescript
const response = await fetch(url, {
  headers: {
    'Authorization': `Basic ${credentials}`,
  },
})
const data = await response.json()
```

## Type Safety Principles
- Never use `any` - use `unknown` if type truly unknown
- Enable all strict TypeScript options
- Validate external data with Zod schemas
- Use type guards for runtime checks
- Prefer interfaces for public APIs, types for internal

## Git Commit Guidelines
- **Commit frequently** during development
- **Small, focused commits** - one logical change per commit
- **Descriptive messages** - explain what and why
- **Check status first** - `git status` before `git add`
- **Stage selectively** - `git add <files>`, not `-A`
- **Run tests before commit** - ensure green
- **Pre-commit hooks** - must pass, never skip

## Testing Patterns

### Unit Tests (Vitest)
- Test business logic in isolation
- Mock external APIs if needed
- Use real data structures
- Test both success and error cases
- Keep tests fast

### Smoke Tests (Integration)
- Test actual endpoints
- Use real external APIs
- Verify full request/response cycle
- Check for regressions
- Some endpoints skipped (see `scripts/smoke-test.sh`)

## Code Review Self-Checklist
Before marking task complete:
1. ✅ Tests passing
2. ✅ Lint passing
3. ✅ Format correct
4. ✅ No console.logs
5. ✅ Types explicit
6. ✅ Errors handled
7. ✅ Documentation updated
8. ✅ Follows existing patterns
9. ✅ Minimal changes
10. ✅ Git commits clean

## Common Gotchas
- **ES modules** - Must use `.js` extensions in imports
- **Tabs vs spaces** - Use tabs (Prettier enforces)
- **Institution switching** - Must set `INSTITUTION` env var
- **Type checking** - Strict mode catches many runtime errors
- **Cache invalidation** - Consider when updating endpoints
- **External API changes** - Validate with Zod schemas
