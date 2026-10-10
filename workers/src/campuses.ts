import {CARLETON_CALENDARS, CONVOS, STOLAF_CALENDARS, type Calendar} from './calendars.ts'
import type {FeedItemType} from '../../source/feeds/types.ts'
import {CAFES} from './cafes.ts'
import type {Source} from './define-source.ts'
import {CARLETON_FILES, STOLAF_FILES, type PagesRoute} from './pages-routes.ts'
import type {StudentWork} from './student-work.ts'
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
	/// calendar names, as in `/calendar/<name>`
	calendars: Record<string, Calendar>
	/// the convocations list, where the campus has one
	convos?: Calendar
	/// data files the college publishes, passed through, by path
	files: Record<string, PagesRoute>
	/// the student jobs routes, where the campus has them, by where they are read
	studentWork?: ({board: 'oracle'} & StudentWork) | {board: 'wordpress'}
}

const STOLAF_NEWS: NewsFeed = {source: wpNews, url: STOLAF_NEWS_URL}
const CARLETON_NOW: NewsFeed = {source: wpNews, url: CARLETON_NOW_URL}
const CARLETONIAN: NewsFeed = {source: rssNews, url: CARLETONIAN_URL}

const STOLAF: Campus = {
	cafes: CAFES,
	news: {stolaf: STOLAF_NEWS, 'carleton-now': CARLETON_NOW, carletonian: CARLETONIAN},
	calendars: STOLAF_CALENDARS,
	files: STOLAF_FILES,
	studentWork: {board: 'oracle', areasUrl: STOLAF_FILES['/student-work/areas']!.url},
}

const CARLETON: Campus = {
	cafes: CAFES,
	news: {stolaf: STOLAF_NEWS, 'carleton-now': CARLETON_NOW, carletonian: CARLETONIAN},
	calendars: CARLETON_CALENDARS,
	convos: CONVOS,
	files: CARLETON_FILES,
	studentWork: {board: 'wordpress'},
}

/// The campuses, by the prefix they are mounted at.
export const CAMPUSES: ReadonlyMap<string, Campus> = new Map([
	['edu.stolaf', STOLAF],
	['edu.carleton', CARLETON],
])
