import {get} from '../ccc-lib/http.js'

export async function theEventsCalendar(calendarUrl) {
	let body = await get(calendarUrl).json()
	return body.events
}
