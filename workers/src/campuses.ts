import type {FeedItemType} from '../../source/feeds/types.ts'
import {CAFES} from './cafes.ts'
import type {Source} from './define-source.ts'
import {CARLETONIAN_URL, rssNews} from './sources/rss-news.ts'
import {CARLETON_NOW_URL, STOLAF_NEWS_URL, wpNews} from './sources/wp-news.ts'

export type NewsFeed = {source: Source<{url: string}, FeedItemType[]>; url: string}

/// What one campus serves, under its own prefix. Each campus has its own
/// table, so one can change without the other.
export type Campus = {
	/// BonApp café ids (what the apps ask for) to their pages
	cafes: Record<string, string>
	/// feed names, as in `/news/<name>`
	news: Record<string, NewsFeed>
}

const STOLAF_NEWS: NewsFeed = {source: wpNews, url: STOLAF_NEWS_URL}
const CARLETON_NOW: NewsFeed = {source: wpNews, url: CARLETON_NOW_URL}
const CARLETONIAN: NewsFeed = {source: rssNews, url: CARLETONIAN_URL}

const STOLAF: Campus = {
	cafes: CAFES,
	news: {stolaf: STOLAF_NEWS, 'carleton-now': CARLETON_NOW, carletonian: CARLETONIAN},
}

const CARLETON: Campus = {
	cafes: CAFES,
	news: {stolaf: STOLAF_NEWS, 'carleton-now': CARLETON_NOW, carletonian: CARLETONIAN},
}

/// The campuses, by the prefix they are mounted at.
export const CAMPUSES: ReadonlyMap<string, Campus> = new Map([
	['edu.stolaf', STOLAF],
	['edu.carleton', CARLETON],
])
