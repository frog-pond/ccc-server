import type {CalendarInterval} from './types.ts'

/** Date-only ordinal arithmetic counts calendar days independently of DST and process TZ. */
function day(date: string): number {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error('expected a date in YYYY-MM-DD form')
	let timestamp = Date.parse(`${date}T00:00:00Z`)
	if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
		throw new Error(`invalid calendar date ${date}`)
	}
	return timestamp / 86_400_000
}

/** Only validation ordinals are needed here; no active-break or service-window selection. */
export function normalizeCalendarInterval(interval: CalendarInterval, timezone: string) {
	new Intl.DateTimeFormat('en-US', {timeZone: timezone}).format(0)
	let start = day(interval.date ?? interval.start)
	let end = day(interval.date ?? interval.end)
	if (start > end) throw new Error('start must be on or before end')
	return {startDay: start, endDay: end + 1, calendarDays: end - start + 1}
}
