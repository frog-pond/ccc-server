import {CARLETON_CALENDARS, CONVOS, STOLAF_CALENDARS, type Calendar} from './calendars.ts'
import {deprecatedWpJson, retiredNnb} from '../../source/feeds/deprecated.ts'
import type {FeedItemType} from '../../source/feeds/types.ts'
import {CAFES} from './cafes.ts'
import {fetchSource} from './client.ts'
import {CARLETON_FILES, STOLAF_FILES, type PagesRoute} from './pages-routes.ts'
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
	/// feed names, as in `/news/<name>`
	news: Record<string, NewsFeed>
	/// news sites the app reads in WordPress's own shape, by name, as in
	/// `/news/<name>/wp/v2/<resource>[/<id>]`
	wordpressNews: Record<string, WordPressSite>
	/// calendar names, as in `/calendar/<name>`
	calendars: Record<string, Calendar>
	/// the convocations list, where the campus has one
	convos?: Calendar
	/// data files the college publishes, passed through, by path
	files: Record<string, PagesRoute>
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
	news: {
		...NEWS,
		oleville: NO_LONGER_UPDATED,
		politicole: NO_LONGER_UPDATED,
		ksto: NO_LONGER_UPDATED,
	},
	wordpressNews: WORDPRESS_NEWS,
	calendars: STOLAF_CALENDARS,
	files: STOLAF_FILES,
	studentWork: {board: 'oracle', areasUrl: STOLAF_FILES['/student-work/areas']!.url},
	orgs: 'presence',
	jobs: 'retired',
}

const CARLETON: Campus = {
	cafes: CAFES,
	news: {...NEWS, covid: NO_LONGER_UPDATED, nnb: NNB},
	wordpressNews: WORDPRESS_NEWS,
	calendars: CARLETON_CALENDARS,
	convos: CONVOS,
	files: CARLETON_FILES,
	studentWork: {board: 'wordpress'},
	orgs: 'unavailable',
	jobs: 'carleton',
}

/// The campuses, by the prefix they are mounted at.
export const CAMPUSES: ReadonlyMap<string, Campus> = new Map([
	['edu.stolaf', STOLAF],
	['edu.carleton', CARLETON],
])
