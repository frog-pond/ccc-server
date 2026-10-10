import moment from 'moment-timezone'
import getUrls from 'get-urls'
import {z} from 'zod'
import {EventSchema, type EventType} from '../../../source/calendar/types.ts'
import {textFromHtml} from '../../../source/ccc-lib/dom.ts'

/// The Events Calendar (Tribe, "TEC") REST API, as St. Olaf's
/// `wp.stolaf.edu/calendar` serves it. Read the way AAO-React-Native's own
/// parser reads it; only the fields an event can show are modelled.

/// A venued event carries an object; a venue-less one carries an empty array
/// rather than omitting the key.
const VenueSchema = z.union([z.object({venue: z.string().optional()}), z.tuple([])]).optional()

/// Always an array; an event no organiser sponsors carries `[]`.
const OrganizerSchema = z.array(z.object({organizer: z.string().optional()})).default([])

const TecEventSchema = z.object({
	id: z.number().optional(),
	title: z.string(),
	description: z.string(),
	url: z.string(),
	all_day: z.boolean(),
	utc_start_date: z.string(),
	utc_end_date: z.string(),
	venue: VenueSchema,
	organizer: OrganizerSchema,
	categories: z.array(z.object({name: z.string()})).default([]),
})

type TecEvent = z.infer<typeof TecEventSchema>

/// One page of the feed: its events, and where the next page is.
export const TecPageSchema = z.object({
	events: z.array(z.unknown()),
	next_rest_url: z.string().optional(),
})

/// TEC sends "2026-08-17 13:00:00": UTC, with a space and no zone marker.
const utc = (text: string) => moment.utc(text, 'YYYY-MM-DD HH:mm:ss')

/// TEC escapes the free text it sends, so an apostrophe arrives as `&#8217;`.
const decoded = (text: string) => textFromHtml(text)

function convertEvent(event: TecEvent, now: moment.Moment): EventType {
	let startTime = utc(event.utc_start_date)
	let endTime = utc(event.utc_end_date)
	let description = decoded(event.description)
	let venue = Array.isArray(event.venue) ? '' : (event.venue?.venue ?? '')
	let organization = event.organizer.flatMap((entry) =>
		entry.organizer ? [decoded(entry.organizer)] : [],
	)

	return EventSchema.parse({
		dataSource: 'tribe',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: decoded(event.title),
		description,
		location: decoded(venue),
		isOngoing: startTime.isBefore(now, 'day'),
		// descriptions commonly link back to the event's own page
		links: [...new Set([...getUrls(description), event.url])],
		metadata: {
			uid: event.id === undefined ? undefined : String(event.id),
			categories: event.categories.map((category) => decoded(category.name)),
			...(organization.length > 0 ? {organization} : {}),
		},
		config: {startTime: !event.all_day, endTime: !event.all_day, subtitle: 'location'},
	})
}

/// The events of a TEC feed's pages, soonest first. Each event is read on its
/// own, so one TEC cannot fully describe does not blank the rest; but a feed of
/// events that all fail means the shape changed, which is an error and not an
/// empty calendar.
export function eventsFromTec(items: unknown[], now = moment()): EventType[] {
	let events = items.flatMap((raw) => {
		let event = TecEventSchema.safeParse(raw)
		return event.success ? [event.data] : []
	})
	if (items.length > 0 && events.length === 0) {
		throw new Error('None of the Tribe events could be read')
	}

	return events
		.map((event) => convertEvent(event, now))
		.sort((a, b) => a.startTime.localeCompare(b.startTime))
}
