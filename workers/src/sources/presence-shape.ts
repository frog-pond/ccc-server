import getUrls from 'get-urls'
import moment from 'moment-timezone'
import {z} from 'zod'
import {EventSchema, type EventType} from '../../../source/calendar/types.ts'
import {textFromHtml} from '../../../source/ccc-lib/dom.ts'

/// Presence's public API is the one its own web app reads: for St. Olaf,
/// `https://api.presence.io/stolaf/v1/events`. Only the fields the calendar can
/// show are modelled; RSVP counts and contact details have nowhere to go in an
/// event. This reads it the way AAO-React-Native's own Presence parser does.
const PresenceEventSchema = z.object({
	eventNoSqlId: z.string().optional(),
	eventName: z.string(),
	organizationName: z.string(),
	uri: z.string(),
	description: z.string().default(''),
	location: z.string().default(''),
	startDateTimeUtc: z.string(),
	endDateTimeUtc: z.string(),
	hasCoverImage: z.boolean().default(false),
	photoUriWithVersion: z.string().optional(),
})

type PresenceEvent = z.infer<typeof PresenceEventSchema>

const EVENT_PAGE = 'https://stolaf.presence.io/event/'

/// Where Presence's own site loads an event's cover image from: its campus CDN
/// and the campus's id, then the event's `photoUriWithVersion`.
const EVENT_PHOTOS =
	'https://stolaf-cdn.presence.io/event-photos/09ddef77-5009-4348-8540-c9bfc6ade6bc/'

function coverImage(event: PresenceEvent): string | undefined {
	return event.hasCoverImage && event.photoUriWithVersion
		? `${EVENT_PHOTOS}${event.photoUriWithVersion}`
		: undefined
}

function convertEvent(event: PresenceEvent, now: moment.Moment): EventType {
	// Presence already emits ISO-8601 with a `Z`
	let startTime = moment(event.startDateTimeUtc)
	let endTime = moment(event.endDateTimeUtc)
	let description = textFromHtml(event.description)
	let image = coverImage(event)

	return EventSchema.parse({
		dataSource: 'presence',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.eventName,
		description,
		location: event.location,
		isOngoing: startTime.isBefore(now, 'day'),
		// a description that already links to the event's own page would
		// otherwise list it twice
		links: [...new Set([...getUrls(description), `${EVENT_PAGE}${event.uri}`])],
		...(image && {image}),
		metadata: {uid: event.eventNoSqlId, organization: event.organizationName},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})
}

/// The events of a Presence response that are on now or still to come, soonest
/// first. The outer shape is strict: a response that is not a list means the
/// source is wrong. Each event is read on its own, so one Presence cannot fully
/// describe does not blank the rest; but a response of events that all fail
/// means the shape changed, which is an error and not an empty calendar.
export function eventsFromPresence(body: unknown, now = moment()): EventType[] {
	let items = z.array(z.unknown()).parse(body)

	let events = items.flatMap((raw) => {
		let event = PresenceEventSchema.safeParse(raw)
		return event.success ? [event.data] : []
	})
	if (items.length > 0 && events.length === 0) {
		throw new Error('None of the Presence events could be read')
	}

	return events
		.filter((event) => moment(event.endDateTimeUtc).isAfter(now))
		.map((event) => convertEvent(event, now))
		.sort((a, b) => a.startTime.localeCompare(b.startTime))
}
