# Task Completion Checklist for ccc-server

## When a Task is Completed

### 1. Code Quality Checks
- [ ] Run `mise run lint` - Must pass with zero warnings
- [ ] Run `mise run pretty:check` - Formatting must be correct
- [ ] If formatting fails, run `mise run pretty` to auto-fix

### 2. Testing (TDD Workflow)
- [ ] Write failing test FIRST (*.test.ts next to implementation)
- [ ] Run `mise run test` - All unit tests must pass
- [ ] Implement code until tests pass
- [ ] Run smoke tests if touching API endpoints:
  - `mise run test:stolaf-college` for St. Olaf changes
  - `mise run test:carleton-college` for Carleton changes
- [ ] Verify test output is PRISTINE (no unexpected logs or errors)

### 3. Build Verification
- [ ] Run `mise run build` - Must compile without errors
- [ ] Check that TypeScript strict mode catches type errors
- [ ] Verify no implicit `any` types introduced

### 4. Manual Testing (if applicable)
- [ ] Test affected endpoints manually
- [ ] Verify `/v1/routes` endpoint still works
- [ ] Check that institution-specific server starts correctly
- [ ] Test with both `INSTITUTION=stolaf-college` and `INSTITUTION=carleton-college` if shared code

### 5. Git Workflow
- [ ] Run `git status` to review changes
- [ ] Stage specific files with `git add <files>` (NEVER `git add -A` without checking status first)
- [ ] Commit with descriptive message: `git commit -m "description"`
- [ ] Commit frequently throughout development
- [ ] Pre-commit hooks must pass (NEVER skip or disable)

### 6. Documentation
- [ ] Update comments if logic changes
- [ ] Update type definitions if data structures change
- [ ] Add JSDoc for exported functions if not obvious
- [ ] Update README if adding new commands or features

### 7. Code Review Checklist
- [ ] Smallest reasonable changes made
- [ ] No code duplication introduced
- [ ] Matches surrounding code style
- [ ] No backward compatibility added without approval
- [ ] No whitespace-only changes (except via formatter)
- [ ] Follows YAGNI principle
- [ ] Names reflect domain purpose, not implementation

### 8. CI/CD Considerations
- [ ] Changes compatible with GitHub Actions workflow
- [ ] mise tasks used (CI depends on them)
- [ ] Environment variables documented if new ones added
- [ ] Docker build still works if infrastructure changed

## TDD-Specific Checklist
For new features or bugfixes:
1. [ ] Write failing test first
2. [ ] Run test to verify it fails
3. [ ] Implement minimum code to pass
4. [ ] Run test to verify it passes
5. [ ] Refactor if needed
6. [ ] Run all tests to ensure no regressions

## Integration Testing
For changes to API endpoints:
1. [ ] Add unit test in `*.test.ts`
2. [ ] Verify smoke test covers the endpoint
3. [ ] Check `scripts/smoke-test.sh` for any skip logic
4. [ ] Test both success and error cases
5. [ ] Verify proper error responses

## Before Push
- [ ] All tests passing (`mise run test`)
- [ ] Linting clean (`mise run lint`)
- [ ] Formatting correct (`mise run p`)
- [ ] Build successful (`mise run build`)
- [ ] Smoke tests passing for affected institution(s)
- [ ] No debug console.logs left in code
- [ ] No TODOs or FIXMEs introduced without issue tracking
