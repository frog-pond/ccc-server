import assert from 'node:assert/strict'
import type {BreakCalendar, Schedule, Space} from './types.ts'
import {parseScheduleData} from './parse.ts'
import {validateSchedules} from './validate.ts'

/** Expand all authored entries, without consulting the clock or modifying inputs. */
export function resolveSchedules<T>(
	calendar: BreakCalendar<T>,
	spaces: readonly Space<T, string | Schedule<T>>[],
): Space<T>[] {
	validateSchedules(
		calendar,
		spaces.map((schedules, index) => ({label: `spaces[${index.toFixed(0)}]`, schedules})),
	)
	return resolveValidatedSchedules(calendar, spaces)
}

/** Internal expansion for inputs whose complete reference graph has been validated. */
function resolveValidatedSchedules<T>(
	calendar: BreakCalendar<T>,
	spaces: readonly Space<T, string | Schedule<T>>[],
): Space<T>[] {
	return spaces.map((space) => resolveSpace(calendar, space))
}

interface ResolutionContext<T> {
	calendar: BreakCalendar<T>
	space: Space<T, string | Schedule<T>>
	resolved: Map<string, Schedule<T>>
}

function resolveSpace<T>(
	calendar: BreakCalendar<T>,
	space: Space<T, string | Schedule<T>>,
): Space<T> {
	let {breakSchedule: entries, ...fields} = space
	if (entries === undefined) return fields

	let context: ResolutionContext<T> = {calendar, space, resolved: new Map()}
	let breakSchedule = Object.fromEntries(
		Object.keys(entries).map((key) => [key, resolveBreakPolicy(context, key)]),
	)
	return {...fields, breakSchedule}
}

function resolveBreakPolicy<T>(context: ResolutionContext<T>, key: string): Schedule<T> {
	let cached = context.resolved.get(key)
	if (cached) return cached

	let policy = context.space.breakSchedule?.[key]
	assert(policy !== undefined, `missing authored alias target ${key}`)
	let result = typeof policy === 'string' ? resolveReference(context, key, policy) : policy
	context.resolved.set(key, result)
	return result
}

function resolveReference<T>(
	context: ResolutionContext<T>,
	key: string,
	reference: string,
): Schedule<T> {
	let {calendar, space} = context
	if (reference === 'normal') {
		return {schedule: space.schedule, exceptions: space.exceptions ?? []}
	}
	if (reference === 'inherit') {
		let fallback = calendar.breaks[key]?.defaultSpaceSchedule
		assert(fallback !== undefined, `inherit requires a break default for ${key}`)
		return typeof fallback === 'string' ? resolveTemplate(calendar, key, fallback) : fallback
	}
	// Aliases use the target break's template/default context.
	if (Object.hasOwn(calendar.breaks, reference)) return resolveBreakPolicy(context, reference)
	return resolveTemplate(calendar, key, reference)
}

function resolveTemplate<T>(calendar: BreakCalendar<T>, key: string, name: string): Schedule<T> {
	let local = calendar.breaks[key]?.templates ?? {}
	let policy = Object.hasOwn(local, name) ? local[name] : calendar.templates?.[name]
	assert(policy !== undefined, `unknown template ${name}`)
	return policy
}

/** Validates the complete pair before returning any canonical hours. */
export function resolveScheduleData(calendarInput: unknown, spacesInput: unknown) {
	let {calendar, spaces} = parseScheduleData(calendarInput, spacesInput)
	return {data: resolveValidatedSchedules(calendar, spaces)}
}

/** Pure calendar projection for the matched response contract; no route integration. */
export function calendarResponse<T>(calendar: BreakCalendar<T>) {
	return {
		data: {
			timezone: calendar.timezone,
			breaks: Object.fromEntries(
				Object.entries(calendar.breaks).map(([key, entry]) => [key, calendarBreakResponse(entry)]),
			),
		},
	}
}

function calendarBreakResponse<T>(entry: BreakCalendar<T>['breaks'][string]) {
	if (entry.date !== undefined) return {name: entry.name, date: entry.date}
	return {name: entry.name, start: entry.start, end: entry.end}
}
