import {EventSchema} from './types.ts'

/// Shared by both institutions, the way `deprecatedWpJson` is: a calendar can
/// go quiet at either college, and the payload an old client can still render
/// is the same either way.

export const DISCUSSION_URL = 'https://github.com/frog-pond/ccc-server/discussions/564'

/// For sources that are genuinely gone rather than relocated, so the two cases
/// stay distinguishable to whoever is reading the screen.
export const RETIRED_TITLE = 'No longer updated'

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
