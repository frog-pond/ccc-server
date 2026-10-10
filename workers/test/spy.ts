import {vi, type MockInstance} from 'vitest'

/// A spy on the global fetch. The `dom` lib, which source/ccc-lib/dom.ts needs,
/// types `fetch` in a way `vi.spyOn(globalThis, 'fetch')` can't infer from.
export const spyOnFetch = () =>
	vi.spyOn(globalThis as {fetch: typeof fetch}, 'fetch') as MockInstance<typeof fetch>
