import {EventSchema} from '../../calendar/types.ts'
import {FeedItemSchema} from '../../feeds/types.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {z} from 'zod'

/// Where St. Olaf's WordPress blocks this server's IP, the app fetches those
/// sources itself. Builds that predate that change still call these routes, so
/// rather than an error — or an empty screen they will read as the app being
/// broken — they get a single item explaining what happened.
///
/// These payloads are shaped for the renderers those older builds already
/// ship: the A–Z index draws `{label, url}` rows, and the event list draws an
/// event's title with `config.subtitle` beneath it. Nothing here requires a
/// client change, which is the point — the clients that see it cannot be
/// changed.

const DISCUSSION_URL = 'https://github.com/frog-pond/ccc-server/discussions/564'

export const UNAVAILABLE_TITLE = 'Temporarily unavailable'

/// For sources that are genuinely gone rather than relocated, so the two cases
/// stay distinguishable to whoever is reading the screen.
const RETIRED_TITLE = 'No longer updated'

const LinkGroupSchema = z.object({
	title: z.string(),
	data: z.array(z.object({label: z.string(), url: z.string().url()})),
})

export function deprecatedLinkGroups(text: string) {
	return LinkGroupSchema.array().parse([
		{title: UNAVAILABLE_TITLE, data: [{label: text, url: DISCUSSION_URL}]},
	])
}

export function atoz(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = deprecatedLinkGroups("The A–Z index can't be loaded right now. Tap for details.")
}

/// The student job listings moved to Oracle Recruiting, which this server's
/// scraper of the WordPress page cannot follow. Newer builds read Oracle
/// directly; the builds that see this one cannot.
///
/// Shaped for the job screens those builds already ship: the list groups rows
/// by `type` and labels them with `office`, so both have to carry something,
/// and the detail screen parses `lastModified` with moment's `MMMM D, YYYY`.
export function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = deprecatedJobs(
		"Student job listings can't be loaded in this version. Tap for details.",
	)
}

/// Fills the list's grouping heading and row subtitle, which have no message to
/// carry but cannot be blank.
const JOBS_HEADING = 'Student work'

export function deprecatedJobs(text: string, now = new Date()) {
	return [
		{
			comments: '',
			contactEmail: '',
			contactName: '',
			contactPhone: '',
			description: text,
			goodForIncomingStudents: false,
			hoursPerWeek: '',
			howToApply: '',
			id: 0,
			lastModified: now.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			}),
			links: [DISCUSSION_URL],
			office: JOBS_HEADING,
			openPositions: '',
			skills: '',
			timeline: '',
			timeOfHours: '',
			title: UNAVAILABLE_TITLE,
			type: JOBS_HEADING,
			url: DISCUSSION_URL,
			year: '',
		},
	]
}

/// The Google calendar behind this route was deleted upstream, and no app
/// screen ever read it. The route stays anyway: retired endpoints answer with a
/// notice here rather than a 404, the way the retired news sources do.
export function olevilleCalendar(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = deprecatedEvents(RETIRED_TITLE, 'The Oleville calendar is no longer published.')
}

/// Distinct from `deprecatedWpJson`, which tells the reader a source is dead.
/// These sources are alive and still published — they just load somewhere else
/// now — so the message and the link differ.
export function deprecatedFeedItems(text: string, now = new Date()) {
	return FeedItemSchema.array().parse([
		{
			authors: [],
			categories: [],
			content: '',
			datePublished: now.toISOString(),
			// `cleanEntries` on older clients drops stories with a blank
			// excerpt, so the message has to live here to survive.
			excerpt: text,
			featuredImage: null,
			link: DISCUSSION_URL,
			title: UNAVAILABLE_TITLE,
		},
	])
}

export function deprecatedEvents(title: string, text: string, now = new Date()) {
	return EventSchema.array().parse([
		{
			dataSource: 'deprecated',
			startTime: now.toISOString(),
			endTime: now.toISOString(),
			title,
			description: text,
			location: '',
			isOngoing: false,
			links: [DISCUSSION_URL],
			// The times are meaningless here, so they stay hidden; the message
			// goes in the subtitle slot, which the row renders under the title.
			config: {startTime: false, endTime: false, subtitle: 'description'},
		},
	])
}
