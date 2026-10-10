import {DurableObject} from 'cloudflare:workers'
import {
	boardPostings,
	boardUrl,
	detailUrl,
	ORACLE_ORIGIN,
	oracleDetail,
	type BoardPosting,
} from '../../source/student-work/oracle-shape.ts'
import {unitNumberOfDescription} from '../../source/student-work/unit-number.ts'
import {clock} from './clock.ts'
import {
	listingOf,
	NONE,
	postingDetail,
	ftsQuery,
	searchText,
	type AreaUnits,
	type Filters,
	type Listing,
	type Posting,
	type PostingDescription,
	type PostingDetail,
} from './student-work-shape.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/// How often the board is read, plus up to JITTER more, so refreshes do not
/// land on the same minute every time.
export const REFRESH_EVERY = 4 * HOUR
export const JITTER = 30 * MINUTE
/// A posting's detail is read again after this, to catch edits.
export const DETAIL_TTL = DAY
/// A detail that named no unit is read again after this: usually a typo or a
/// blank an editor may yet correct.
const NO_UNIT_TTL = HOUR
/// Details read in one run; the rest wait for a follow-up run soon after, so
/// a first fill stays within one invocation's subrequest limit.
export const DETAILS_PER_RUN = 40
/// When a run leaves details unread, the next one comes this soon.
const FOLLOW_UP = 2 * MINUTE
/// Oracle sits behind its own bot protection; a few at a time is gentle.
const CONCURRENCY = 4
const MIN_BACKOFF = 5 * MINUTE
/// Stop reading Oracle for a board nobody has asked about in this long.
const IDLE_AFTER = 2 * DAY
const TOUCH_EVERY = 10 * MINUTE

/// What a read answers, or why there is nothing to answer with.
export type BoardResult<T> =
	({state: 'ok'; updatedAt: number} & T) | {state: 'error'; error: string}

type PostingRow = {
	id: string
	board: string
	detail: string | null
	unit: string | null
	detail_fetched_at: number | null
	first_seen: number
}

type StateRow = {
	board_fetched_at: number | null
	failures: number
	backoff_until: number
	last_error: string | null
	last_read: number
}

/// Oracle answered with something that says to slow down.
class Refused extends Error {}

async function getJson(url: string): Promise<unknown> {
	// built from oracle-shape's own addresses; checked anyway, and a redirect
	// is not followed
	let parsed = new URL(url)
	if (parsed.protocol !== 'https:' || parsed.origin !== ORACLE_ORIGIN) {
		throw new Error(`${parsed.origin} is not Oracle Recruiting`)
	}
	let response = await fetch(url, {redirect: 'manual'})
	let where = `${parsed.origin}${parsed.pathname}`
	if (response.status === 403 || response.status === 429) {
		throw new Refused(`Oracle Recruiting refused (${String(response.status)}) ${where}`)
	}
	if (!response.ok) {
		throw new Error(`Oracle Recruiting responded ${String(response.status)} for ${where}`)
	}
	return response.json()
}

/// St. Olaf's Student Work board, one row per posting in SQLite, kept fresh by
/// the object's own alarm: the board every few hours, and each posting's
/// detail when it is new, has no unit yet, or was read a day ago.
export class StudentWorkDO extends DurableObject<Env> {
	#inflight: Promise<void> | null = null

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS postings (
				id TEXT PRIMARY KEY,
				board TEXT NOT NULL,
				detail TEXT,
				unit TEXT,
				detail_fetched_at INTEGER,
				first_seen INTEGER NOT NULL,
				-- what the routes answer and filter on, kept with the row
				listing TEXT NOT NULL,
				posted_date TEXT NOT NULL,
				level TEXT,
				term TEXT
			);
			-- the words of each posting's title and description, for searching
			CREATE VIRTUAL TABLE IF NOT EXISTS postings_fts USING fts5 (
				id UNINDEXED, title, description, tokenize = 'unicode61 remove_diacritics 2'
			);
			CREATE TABLE IF NOT EXISTS state (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				board_fetched_at INTEGER,
				failures INTEGER NOT NULL DEFAULT 0,
				backoff_until INTEGER NOT NULL DEFAULT 0,
				last_error TEXT,
				last_read INTEGER NOT NULL
			);
			INSERT OR IGNORE INTO state (id, last_read) VALUES (1, 0);`)
		// a board recorded as read with no rows to show for it (an earlier
		// layout's table, since dropped) is read afresh on the next request
		ctx.storage.sql.exec('DROP TABLE IF EXISTS posting')
		ctx.storage.sql.exec(
			'UPDATE state SET board_fetched_at = NULL WHERE NOT EXISTS (SELECT 1 FROM postings)',
		)
	}

	#state(): StateRow {
		return this.ctx.storage.sql.exec<StateRow>('SELECT * FROM state WHERE id = 1').one()
	}

	/// Makes sure there is a board to answer from. With nothing stored yet, it
	/// is read first; a stored board past its refresh is answered at once and
	/// refreshed behind.
	async #ensure(): Promise<BoardResult<object>> {
		let now = clock.now()
		let state = this.#state()
		if (now - state.last_read > TOUCH_EVERY) {
			this.ctx.storage.sql.exec('UPDATE state SET last_read = ? WHERE id = 1', now)
		}

		if (state.board_fetched_at === null) {
			if (state.backoff_until <= now) {
				try {
					await this.#refresh()
				} catch {
					// recorded in the state row
				}
			}
			state = this.#state()
			if (state.board_fetched_at === null) {
				return {state: 'error', error: state.last_error ?? 'Oracle Recruiting unavailable'}
			}
		} else if ((await this.ctx.storage.getAlarm()) === null) {
			// a board that went quiet: refresh now if it is due, else on schedule
			await this.ctx.storage.setAlarm(Math.max(now, state.board_fetched_at + REFRESH_EVERY))
		}
		return {state: 'ok', updatedAt: state.board_fetched_at}
	}

	/// The postings that pass the filters, newest first, each with its areas.
	/// `areas` is each area's units; a posting is in the areas that list its
	/// unit, or in those listing "other" when none does or it names none.
	async list(filters: Filters, areas: AreaUnits): Promise<BoardResult<{postings: Posting[]}>> {
		let ready = await this.#ensure()
		if (ready.state === 'error') return ready

		let where: string[] = []
		let params: unknown[] = [JSON.stringify(areas)]
		let oneOf = (column: string, values: string[]) => {
			let named = values.filter((value) => value !== NONE)
			let parts = named.length > 0 ? [`${column} IN (SELECT value FROM json_each(?))`] : []
			if (named.length > 0) params.push(JSON.stringify(named))
			if (values.includes(NONE)) parts.push(`${column} IS NULL`)
			if (parts.length > 0) where.push(`(${parts.join(' OR ')})`)
		}

		if (filters.area.length > 0) {
			where.push(
				'EXISTS (SELECT 1 FROM area WHERE area.unit = p.grouped AND area.slug IN (SELECT value FROM json_each(?)))',
			)
			params.push(JSON.stringify(filters.area))
		}
		// a posting names no unit only once its detail says so
		oneOf('p.unit', filters.unit)
		if (filters.unit.includes(NONE))
			where.push('(p.unit IS NOT NULL OR p.detail_fetched_at IS NOT NULL)')
		oneOf('p.level', filters.level)
		oneOf('p.term', filters.term)
		if (filters.postedSince !== undefined) {
			where.push('p.posted_date >= ?')
			params.push(filters.postedSince)
		}
		let searches = [
			...(filters.q.length > 0 ? [ftsQuery(filters.q)] : []),
			...(filters.title.length > 0 ? [ftsQuery(filters.title, 'title')] : []),
		]
		for (let search of searches) {
			where.push('p.id IN (SELECT id FROM postings_fts WHERE postings_fts MATCH ?)')
			params.push(search)
		}

		let rankBy = filters.sort === 'relevance' ? searches[0] : undefined
		return {...ready, postings: this.#select(where, params, rankBy)}
	}

	/// The postings matching `where`, each with its areas: best match first
	/// for `rankBy`, a full-text query, otherwise newest first. The first of
	/// `params` is the areas, as JSON.
	#select(where: string[], params: unknown[], rankBy?: string): Posting[] {
		// a title match counts for more than one in the description
		let ranked = rankBy
			? `LEFT JOIN (SELECT id, bm25(postings_fts, 0, 5, 1) AS rank FROM postings_fts
					WHERE postings_fts MATCH ?) AS hit ON hit.id = p.id`
			: ''
		let order = rankBy ? 'hit.rank, ' : ''
		let [areas, ...rest] = params
		return this.ctx.storage.sql
			.exec<{listing: string; areas: string}>(
				`WITH area (idx, slug, unit) AS (
					SELECT key, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)
				),
				p AS (
					SELECT postings.*,
						CASE
							WHEN detail_fetched_at IS NULL THEN NULL
							WHEN unit IN (SELECT unit FROM area) THEN unit
							ELSE 'other'
						END AS grouped
					FROM postings
				)
				SELECT p.listing,
					(SELECT json_group_array(slug)
						FROM (SELECT slug FROM area WHERE area.unit = p.grouped ORDER BY idx)) AS areas
				FROM p ${ranked}
				${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
				ORDER BY ${order}p.posted_date DESC, CAST(p.id AS INTEGER) DESC`,
				areas,
				...(rankBy ? [rankBy] : []),
				...rest,
			)
			.toArray()
			.map(({listing, areas}) => ({
				...(JSON.parse(listing) as Listing),
				areas: JSON.parse(areas) as string[],
			}))
	}

	/// One posting with its description, or null when it is not on the board.
	async one(
		id: string,
		areas: AreaUnits,
	): Promise<BoardResult<{posting: Posting | null; description: PostingDescription | null}>> {
		let ready = await this.#ensure()
		if (ready.state === 'error') return ready
		let row = this.ctx.storage.sql
			.exec<{detail: string | null}>('SELECT detail FROM postings WHERE id = ?', id)
			.toArray()[0]
		if (!row) return {...ready, posting: null, description: null}

		let [posting] = this.#select(['p.id = ?'], [JSON.stringify(areas), id])
		let detail = row.detail === null ? null : (JSON.parse(row.detail) as PostingDetail)
		return {
			...ready,
			posting: posting ?? null,
			description: detail && {...detail.description, html: detail.descriptionHtml},
		}
	}

	/// Each read posting's unit by id; a posting whose detail is unread is left out.
	async units(): Promise<BoardResult<{units: Record<string, string | null>}>> {
		let ready = await this.#ensure()
		if (ready.state === 'error') return ready
		let units: Record<string, string | null> = {}
		for (let {id, unit} of this.ctx.storage.sql
			.exec<{id: string; unit: string | null}>(
				'SELECT id, unit FROM postings WHERE detail_fetched_at IS NOT NULL',
			)
			.toArray()) {
			units[id] = unit
		}
		return {...ready, units}
	}

	#refresh(): Promise<void> {
		return (this.#inflight ??= this.#run().finally(() => {
			this.#inflight = null
		}))
	}

	async #run(): Promise<void> {
		let now = clock.now()
		let unread = 0
		try {
			let board = boardPostings(await getJson(boardUrl()))
			let stored = this.ctx.storage.sql
				.exec<{n: number}>('SELECT count(*) AS n FROM postings')
				.one().n
			// an empty board in place of a full one is far likelier Oracle's
			// mistake than every posting coming down at once
			if (board.length === 0 && stored > 0) {
				throw new Error('Oracle Recruiting listed no postings')
			}
			this.#saveBoard(board, now)
			unread = await this.#readDetails(now)
			this.ctx.storage.sql.exec(
				'UPDATE state SET failures = 0, backoff_until = 0, last_error = NULL WHERE id = 1',
			)
		} catch (err) {
			let failures = this.#state().failures + 1
			this.ctx.storage.sql.exec(
				'UPDATE state SET failures = ?, backoff_until = ?, last_error = ? WHERE id = 1',
				failures,
				now + Math.min(MIN_BACKOFF * 2 ** (failures - 1), REFRESH_EVERY),
				err instanceof Error ? err.message : String(err),
			)
			throw err
		} finally {
			await this.#schedule(unread)
		}
	}

	/// Stores a posting with what the routes answer and filter on.
	#write(stored: Parameters<typeof listingOf>[0]) {
		let listing = listingOf(stored)
		this.ctx.storage.sql.exec(
			`INSERT INTO postings (id, board, detail, unit, detail_fetched_at, first_seen,
					listing, posted_date, level, term)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET board = excluded.board, detail = excluded.detail,
					unit = excluded.unit, detail_fetched_at = excluded.detail_fetched_at,
					listing = excluded.listing, posted_date = excluded.posted_date,
					level = excluded.level, term = excluded.term`,
			listing.id,
			JSON.stringify(stored.board),
			stored.detail && JSON.stringify(stored.detail),
			stored.unit,
			stored.detailFetchedAt,
			stored.firstSeenAt,
			JSON.stringify(listing),
			listing.postedDate,
			listing.level,
			listing.term,
		)
		let text = searchText(listing, stored.detail)
		this.ctx.storage.sql.exec('DELETE FROM postings_fts WHERE id = ?', listing.id)
		this.ctx.storage.sql.exec(
			'INSERT INTO postings_fts (id, title, description) VALUES (?, ?, ?)',
			listing.id,
			text.title,
			text.description,
		)
	}

	/// The board's postings replace the stored ones: new ones are added,
	/// changed ones updated, and ones no longer listed dropped.
	#saveBoard(board: BoardPosting[], now: number) {
		let sql = this.ctx.storage.sql
		for (let posting of board) {
			let row = sql.exec<PostingRow>('SELECT * FROM postings WHERE id = ?', posting.id).toArray()[0]
			this.#write({
				board: posting,
				detail: row?.detail ? (JSON.parse(row.detail) as PostingDetail) : null,
				unit: row?.unit ?? null,
				firstSeenAt: row?.first_seen ?? now,
				detailFetchedAt: row?.detail_fetched_at ?? null,
			})
		}
		let listed = JSON.stringify(board.map(({id}) => id))
		sql.exec('DELETE FROM postings WHERE id NOT IN (SELECT value FROM json_each(?))', listed)
		sql.exec('DELETE FROM postings_fts WHERE id NOT IN (SELECT value FROM json_each(?))', listed)
		sql.exec('UPDATE state SET board_fetched_at = ? WHERE id = 1', now)
	}

	/// Reads the details that are missing, unitless, or old, a batch at a
	/// time; returns how many are left for the next run.
	async #readDetails(now: number): Promise<number> {
		let due = this.ctx.storage.sql
			.exec<{id: string}>(
				`SELECT id FROM postings
					WHERE detail IS NULL OR detail_fetched_at < ? OR (unit IS NULL AND detail_fetched_at < ?)
					ORDER BY detail IS NOT NULL, detail_fetched_at`,
				now - DETAIL_TTL,
				now - NO_UNIT_TTL,
			)
			.toArray()
			.map(({id}) => id)
		let batch = due.slice(0, DETAILS_PER_RUN)

		let refused = false
		let next = 0
		let worker = async () => {
			while (!refused && next < batch.length) {
				let id = batch[next++]!
				try {
					let detail = oracleDetail(await getJson(detailUrl(id)))
					let row = this.ctx.storage.sql
						.exec<PostingRow>('SELECT * FROM postings WHERE id = ?', id)
						.toArray()[0]
					// dropped from the board while its detail was out
					if (!row) continue
					this.#write({
						board: JSON.parse(row.board) as BoardPosting,
						detail: postingDetail(detail),
						unit: unitNumberOfDescription(detail.descriptionHtml),
						firstSeenAt: row.first_seen,
						detailFetchedAt: now,
					})
				} catch (err) {
					// the posting keeps what it had, and is read again next run
					if (err instanceof Refused) refused = true
					console.warn('student-work: could not read a posting', id, String(err))
				}
			}
		}
		await Promise.all(Array.from({length: CONCURRENCY}, worker))
		if (refused) throw new Refused('Oracle Recruiting refused a posting detail')

		return due.length - batch.length
	}

	async #schedule(unread: number) {
		let state = this.#state()
		let now = clock.now()
		if (now - state.last_read > IDLE_AFTER) return this.ctx.storage.deleteAlarm()
		let next =
			state.backoff_until > now
				? state.backoff_until
				: unread > 0
					? now + FOLLOW_UP
					: now + REFRESH_EVERY + Math.random() * JITTER
		await this.ctx.storage.setAlarm(next)
	}

	override async alarm() {
		if (clock.now() - this.#state().last_read > IDLE_AFTER) return
		try {
			await this.#refresh()
		} catch {
			// recorded and rescheduled in #run
		}
	}

	async purge() {
		this.ctx.storage.sql.exec('DELETE FROM postings')
		this.ctx.storage.sql.exec('DELETE FROM postings_fts')
		this.ctx.storage.sql.exec(
			`UPDATE state SET board_fetched_at = NULL, failures = 0, backoff_until = 0,
				last_error = NULL, last_read = 0 WHERE id = 1`,
		)
		await this.ctx.storage.deleteAlarm()
	}
}
