import {CARLETON_CALENDARS, CONVOS, STOLAF_CALENDARS, type Calendar} from './calendars.ts'
import {deprecatedWpJson, retiredNnb} from '../../source/feeds/deprecated.ts'
import type {FeedItemType} from '../../source/feeds/types.ts'
import {CAFES, NAMED_CAFES} from './cafes.ts'
import {fetchSource} from './client.ts'
import {
	CARLETON_FILES,
	CARLETON_REDIRECTS,
	STOLAF_FILES,
	STOLAF_REDIRECTS,
	STOLAF_SCHEDULES,
	type PagesRoute,
} from './pages-routes.ts'
import type {ScheduleParams} from './sources/schedules.ts'
import type {AthleticsParams} from './sources/athletics.ts'
import {
	A_TO_Z_TEXT,
	deprecatedLinkGroups,
} from '../../source/ccci-stolaf-college/v1/deprecated-shape.ts'
import type {Jobs, Orgs} from './student-orgs.ts'
import type {StudentWork} from './student-work.ts'
import {KRLX_URL, rssNews} from './sources/rss-news.ts'
import {
	CARLETONIAN as CARLETONIAN_API,
	MESSENGER as MESSENGER_API,
	type WordPressSite,
} from './sources/wordpress-api.ts'
import {
	CARLETONIAN_URL,
	CARLETON_NOW_URL,
	MESSENGER_URL,
	STOLAF_NEWS_URL,
	wpNews,
} from './sources/wp-news.ts'

/// A news feed the apps read: its items.
export type NewsFeed = {
	read: (env: Env) => Promise<FeedItemType[]>
}

/// What one campus serves, under its own prefix. Each campus has its own
/// table, so one can change without the other.
export type Campus = {
	/// BonApp café ids (what the apps ask for) to their pages
	cafes: Record<string, string>
	/// café names, as in `/food/named/{menu,cafe}/<name>`, to their pages
	namedCafes: Record<string, string>
	/// feed names, as in `/news/<name>`
	news: Record<string, NewsFeed>
	/// news sites the app reads in WordPress's own shape, by name, as in
	/// `/news/<name>/wp/v2/<resource>[/<id>]`
	wordpressNews: Record<string, WordPressSite>
	/// calendar names, as in `/calendar/<name>`
	calendars: Record<string, Calendar>
	/// the convocations list, where the campus has one
	convos?: Calendar
	/// data files the college publishes, answered with a temporary redirect to
	/// where each is published, by path
	files: Record<string, PagesRoute>
	/// files answered with a temporary redirect to where they are published, by path
	redirects: Record<string, string>
	/// fixed answers that need nothing fetched, by path
	notices: Record<string, unknown>
	/// the building hours and break calendar, read together and resolved, where
	/// the campus has them (`/spaces/hours` and `/breaks`)
	schedules?: ScheduleParams
	/// whether `/images/:group/:name` redirects to the published app images
	images: boolean
	/// the athletics site `/athletics/scores` reads, where the campus has it
	athletics?: AthleticsParams
	/// directory lists passed through, by path
	directory: Record<string, string>
	/// whether `/streams/{upcoming,archived,search}` read St. Olaf's streams
	streams: boolean
	/// whether `/convos/upcoming/:id` and `/convos/archived` read the
	/// convocations calendar and podcast
	convoDetails: boolean
	/// the student jobs routes, where the campus has them, by where they are read
	studentWork?: ({board: 'oracle'} & StudentWork) | {board: 'wordpress'}
	/// what the student orgs routes answer, where the campus has them
	orgs?: Orgs
	/// what `/jobs` answers, where the campus has it
	jobs?: Jobs
}

const fromWordPress = (url: string): NewsFeed => ({
	read: async (env) => (await fetchSource(env, wpNews, {url})).value,
})

const fromRss = (url: string): NewsFeed => ({
	read: async (env) => (await fetchSource(env, rssNews, {url})).value,
})

/// A notice in place of a feed that is no longer published, as feed items.
/// It has no date, so it reads the same at any time, and a client re-checking
/// it is answered with a 304.
const notice = (items: FeedItemType[]): NewsFeed => ({read: () => Promise.resolve(items)})

const STOLAF_NEWS = fromWordPress(STOLAF_NEWS_URL)
const CARLETON_NOW = fromWordPress(CARLETON_NOW_URL)
const CARLETONIAN = fromWordPress(CARLETONIAN_URL)
const KRLX = fromRss(KRLX_URL)
const MESSENGER = fromWordPress(MESSENGER_URL)
const NO_LONGER_UPDATED = notice(deprecatedWpJson(null))
const NNB = notice(retiredNnb(null))

/// News feeds read the same wherever they are listed, by name.
const NEWS: Record<string, NewsFeed> = {
	stolaf: STOLAF_NEWS,
	'carleton-now': CARLETON_NOW,
	carletonian: CARLETONIAN,
	mess: MESSENGER,
	krlx: KRLX,
}

/// Papers read in WordPress's own shape, by name.
const WORDPRESS_NEWS: Record<string, WordPressSite> = {
	mess: MESSENGER_API,
	carletonian: CARLETONIAN_API,
}

const STOLAF: Campus = {
	cafes: CAFES,
	namedCafes: NAMED_CAFES,
	news: {
		...NEWS,
		oleville: NO_LONGER_UPDATED,
		politicole: NO_LONGER_UPDATED,
		ksto: NO_LONGER_UPDATED,
	},
	wordpressNews: WORDPRESS_NEWS,
	calendars: STOLAF_CALENDARS,
	files: STOLAF_FILES,
	redirects: STOLAF_REDIRECTS,
	notices: {'/a-to-z': deprecatedLinkGroups(A_TO_Z_TEXT)},
	schedules: STOLAF_SCHEDULES,
	images: true,
	athletics: {
		scoresUrl: 'https://athletics.stolaf.edu/services/scores_chris.aspx?format=json',
		teamName: 'Oles',
	},
	directory: {
		'/directory/departments': 'https://www.stolaf.edu/directory/departments?format=json',
		'/directory/majors': 'https://www.stolaf.edu/directory/majors?format=json',
	},
	streams: true,
	convoDetails: false,
	studentWork: {board: 'oracle', areasUrl: STOLAF_FILES['/student-work/areas']!.url},
	orgs: 'presence',
	jobs: 'retired',
}

const CARLETON: Campus = {
	cafes: CAFES,
	namedCafes: NAMED_CAFES,
	news: {...NEWS, covid: NO_LONGER_UPDATED, nnb: NNB},
	wordpressNews: WORDPRESS_NEWS,
	calendars: CARLETON_CALENDARS,
	convos: CONVOS,
	files: CARLETON_FILES,
	redirects: CARLETON_REDIRECTS,
	notices: {},
	images: true,
	athletics: {
		scoresUrl: 'https://athletics.carleton.edu/services/scores_chris.aspx?format=json',
		teamName: 'Knights',
	},
	directory: {},
	streams: false,
	convoDetails: true,
	studentWork: {board: 'wordpress'},
	orgs: 'unavailable',
	jobs: 'carleton',
}

/// The campuses, by the prefix they are mounted at.
export const CAMPUSES: ReadonlyMap<string, Campus> = new Map([
	['edu.stolaf', STOLAF],
	['edu.carleton', CARLETON],
])
