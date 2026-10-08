import type {BreakCalendar, Schedule, AuthoredSpace, ResolvedSpace} from './types.ts'
import {parseScheduleData} from './parse.ts'

function fail(path: string, message: string): never {
	throw new Error(`${path}: ${message}`)
}

/** Local templates replace whole global policies; inherited object keys never count. */
function template(calendar: BreakCalendar<unknown>, key: string, name: string, path: string) {
	let local = calendar.breaks[key]?.templates ?? {}
	let global = calendar.templates ?? {}
	let policy = Object.hasOwn(local, name)
		? local[name]
		: Object.hasOwn(global, name)
			? global[name]
			: undefined
	return policy ?? fail(path, `unknown template ${name} in ${key}'s context`)
}

function resolveSpace(
	calendar: BreakCalendar<unknown>,
	space: AuthoredSpace<unknown>,
	index: number,
): ResolvedSpace<unknown> {
	const {breakSchedule: entries, ...fields} = space
	if (entries === undefined) return fields
	const policies = entries
	let resolved = new Map<string, Schedule<unknown>>()
	let visiting = new Set<string>()

	// Resolve and check references in one traversal. AAO validates each published
	// dataset, but independently fetched files can still contain incompatible references.
	function resolve(key: string): Schedule<unknown> {
		let path = `spaces[${index.toFixed(0)}].breakSchedule.${key}`
		let cached = resolved.get(key)
		if (cached) return cached
		if (visiting.has(key)) {
			fail(path, `cyclic break reference: ${[...visiting, key].join(' -> ')}`)
		}
		let entry = Object.hasOwn(calendar.breaks, key) ? calendar.breaks[key] : undefined
		if (entry === undefined) fail(path, 'unknown break key')
		let policy = Object.hasOwn(policies, key) ? policies[key] : undefined
		if (policy === undefined) fail(path, 'missing authored alias target')
		visiting.add(key)
		let result: Schedule<unknown>
		if (typeof policy !== 'string') {
			result = policy
		} else if (policy === 'normal') {
			result = {schedule: space.schedule, exceptions: space.exceptions ?? []}
		} else if (policy === 'inherit') {
			let fallback = entry.defaultSpaceSchedule
			if (fallback === undefined) fail(path, 'inherit requires a break default')
			if (typeof fallback === 'string') {
				if (
					fallback === 'normal' ||
					fallback === 'inherit' ||
					Object.hasOwn(calendar.breaks, fallback)
				) {
					fail(path, 'defaults cannot use normal, inherit or break references')
				}
				result = template(calendar, key, fallback, path)
			} else {
				result = fallback
			}
		} else if (Object.hasOwn(calendar.breaks, policy)) {
			// An alias uses its target break's template/default context.
			result = resolve(policy)
		} else {
			result = template(calendar, key, policy, path)
		}
		visiting.delete(key)
		resolved.set(key, result)
		return result
	}

	return {
		...fields,
		breakSchedule: Object.fromEntries(Object.keys(entries).map((key) => [key, resolve(key)])),
	}
}

/** Expand every authored policy and project its calendar, without date-dependent selection. */
export function resolveScheduleResponses(calendarInput: unknown, spacesInput: unknown) {
	let {calendar, spaces} = parseScheduleData(calendarInput, spacesInput)
	let hours = {data: spaces.map((space, index) => resolveSpace(calendar, space, index))}
	return {
		hours,
		calendar: {
			data: {
				timezone: calendar.timezone,
				breaks: Object.fromEntries(
					Object.entries(calendar.breaks).map(([key, entry]) => [
						key,
						entry.date !== undefined
							? {name: entry.name, date: entry.date}
							: {name: entry.name, start: entry.start, end: entry.end},
					]),
				),
			},
		},
	}
}
