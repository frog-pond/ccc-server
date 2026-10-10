import {z} from 'zod'
import {
	CARLETON_JOBS_ORIGIN,
	CARLETON_JOBS_PAGE_SIZE,
	CarletonJobPostSchema,
	carletonJobsUrl,
	carletonPosting,
	isArchived,
	type CarletonJobPost,
	type CarletonPosting,
	type CarletonPostingWithDescription,
} from '../../source/student-work/carleton-shape.ts'
import {jobFromPost} from '../../source/ccci-carleton-college/v1/jobs-shape.ts'
import {searchWords} from '../../source/student-work/posting-shape.ts'
import {ftsQuery} from './student-work-shape.ts'
import {upstream} from './upstream.ts'

/// Carleton's student jobs as rows in the StudentWorkDO named for Carleton: what
/// the object does for this board, apart from when it does it.

/// A job as listed, with when the object first saw it.
export type CarletonListing = CarletonPosting & {firstSeenAt: string}
export type CarletonJob = CarletonListing & Pick<CarletonPostingWithDescription, 'description'>

/// What a list can be narrowed by. Values of one key are alternatives; keys
/// narrow together.
export interface CarletonFilters {
	/// available during term, during break
	when: ('term' | 'break')[]
	/// community-based work-study (true) or on campus (false)
	offCampus: boolean | undefined
	postedSince: string | undefined
	/// words that must each start a word of the title or description
	q: string[]
	/// words that must each start a word of the title
	title: string[]
	sort: 'newest' | 'relevance'
}

export function createCarletonTables(sql: SqlStorage) {
	sql.exec(`
		CREATE TABLE IF NOT EXISTS carleton_jobs (
			id TEXT PRIMARY KEY,
			first_seen INTEGER NOT NULL,
			-- the job with its description, and what the routes filter on
			job TEXT NOT NULL,
			posted_at TEXT NOT NULL,
			during_term INTEGER NOT NULL,
			during_break INTEGER NOT NULL,
			off_campus INTEGER NOT NULL
		);
		CREATE VIRTUAL TABLE IF NOT EXISTS carleton_jobs_fts USING fts5 (
			id UNINDEXED, title, description, tokenize = 'unicode61 remove_diacritics 2'
		);`)
}

/// One page of jobs. A redirect is not followed, and only the site's own
/// origin is fetched; any failure backs the board off, as Oracle's do.
async function page(n: number): Promise<{posts: CarletonJobPost[]; pages: number}> {
	let url = carletonJobsUrl(n)
	let parsed = new URL(url)
	if (parsed.origin !== CARLETON_JOBS_ORIGIN) throw new Error(`${parsed.origin} is not Carleton`)
	let response = await upstream(url)
	let where = `${parsed.origin}${parsed.pathname}`
	if (!response.ok) {
		throw new Error(`Carleton Student Employment responded ${String(response.status)} for ${where}`)
	}
	let posts = z.array(CarletonJobPostSchema).parse(await response.json())
	let pages = Number(response.headers.get('x-wp-totalpages') ?? '1')
	return {posts, pages: Number.isInteger(pages) && pages > 0 ? pages : 1}
}

/// A board longer than this many pages is an error rather than a short board.
const MAX_PAGES = 10

/// Every job on the site, without the archived ones.
export async function readCarletonBoard(): Promise<CarletonPostingWithDescription[]> {
	let first = await page(1)
	if (first.pages > MAX_PAGES) {
		throw new Error(`Carleton Student Employment lists ${String(first.pages)} pages of jobs`)
	}
	let posts = [...first.posts]
	// pages are read in turn, to be gentle with the site
	for (let n = 2; n <= first.pages && first.posts.length === CARLETON_JOBS_PAGE_SIZE; n++) {
		// eslint-disable-next-line no-await-in-loop
		posts.push(...(await page(n)).posts)
	}
	let seen = new Set<number>()
	return posts
		.filter((post) => {
			if (seen.has(post.id)) return false
			seen.add(post.id)
			return !isArchived(post)
		})
		.map(carletonPosting)
}

/// The board replaces the stored jobs: new ones are added, changed ones
/// updated, and ones no longer listed dropped.
export function saveCarletonBoard(
	sql: SqlStorage,
	board: CarletonPostingWithDescription[],
	now: number,
) {
	let stored = sql.exec<{n: number}>('SELECT count(*) AS n FROM carleton_jobs').one().n
	// an empty board in place of a full one is far likelier the site's mistake
	// than every job coming down at once
	if (board.length === 0 && stored > 0)
		throw new Error('Carleton Student Employment listed no jobs')

	for (let posting of board) {
		let firstSeen =
			sql
				.exec<{first_seen: number}>('SELECT first_seen FROM carleton_jobs WHERE id = ?', posting.id)
				.toArray()[0]?.first_seen ?? now
		let job: CarletonJob = {...posting, firstSeenAt: new Date(firstSeen).toISOString()}
		sql.exec(
			`INSERT INTO carleton_jobs
					(id, first_seen, job, posted_at, during_term, during_break, off_campus)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET job = excluded.job, posted_at = excluded.posted_at,
					during_term = excluded.during_term, during_break = excluded.during_break,
					off_campus = excluded.off_campus`,
			posting.id,
			firstSeen,
			JSON.stringify(job),
			posting.postedAt,
			Number(posting.duringTerm),
			Number(posting.duringBreak),
			Number(posting.offCampus),
		)
		let description = [
			...posting.description.fields.map((field) => field.value),
			posting.description.markdown,
		].join(' ')
		sql.exec('DELETE FROM carleton_jobs_fts WHERE id = ?', posting.id)
		sql.exec(
			'INSERT INTO carleton_jobs_fts (id, title, description) VALUES (?, ?, ?)',
			posting.id,
			searchWords(posting.title).join(' '),
			searchWords(description).join(' '),
		)
	}
	let listed = JSON.stringify(board.map(({id}) => id))
	sql.exec('DELETE FROM carleton_jobs WHERE id NOT IN (SELECT value FROM json_each(?))', listed)
	sql.exec('DELETE FROM carleton_jobs_fts WHERE id NOT IN (SELECT value FROM json_each(?))', listed)
}

const listingOf = (job: CarletonJob): CarletonListing => {
	let {description: _, ...listing} = job
	return listing
}

/// The jobs that pass the filters: newest first, or for `sort=relevance` the
/// best match first, a title match counting for more.
export function listCarleton(sql: SqlStorage, filters: CarletonFilters): CarletonListing[] {
	let where: string[] = []
	let params: unknown[] = []
	if (filters.when.length > 0) {
		where.push(
			`(${filters.when.map((when) => (when === 'term' ? 'j.during_term = 1' : 'j.during_break = 1')).join(' OR ')})`,
		)
	}
	if (filters.offCampus !== undefined) {
		where.push('j.off_campus = ?')
		params.push(Number(filters.offCampus))
	}
	if (filters.postedSince !== undefined) {
		where.push('substr(j.posted_at, 1, 10) >= ?')
		params.push(filters.postedSince)
	}
	let searches = [
		...(filters.q.length > 0 ? [ftsQuery(filters.q)] : []),
		...(filters.title.length > 0 ? [ftsQuery(filters.title, 'title')] : []),
	]
	for (let search of searches) {
		where.push('j.id IN (SELECT id FROM carleton_jobs_fts WHERE carleton_jobs_fts MATCH ?)')
		params.push(search)
	}

	let rankBy = filters.sort === 'relevance' ? searches[0] : undefined
	let ranked = rankBy
		? `LEFT JOIN (SELECT id, bm25(carleton_jobs_fts, 0, 5, 1) AS rank FROM carleton_jobs_fts
				WHERE carleton_jobs_fts MATCH ?) AS hit ON hit.id = j.id`
		: ''
	return sql
		.exec<{job: string}>(
			`SELECT j.job FROM carleton_jobs AS j ${ranked}
				${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
				ORDER BY ${rankBy ? 'hit.rank, ' : ''}j.posted_at DESC, CAST(j.id AS INTEGER) DESC`,
			...(rankBy ? [rankBy] : []),
			...params,
		)
		.toArray()
		.map(({job}) => listingOf(JSON.parse(job) as CarletonJob))
}

/// One job with its description, or null when it is not on the board.
export function oneCarleton(sql: SqlStorage, id: string): CarletonJob | null {
	let row = sql.exec<{job: string}>('SELECT job FROM carleton_jobs WHERE id = ?', id).toArray()[0]
	return row ? (JSON.parse(row.job) as CarletonJob) : null
}

/// Every job, newest first, in the shape the Node server's `/jobs` answers.
export function carletonJobsAsListed(sql: SqlStorage): ReturnType<typeof jobFromPost>[] {
	return sql
		.exec<{job: string}>(
			'SELECT job FROM carleton_jobs ORDER BY posted_at DESC, CAST(id AS INTEGER) DESC',
		)
		.toArray()
		.map(({job}) => {
			let {id, postedAt, url, title, description, categories} = JSON.parse(job) as CarletonJob
			return jobFromPost({id, postedAt, link: url, title, html: description.html, categories})
		})
}

export function purgeCarleton(sql: SqlStorage) {
	sql.exec('DELETE FROM carleton_jobs')
	sql.exec('DELETE FROM carleton_jobs_fts')
}
