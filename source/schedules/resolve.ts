import assert from 'node:assert/strict'
import type {BreakCalendar, Schedule, AuthoredSpace, ResolvedSpace} from './types.ts'
import {parseScheduleData} from './parse.ts'
import {validateSchedules} from './validate.ts'
import {classifySpacePolicy} from './references.ts'

/** Expand all authored entries, without consulting the clock or modifying inputs. */
export function resolveSchedules<T>(
	calendar: BreakCalendar<T>,
	spaces: readonly AuthoredSpace<T>[],
): ResolvedSpace<T>[] {
	validateSchedules(
		calendar,
		spaces.map((schedules, index) => ({label: `spaces[${index.toFixed(0)}]`, schedules})),
	)
	return resolveValidatedSchedules(calendar, spaces)
}

/** Internal expansion for inputs whose complete reference graph has been validated. */
function resolveValidatedSchedules<T>(
	calendar: BreakCalendar<T>,
	spaces: readonly AuthoredSpace<T>[],
): ResolvedSpace<T>[] {
	return spaces.map((space) => resolveSpace(calendar, space))
}

interface ResolutionContext<T> {
	calendar: BreakCalendar<T>
	space: AuthoredSpace<T>
	resolved: Map<string, Schedule<T>>
}

function resolveSpace<T>(calendar: BreakCalendar<T>, space: AuthoredSpace<T>): ResolvedSpace<T> {
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
	let result = resolvePolicy(context, key, policy)
	context.resolved.set(key, result)
	return result
}

function resolvePolicy<T>(
	context: ResolutionContext<T>,
	key: string,
	policy: string | Schedule<T>,
): Schedule<T> {
	let {calendar, space} = context
	let classified = classifySpacePolicy(calendar, key, policy, `breakSchedule.${key}`)
	switch (classified.kind) {
		case 'normal':
			return {schedule: space.schedule, exceptions: space.exceptions ?? []}
		case 'inherit':
			return classified.fallback.policy
		// Aliases use the target break's template/default context.
		case 'alias':
			return resolveBreakPolicy(context, classified.target)
		case 'template':
		case 'inline':
			return classified.policy
	}
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
