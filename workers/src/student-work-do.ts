import {DurableObject} from 'cloudflare:workers'
import {
	boardPostings,
	boardUrl,
	detailUrl,
	ORACLE_ORIGIN,
	oracleDetail,
	type BoardPosting,
	type OracleDetail,
} from '../../source/student-work/oracle-shape.ts'
import {readDescription, type Description} from '../../source/student-work/posting-shape.ts'
import {unitNumberOfDescription} from '../../source/student-work/unit-number.ts'
import {clock} from './clock.ts'

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

/// A posting's detail with its description read.
export type PostingDetail = OracleDetail & {description: Description}

export type StoredPosting = {
	board: BoardPosting
	/// null until its detail has been read
	detail: PostingDetail | null
	/// five digits, or null when the description names none or is unread
	unit: string | null
	detailFetchedAt: number | null
	firstSeenAt: number
}

export type BoardRead =
	{state: 'ok'; updatedAt: number; postings: StoredPosting[]} | {state: 'error'; error: string}

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
			CREATE TABLE IF NOT EXISTS posting (
				id TEXT PRIMARY KEY,
				board TEXT NOT NULL,
				detail TEXT,
				unit TEXT,
				detail_fetched_at INTEGER,
				first_seen INTEGER NOT NULL
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
	}

	#state(): StateRow {
		return this.ctx.storage.sql.exec<StateRow>('SELECT * FROM state WHERE id = 1').one()
	}

	#postings(): StoredPosting[] {
		return this.ctx.storage.sql
			.exec<PostingRow>('SELECT * FROM posting')
			.toArray()
			.map((row) => ({
				board: JSON.parse(row.board) as BoardPosting,
				detail: row.detail === null ? null : (JSON.parse(row.detail) as PostingDetail),
				unit: row.unit,
				detailFetchedAt: row.detail_fetched_at,
				firstSeenAt: row.first_seen,
			}))
	}

	/// The board as stored. With nothing stored yet, it is read first; a stored
	/// board past its refresh is answered at once and refreshed behind.
	async read(): Promise<BoardRead> {
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

		return {state: 'ok', updatedAt: state.board_fetched_at, postings: this.#postings()}
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
				.exec<{n: number}>('SELECT count(*) AS n FROM posting')
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

	/// The board's postings replace the stored ones: new ones are added,
	/// changed ones updated, and ones no longer listed dropped.
	#saveBoard(board: BoardPosting[], now: number) {
		let sql = this.ctx.storage.sql
		for (let posting of board) {
			sql.exec(
				`INSERT INTO posting (id, board, first_seen) VALUES (?, ?, ?)
					ON CONFLICT (id) DO UPDATE SET board = excluded.board`,
				posting.id,
				JSON.stringify(posting),
				now,
			)
		}
		sql.exec(
			'DELETE FROM posting WHERE id NOT IN (SELECT value FROM json_each(?))',
			JSON.stringify(board.map(({id}) => id)),
		)
		sql.exec('UPDATE state SET board_fetched_at = ? WHERE id = 1', now)
	}

	/// Reads the details that are missing, unitless, or old, a batch at a
	/// time; returns how many are left for the next run.
	async #readDetails(now: number): Promise<number> {
		let due = this.ctx.storage.sql
			.exec<{id: string}>(
				`SELECT id FROM posting
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
					this.ctx.storage.sql.exec(
						'UPDATE posting SET detail = ?, unit = ?, detail_fetched_at = ? WHERE id = ?',
						JSON.stringify({...detail, description: readDescription(detail.descriptionHtml)}),
						unitNumberOfDescription(detail.descriptionHtml),
						now,
						id,
					)
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
		this.ctx.storage.sql.exec('DELETE FROM posting')
		this.ctx.storage.sql.exec(
			`UPDATE state SET board_fetched_at = NULL, failures = 0, backoff_until = 0,
				last_error = NULL, last_read = 0 WHERE id = 1`,
		)
		await this.ctx.storage.deleteAlarm()
	}
}
