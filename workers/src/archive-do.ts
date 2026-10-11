import {DurableObject} from 'cloudflare:workers'
import {archives, type Archive, type Row, type Span} from './archive.ts'
import {clock} from './clock.ts'
import {notingRetryAfter} from './conditional.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/// Steps back through the history each run, and how soon the next run comes
/// while there is more. Small, so one run stays a few upstream requests.
const STEPS_PER_RUN = 2
const FOLLOW_UP = MINUTE
/// After a failed step, wait this long, doubling, up to an hour.
const MIN_BACKOFF = MINUTE

type State = {
	name: string | null
	params: string | null
	cursor: string | null
	done: number
	failures: number
	backoff_until: number
	last_error: string | null
}

/// One feed's history, one row per item, kept forever except for future
/// items a live read stops listing. Its alarm walks the feed's history back
/// to the start, a few steps a run, and then rests.
export class ArchiveDO extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		ctx.storage.sql.exec(`
			DROP TABLE IF EXISTS items;
			CREATE TABLE IF NOT EXISTS state (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT,
				params TEXT,
				-- where the walk back through the history goes on from
				cursor TEXT,
				done INTEGER NOT NULL DEFAULT 0,
				failures INTEGER NOT NULL DEFAULT 0,
				backoff_until INTEGER NOT NULL DEFAULT 0,
				last_error TEXT
			);
			INSERT OR IGNORE INTO state (id) VALUES (1);`)
	}

	/// The table for this feed's items, with a column for each of the archive's
	/// fields. Its shape is the archive's, so it is made once the feed is known.
	#table(archive: Archive<never, unknown>) {
		let columns = Object.entries(archive.columns)
			.map(([name, type]) => `${name} ${type}`)
			.join(',\n\t\t\t\t')
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS entries (
				id TEXT PRIMARY KEY,
				-- when it happens or was published, in milliseconds
				at INTEGER NOT NULL,
				${columns}
			);
			CREATE INDEX IF NOT EXISTS entries_at ON entries (at, id);`)
	}

	/// Stores an item. `replace` is for a live read's copy, which is fresher
	/// than one already stored; a step back through the history leaves the
	/// stored one as it is.
	#put(archive: Archive<never, unknown>, item: unknown, replace: boolean) {
		let row = archive.toRow(item as never)
		let names = ['id', 'at', ...Object.keys(archive.columns)]
		let values = [
			archive.id(item as never),
			archive.at(item as never),
			...Object.keys(archive.columns).map((name) => row[name] ?? null),
		]
		let conflict = replace
			? `ON CONFLICT (id) DO UPDATE SET ${names
					.slice(1)
					.map((name) => `${name} = excluded.${name}`)
					.join(', ')}`
			: 'ON CONFLICT (id) DO NOTHING'
		this.ctx.storage.sql.exec(
			`INSERT INTO entries (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')}) ${conflict}`,
			...values,
		)
	}

	#state(): State {
		return this.ctx.storage.sql.exec<State>('SELECT * FROM state WHERE id = 1').one()
	}

	/// The next run of the walk back, unless it is switched off.
	async #wake(at: number) {
		if (this.env.ARCHIVE_BACKFILL !== 'off') await this.ctx.storage.setAlarm(at)
	}

	/// Remembers which feed this is, and starts walking its history the first time.
	async #begin(name: string, params: unknown) {
		let state = this.#state()
		if (state.name !== null) return
		this.ctx.storage.sql.exec(
			'UPDATE state SET name = ?, params = ? WHERE id = 1',
			name,
			JSON.stringify(params),
		)
		// a minute on, so the walk back does not add to the live read's requests
		await this.#wake(clock.now() + FOLLOW_UP)
	}

	/// Keeps what a live read found, replacing stored copies, and drops the
	/// future items within `span` it no longer lists.
	async record(name: string, params: unknown, items: unknown[], span: Span | null) {
		let archive = archives[name]
		if (!archive) throw new Error(`unknown archive: ${name}`)
		await this.#begin(name, params)
		this.#table(archive)
		let sql = this.ctx.storage.sql
		for (let item of items) this.#put(archive, item, true)
		if (span) {
			let from = Math.max(span.from, clock.now())
			let listed = JSON.stringify(items.map((item) => archive.id(item as never)))
			sql.exec(
				`DELETE FROM entries WHERE at > ? AND at <= ?
					AND id NOT IN (SELECT value FROM json_each(?))`,
				from,
				Number.isFinite(span.to) ? span.to : Number.MAX_SAFE_INTEGER,
				listed,
			)
		}
	}

	/// Up to `limit` items from before `before`, latest first.
	async before(
		name: string,
		params: unknown,
		before: number,
		limit: number,
	): Promise<{state: 'ok'; items: unknown[]} | {state: 'error'; error: string}> {
		let archive = archives[name]
		if (!archive) return {state: 'error', error: `unknown archive: ${name}`}
		await this.#begin(name, params)
		this.#table(archive)
		let items = this.ctx.storage.sql
			.exec<Row>(
				'SELECT * FROM entries WHERE at < ? ORDER BY at DESC, id DESC LIMIT ?',
				before,
				limit,
			)
			.toArray()
			.map((row) => archive.fromRow(row))
		return {state: 'ok', items}
	}

	/// A few steps back through the history. An item already stored is left as
	/// it is: the live read's copy is the fresher one.
	override async alarm() {
		let state = this.#state()
		let archive = state.name ? archives[state.name] : undefined
		if (!archive || state.done) return
		let now = clock.now()
		if (state.backoff_until > now) {
			await this.#wake(state.backoff_until)
			return
		}
		this.#table(archive)
		let sql = this.ctx.storage.sql
		let cursor = state.cursor
		let retryAfter = 0
		try {
			for (let step = 0; step < STEPS_PER_RUN && !this.#state().done; step++) {
				let noted = await notingRetryAfter(() =>
					archive.backfill(JSON.parse(state.params ?? 'null') as never, this.env, cursor),
				)
				retryAfter = noted.retryAfter
				if (noted.result.status === 'rejected') throw noted.result.reason
				let found = noted.result.value
				for (let item of found.items) this.#put(archive, item, false)
				cursor = found.next
				sql.exec(
					'UPDATE state SET cursor = ?, done = ?, failures = 0, backoff_until = 0, last_error = NULL WHERE id = 1',
					cursor,
					cursor === null ? 1 : 0,
				)
			}
			if (!this.#state().done) await this.#wake(clock.now() + FOLLOW_UP)
		} catch (err) {
			let failures = this.#state().failures + 1
			// at least as long as the site asked, when it said
			let wait = Math.max(Math.min(MIN_BACKOFF * 2 ** (failures - 1), HOUR), retryAfter)
			sql.exec(
				'UPDATE state SET failures = ?, backoff_until = ?, last_error = ? WHERE id = 1',
				failures,
				now + wait,
				err instanceof Error ? err.message : String(err),
			)
			await this.#wake(now + wait)
		}
	}

	/// How far the walk back has got, for a look at the archive.
	async status() {
		let state = this.#state()
		let {cursor, done, failures, last_error} = state
		let archive = state.name ? archives[state.name] : undefined
		if (archive) this.#table(archive)
		let n = archive
			? this.ctx.storage.sql.exec<{n: number}>('SELECT count(*) AS n FROM entries').one().n
			: 0
		return {items: n, cursor, done: done === 1, failures, lastError: last_error}
	}

	async purge() {
		this.ctx.storage.sql.exec('DROP TABLE IF EXISTS entries')
		this.ctx.storage.sql.exec(
			`UPDATE state SET name = NULL, params = NULL, cursor = NULL, done = 0, failures = 0,
				backoff_until = 0, last_error = NULL WHERE id = 1`,
		)
		await this.ctx.storage.deleteAlarm()
	}
}
