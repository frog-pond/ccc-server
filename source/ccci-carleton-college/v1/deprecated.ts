import {DISCUSSION_URL, RETIRED_TITLE, UNAVAILABLE_TITLE} from '../../ccc-lib/deprecated.ts'
import {FeedItemSchema} from '../../feeds/types.ts'
import {SortableCarletonStudentOrgSchema} from './orgs.ts'

/// apps.carleton.edu answers every path with a bot challenge, so the scrapers
/// reading it find no rows at all. Left alone, `/orgs` returns an empty list
/// and the app shows a screen saying Carleton has no student organisations —
/// a failure indistinguishable, from the outside, from a college that simply
/// has nothing to list. These payloads say what actually happened instead.
///
/// They are shaped for the renderers the shipped clients already have: an org
/// row draws its name and description, a feed item its title and excerpt.
/// Nothing here needs a client change.

const OUTAGE_TEXT =
	"Carleton is blocking this server, so the list can't be loaded. We know, and we're working on it."

export function unavailableOrgs() {
	return SortableCarletonStudentOrgSchema.array().parse([
		{
			id: 'deprecated',
			name: UNAVAILABLE_TITLE,
			description: OUTAGE_TEXT,
			contacts: [],
			categories: [],
			socialLinks: [],
			adminLink: DISCUSSION_URL,
			website: DISCUSSION_URL,
			$sortableName: UNAVAILABLE_TITLE,
			$groupableName: UNAVAILABLE_TITLE.slice(0, 1),
		},
	])
}

/// The Noon News Bulletin was published from apps.carleton.edu and is not
/// coming back, so this says so rather than promising a return.
export function retiredNnb() {
	return FeedItemSchema.array().parse([
		{
			authors: [],
			categories: [],
			datePublished: new Date().toISOString(),
			content: '',
			excerpt:
				'The Noon News Bulletin is no longer published. For campus announcements, see Carleton Now.',
			link: DISCUSSION_URL,
			title: RETIRED_TITLE,
			featuredImage: null,
		},
	])
}
