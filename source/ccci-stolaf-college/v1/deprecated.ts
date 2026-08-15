import {EventSchema} from '../../calendar/types.ts'
import {FeedItemSchema} from '../../feeds/types.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {z} from 'zod'

/// Where St. Olaf's WordPress blocks this server's IP, the app fetches those
/// sources itself. Builds that predate that change still call these routes, so
/// rather than an error — or an empty screen they will read as the app being
/// broken — they get a single item telling them to update.
///
/// These payloads are shaped for the renderers those older builds already
/// ship: the A–Z index draws `{label, url}` rows, and the event list draws an
/// event's title with `config.subtitle` beneath it. Nothing here requires a
/// client change, which is the point — the clients that see it cannot be
/// changed.

const APP_STORE_URL = 'https://apps.apple.com/app/id938588319'

const UPDATE_PROMPT = 'Update All About Olaf'

const LinkGroupSchema = z.object({
	title: z.string(),
	data: z.array(z.object({label: z.string(), url: z.string().url()})),
})

export function deprecatedLinkGroups(text: string) {
	return LinkGroupSchema.array().parse([
		{title: UPDATE_PROMPT, data: [{label: text, url: APP_STORE_URL}]},
	])
}

export function atoz(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = deprecatedLinkGroups('The A–Z index moved into the app. Update to search it again.')
}

/// Distinct from `deprecatedWpJson`, which tells the reader a source is dead.
/// These sources are alive; it is the client that needs updating, so the
/// message and the link differ.
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
			link: APP_STORE_URL,
			title: UPDATE_PROMPT,
		},
	])
}

export function deprecatedEvents(text: string, now = new Date()) {
	return EventSchema.array().parse([
		{
			dataSource: 'deprecated',
			startTime: now.toISOString(),
			endTime: now.toISOString(),
			title: UPDATE_PROMPT,
			description: text,
			location: '',
			isOngoing: false,
			links: [APP_STORE_URL],
			// The times are meaningless here, so they stay hidden; the message
			// goes in the subtitle slot, which the row renders under the title.
			config: {startTime: false, endTime: false, subtitle: 'description'},
		},
	])
}
