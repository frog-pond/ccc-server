import {TZDateMini} from '@date-fns/tz'
import {addDays, differenceInCalendarDays, format, isValid, parse} from 'date-fns'
import type {CalendarInterval} from './types.ts'

/** Parses a real date without allowing timestamps or rollover into another month. */
function parseCalendarDate(date: string, timezone: string): Date {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
		throw new Error(`Invalid calendar date: ${date}`)
	}
	let parsed = parse(date, 'yyyy-MM-dd', new TZDateMini(2000, 0, 1, timezone))
	if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== date) {
		throw new Error(`Invalid calendar date: ${date}`)
	}
	return parsed
}

/**
 * Normalizes inclusive local dates to half-open epoch boundaries. The final
 * midnight advances by calendar day, so a DST day can last 23 or 25 hours.
 */
export function normalizeCalendarInterval(interval: CalendarInterval, timezone: string) {
	// Check the zone before date-fns asks Intl for offsets. An empty zone must
	// not silently select the device's timezone.
	if (!timezone) throw new Error('A calendar timezone is required')
	new Intl.DateTimeFormat('en-US', {timeZone: timezone})
	let input: {date?: string; start?: string; end?: string} = interval
	let startDate = input.date ?? input.start
	let endDate = input.date ?? input.end
	if (
		(input.date !== undefined && (input.start !== undefined || input.end !== undefined)) ||
		startDate === undefined ||
		endDate === undefined
	) {
		throw new Error('A calendar interval requires date or both start and end')
	}
	let start = parseCalendarDate(startDate, timezone)
	let end = parseCalendarDate(endDate, timezone)
	if (start.getTime() > end.getTime()) {
		throw new Error('A calendar interval must start on or before its end')
	}
	return {
		startMs: start.getTime(),
		endMs: addDays(end, 1).getTime(),
		calendarDays: differenceInCalendarDays(end, start) + 1,
	}
}
