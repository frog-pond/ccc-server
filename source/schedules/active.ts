import type {ResolvedSpace} from './types.ts'

interface CalendarResponse {
	data: {
		timezone: string
		breaks: Record<string, {name: string; date?: string; start?: string; end?: string}>
	}
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()
const clockFormats = new Map<string, Intl.DateTimeFormat>()

function cached(
	formats: Map<string, Intl.DateTimeFormat>,
	timezone: string,
	options: Intl.DateTimeFormatOptions,
) {
	let format = formats.get(timezone)
	if (!format) {
		format = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, ...options})
		formats.set(timezone, format)
	}
	return format
}

/** The calendar date (YYYY-MM-DD) at `now` in `timezone`. */
export function campusDate(now: number, timezone: string): string {
	let parts = cached(dateFormats, timezone, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now)
	let part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
	return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * Seconds left in the day at `now` in `timezone`. Counted from the clock's own
 * hours, minutes and seconds, so it is exact in the last hours before midnight,
 * which are the only ones a cache lifetime of an hour or less can reach.
 */
export function secondsUntilMidnight(now: number, timezone: string): number {
	let parts = cached(clockFormats, timezone, {
		hourCycle: 'h23',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	}).formatToParts(now)
	let part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
	return 24 * 60 * 60 - (part('hour') * 60 * 60 + part('minute') * 60 + part('second'))
}

/** Inclusive length in days of an ISO date interval, by UTC date arithmetic. */
function lengthInDays(start: string, end: string): number {
	return (Date.parse(end) - Date.parse(start)) / (24 * 60 * 60 * 1000) + 1
}

/**
 * The breaks under way on `date`, shortest first: a space that has a schedule
 * for both Easter and Spring Break keeps Easter's on Easter itself. Equal
 * lengths keep the calendar's order.
 */
export function activeBreaks(calendar: CalendarResponse, date: string): string[] {
	let active: {key: string; days: number}[] = []
	for (let [key, entry] of Object.entries(calendar.data.breaks)) {
		let start = entry.date ?? entry.start
		let end = entry.date ?? entry.end
		if (start === undefined || end === undefined) continue
		if (start <= date && date <= end) active.push({key, days: lengthInDays(start, end)})
	}
	return active.sort((a, b) => a.days - b.days).map(({key}) => key)
}

/**
 * The hours as they stand at `now`: during a break, each space with a schedule
 * for it serves that schedule and its exceptions as its own, so a client that
 * only reads `schedule` shows the break hours. `breakSchedule` is kept whole,
 * and spaces without an entry for the break keep their usual hours.
 */
export function hoursAt<T>(
	responses: {hours: {data: ResolvedSpace<T>[]}; calendar: CalendarResponse},
	now: number,
): {data: ResolvedSpace<T>[]} {
	let date = campusDate(now, responses.calendar.data.timezone)
	let active = activeBreaks(responses.calendar, date)
	if (active.length === 0) return responses.hours
	return {
		data: responses.hours.data.map((space) => {
			let policies = space.breakSchedule
			if (!policies) return space
			let key = active.find((candidate) => Object.hasOwn(policies, candidate))
			let policy = key === undefined ? undefined : policies[key]
			if (policy === undefined) return space
			return {...space, schedule: policy.schedule, exceptions: policy.exceptions}
		}),
	}
}
