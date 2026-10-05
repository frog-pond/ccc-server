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
	return spaces.map((space) => {
		let {breakSchedule: entries, ...fields} = space
		if (entries === undefined) return fields
		let resolved = new Map<string, Schedule<T>>()
		let template = (key: string, name: string): Schedule<T> => {
			let local = calendar.breaks[key]?.templates ?? {}
			let policy = Object.hasOwn(local, name) ? local[name] : calendar.templates?.[name]
			assert(policy !== undefined, `unknown template ${name}`)
			return policy
		}
		let resolve = (key: string): Schedule<T> => {
			let cached = resolved.get(key)
			if (cached) return cached
			let policy = entries[key]
			assert(policy !== undefined, `missing authored alias target ${key}`)
			let result: Schedule<T>
			if (typeof policy !== 'string') result = policy
			else if (policy === 'normal') {
				result = {schedule: space.schedule, exceptions: space.exceptions ?? []}
			} else if (policy === 'inherit') {
				let fallback = calendar.breaks[key]?.defaultSpaceSchedule
				assert(fallback !== undefined, `inherit requires a break default for ${key}`)
				result = typeof fallback === 'string' ? template(key, fallback) : fallback
			} else if (Object.hasOwn(calendar.breaks, policy)) result = resolve(policy)
			else result = template(key, policy)
			resolved.set(key, result)
			return result
		}
		return {
			...fields,
			breakSchedule: Object.fromEntries(Object.keys(entries).map((key) => [key, resolve(key)])),
		}
	})
}

/** Validates the complete pair before returning any canonical hours. */
export function resolveScheduleData(calendarInput: unknown, spacesInput: unknown) {
	let {calendar, spaces} = parseScheduleData(calendarInput, spacesInput)
	return {data: resolveSchedules(calendar, spaces)}
}

/** Pure calendar projection for the matched response contract; no route integration. */
export function calendarResponse<T>(calendar: BreakCalendar<T>) {
	return {
		data: {
			timezone: calendar.timezone,
			breaks: Object.fromEntries(
				Object.entries(calendar.breaks).map(([key, entry]) => {
					return [
						key,
						{
							name: entry.name,
							...(entry.date !== undefined
								? {date: entry.date}
								: {start: entry.start, end: entry.end}),
						},
					]
				}),
			),
		},
	}
}
