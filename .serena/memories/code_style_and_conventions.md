# Code Style and Conventions for ccc-server

## TypeScript Configuration
- **Strict mode enabled** - All strict type-checking options on
- **ES Modules** - Use `import`/`export`, not `require()`
- **Module resolution:** NodeNext
- **Target:** ESNext
- **Relative imports require `.js` extensions** (for ES modules)
- **Exact optional property types** - Optional properties don't automatically include `undefined`
- **No implicit returns** - All code paths must explicitly return
- **No unchecked indexed access** - Index access includes `undefined` in type

## Naming Conventions
- **Name by domain purpose, not implementation**
- **camelCase** for variables and functions
- **PascalCase** for types, interfaces, and classes
- **No temporal context** in names (e.g., don't use "new", "old", "v2")
- Private functions/variables can start with `_` (underscore)

## Code Style (Prettier)
```json
{
  "printWidth": 100,
  "useTabs": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": false,
  "semi": false
}
```
**Key points:**
- Tabs for indentation (not spaces)
- Single quotes for strings
- No semicolons
- No spaces in object braces: `{foo: 'bar'}` not `{ foo: 'bar' }`
- Trailing commas everywhere
- 100 character line width

## ESLint Rules (Notable)
- **`eqeqeq: always`** - Use `===` and `!==` (except `null` comparisons)
- **`no-var`** - Use `const` or `let`, never `var`
- **`linebreak-style: unix`** - LF line endings only
- **`curly: multi-line`** - Braces required for multi-line blocks
- **`@typescript-eslint/no-unused-vars`** - Warn on unused vars (args allowed if prefixed with `_`)
- **Strict type checking** from typescript-eslint

## File Organization
- **Test files** next to implementation: `foo.ts` and `foo.test.ts` in same directory
- **Types** in dedicated files: `types.ts`, `types-bonapp.ts`
- **Helpers** in `helpers.ts` when needed
- **Modular structure** - Each institution has its own directory

## Comments
- **Explain WHAT and WHY**, never HOW or temporal context
- No "changed on..." or "updated to..." comments
- Focus on domain logic and non-obvious decisions
- TypeScript types should make most comments unnecessary

## Import Style
- External packages first
- Internal modules second
- Grouped and sorted
- Must include `.js` extension for relative imports in ES modules

## Constants and Configuration
- Environment variables loaded via `dotenv`
- Type schemas defined with Zod
- Constants in `source/ccc-lib/constants.ts`

## Error Handling
- Sentry integration for production errors
- Koa middleware handles HTTP errors
- Type-safe error responses via `koa-json-error`

## Code Principles
1. **YAGNI** - Don't add features until needed
2. **Simplicity over cleverness** - Readability and maintainability are primary
3. **Match surrounding style** - Consistency within a file > external standards
4. **No manual whitespace changes** - Use formatter instead
5. **Fix bugs immediately** - Don't ask permission
6. **Smallest reasonable changes** - Minimize diff size
7. **Reduce duplication** - Refactor aggressively
