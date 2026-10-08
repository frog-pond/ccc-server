import {normalizeCalendarInterval} from './calendar.ts'
import {classifyDefault, classifySpacePolicy} from './references.ts'
import type {BreakCalendar, CalendarInterval, Schedule, AuthoredSpace} from './types.ts'

/** Supplies an author-facing label without tying validation to files or buildings. */
export interface ScheduleValidationInput<T> {
	label: string
	schedules: AuthoredSpace<T>
}

interface CalendarValidationContext<T> {
	calendar: BreakCalendar<T>
	label: string
	breakKeys: Set<string>
}

interface ReferenceValidationContext<T> {
	calendar: BreakCalendar<T>
	label: string
	entries: Record<string, string | Schedule<T>>
	visiting: Set<string>
	visited: Set<string>
}

const reservedNames = new Set(['normal', 'inherit'])

/** Reports the location of invalid authored data. */
function fail(path: string, message: string): never {
	throw new Error(`${path}: ${message}`)
}

/**
 * Checks calendar, exception dates, namespaces and reference graphs after structural
 * validation. Service payloads remain generic; references are checked without
 * resolving or merging schedules, and validation is independent of today's date.
 */
export function validateSchedules<T>(
	calendar: BreakCalendar<T>,
	spaces: readonly ScheduleValidationInput<T>[],
	calendarLabel = 'calendar',
): void {
	// A calendar with no breaks still needs a usable timezone.
	normalizeInterval({date: '2000-01-01'}, calendar.timezone, `${calendarLabel}.timezone`)
	let context = {calendar, label: calendarLabel, breakKeys: new Set(Object.keys(calendar.breaks))}
	validateNamespaces(context)
	validateBreakIntervals(context)
	validateCalendarPolicies(context)
	validateSpaces(context, spaces)
}

function normalizeInterval(interval: CalendarInterval, timezone: string, path: string) {
	try {
		return normalizeCalendarInterval(interval, timezone)
	} catch (error) {
		return fail(path, error instanceof Error ? error.message : String(error))
	}
}

function validateNamespaces<T>({calendar, label, breakKeys}: CalendarValidationContext<T>): void {
	let templateKeys = new Set(Object.keys(calendar.templates ?? {}))
	for (let entry of Object.values(calendar.breaks)) {
		for (let key of Object.keys(entry.templates ?? {})) templateKeys.add(key)
	}
	for (let key of breakKeys) {
		if (reservedNames.has(key)) fail(`${label}.breaks.${key}`, 'reserved name')
		if (templateKeys.has(key)) {
			fail(`${label}.breaks.${key}`, 'break and template names must be disjoint')
		}
	}
	for (let key of templateKeys) {
		if (reservedNames.has(key)) fail(`${label}.templates.${key}`, 'reserved name')
	}
}

function validateBreakIntervals<T>({calendar, label}: CalendarValidationContext<T>): void {
	let intervals = Object.entries(calendar.breaks).map(([key, entry]) => ({
		key,
		...normalizeInterval(entry, calendar.timezone, `${label}.breaks.${key}`),
	}))
	for (let [index, first] of intervals.entries()) {
		for (let second of intervals.slice(index + 1)) {
			if (first.startMs === second.startMs && first.endMs === second.endMs) {
				fail(`${label}.breaks.${second.key}`, `duplicates the interval of ${first.key}`)
			}
			if (
				first.calendarDays === second.calendarDays &&
				first.startMs < second.endMs &&
				second.startMs < first.endMs
			) {
				fail(
					`${label}.breaks.${second.key}`,
					`overlaps ${first.key} with an equal calendar-day span`,
				)
			}
			let overlaps = first.startMs < second.endMs && second.startMs < first.endMs
			let nested =
				(first.startMs <= second.startMs && first.endMs >= second.endMs) ||
				(second.startMs <= first.startMs && second.endMs >= first.endMs)
			if (overlaps && !nested) {
				fail(`${label}.breaks.${second.key}`, `partially overlaps ${first.key}`)
			}
		}
	}
}

function validateSchedule<T>(policy: Schedule<T>, timezone: string, path: string): void {
	if (policy.schedule.length === 0) {
		fail(`${path}.schedule`, 'a schedule must contain at least one service')
	}
	// Complete policies may be reused by other breaks; retain out-of-range exceptions.
	let dates = new Set<string>()
	for (let [index, exception] of policy.exceptions.entries()) {
		let exceptionPath = `${path}.exceptions[${index.toFixed(0)}]`
		normalizeInterval({date: exception.date}, timezone, `${exceptionPath}.date`)
		if (dates.has(exception.date)) fail(exceptionPath, `duplicate exception date ${exception.date}`)
		dates.add(exception.date)
		if (exception.schedule.length === 0) {
			fail(`${exceptionPath}.schedule`, 'a replacement must contain at least one service')
		}
	}
}

function validateTemplates<T>(
	templates: Record<string, Schedule<T>>,
	timezone: string,
	path: string,
): void {
	for (let [name, policy] of Object.entries(templates)) {
		validateSchedule(policy, timezone, `${path}.${name}`)
	}
}

function validateCalendarPolicies<T>(context: CalendarValidationContext<T>): void {
	let {calendar, label} = context
	validateTemplates(calendar.templates ?? {}, calendar.timezone, `${label}.templates`)
	for (let [key, entry] of Object.entries(calendar.breaks)) {
		let path = `${label}.breaks.${key}`
		validateTemplates(entry.templates ?? {}, calendar.timezone, `${path}.templates`)
		validateDefaultPolicy(context, key, `${path}.defaultSpaceSchedule`)
	}
}

function validateDefaultPolicy<T>(
	context: CalendarValidationContext<T>,
	key: string,
	path: string,
): void {
	let {calendar} = context
	let policy = calendar.breaks[key]?.defaultSpaceSchedule
	if (policy === undefined) return
	let classified = classifyDefault(calendar, key, policy, path)
	if (classified.kind === 'inline') validateSchedule(classified.policy, calendar.timezone, path)
}

function validateSpaces<T>(
	context: CalendarValidationContext<T>,
	spaces: readonly ScheduleValidationInput<T>[],
): void {
	let names = new Map<string, string>()
	for (let {label, schedules} of spaces) {
		let previous = names.get(schedules.name)
		if (previous !== undefined) {
			fail(
				`${label}.name`,
				`duplicate space name ${schedules.name}; first defined at ${previous}.name`,
			)
		}
		names.set(schedules.name, label)
		validateSchedule(
			{schedule: schedules.schedule, exceptions: schedules.exceptions ?? []},
			context.calendar.timezone,
			label,
		)
		validateSpaceReferences(context, schedules.breakSchedule ?? {}, label)
	}
}

function validateSpaceReferences<T>(
	context: CalendarValidationContext<T>,
	entries: Record<string, string | Schedule<T>>,
	label: string,
): void {
	for (let key of Object.keys(entries)) {
		if (!context.breakKeys.has(key)) fail(`${label}.breakSchedule.${key}`, 'unknown break key')
	}
	let graph: ReferenceValidationContext<T> = {
		calendar: context.calendar,
		label,
		entries,
		visiting: new Set(),
		visited: new Set(),
	}
	for (let key of Object.keys(entries)) visitBreakPolicy(graph, key, [])
}

function visitBreakPolicy<T>(
	context: ReferenceValidationContext<T>,
	key: string,
	trail: string[],
): void {
	let {entries, visiting, visited, calendar, label} = context
	let path = `${label}.breakSchedule.${key}`
	if (visiting.has(key)) fail(path, `cyclic break reference: ${[...trail, key].join(' -> ')}`)
	if (visited.has(key)) return
	let policy = entries[key]
	if (!Object.hasOwn(entries, key) || policy === undefined) {
		fail(path, 'missing authored alias target')
	}
	visiting.add(key)
	let classified = classifySpacePolicy(calendar, key, policy, path)
	switch (classified.kind) {
		case 'alias':
			if (classified.target === key) fail(path, 'a break cannot reference itself')
			visitBreakPolicy(context, classified.target, [...trail, key])
			break
		case 'inline':
			validateSchedule(classified.policy, calendar.timezone, path)
			break
		case 'normal':
		case 'inherit':
		case 'template':
			break
	}
	visiting.delete(key)
	visited.add(key)
}
