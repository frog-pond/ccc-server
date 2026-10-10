import moment from 'moment-timezone'
import {getText} from '../ccc-lib/http.ts'
import {eventsFromIcal} from './ical-shape.ts'

export {parseCalendar} from './ical-shape.ts'

export async function ical(
	url: string | URL,
	options: {onlyFuture?: boolean; maxEndDate?: moment.Moment} = {},
	now = moment(),
) {
	let body = await getText(url, {headers: {accept: 'text/calendar'}})
	return eventsFromIcal(body, url, options, now)
}
