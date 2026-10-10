import {DurableObject} from 'cloudflare:workers'
import {clock} from './clock.ts'
import type {Served, SourceResult} from './define-source.ts'
import {registry} from './registry.ts'

const MIN_BACKOFF = 30_000
const MAX_BACKOFF = 3_600_000
/// stop warming a source nobody has read in this long
const IDLE_AFTER = 2 * 86_400_000
/// how stale `last_read` may get before a read rewrites it
const TOUCH_EVERY = 10 * 60_000

type Row = {
	name: string
	params: string
	value: string | null
	fetched_at: number | null
	epoch: string | null
	failures: number
	backoff_until: number
	last_error: string | null
	last_read: number
}

/// One upstream resource: its last good value, kept in SQLite, and everything
/// about keeping it fresh. Concurrent readers share one fetch, a stale value is
/// answered at once and refreshed from the alarm, and a failing upstream is
/// backed off rather than hammered.
export class SourceDO extends DurableObject<Env> {
	#inflight: Promise<Row> | null = null

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS entry (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT NOT NULL,
				params TEXT NOT NULL,
				value TEXT,
				fetched_at INTEGER,
				epoch TEXT,
				failures INTEGER NOT NULL DEFAULT 0,
				backoff_until INTEGER NOT NULL DEFAULT 0,
				last_error TEXT,
				last_read INTEGER NOT NULL
			)`)
	}

	#row(): Row | undefined {
		return this.ctx.storage.sql.exec<Row>('SELECT * FROM entry WHERE id = 1').toArray()[0]
	}

	#served(row: Row, state: Served<unknown>['state']): Served<unknown> {
		return {value: JSON.parse(row.value!), fetchedAt: row.fetched_at!, state}
	}

	async get(name: string, params: unknown): Promise<SourceResult<unknown>> {
		let spec = registry[name]
		if (!spec) return {state: 'error', error: `unknown source: ${name}`}
		let now = clock.now()

		let row = this.#row()
		if (!row) {
			this.ctx.storage.sql.exec(
				'INSERT INTO entry (id, name, params, last_read) VALUES (1, ?, ?, ?)',
				name,
				JSON.stringify(params),
				now,
			)
			row = this.#row()!
		} else if (now - row.last_read > TOUCH_EVERY) {
			this.ctx.storage.sql.exec('UPDATE entry SET last_read = ? WHERE id = 1', now)
			row.last_read = now
		}

		let hasValue = row.fetched_at !== null
		let age = hasValue ? now - row.fetched_at! : Infinity
		let sameEpoch = !spec.epoch || row.epoch === spec.epoch(new Date(now))
		let backedOff = row.backoff_until > now

		if (hasValue && sameEpoch && age < spec.ttl) return this.#served(row, 'fresh')

		// stale-while-revalidate: answer now, refresh from the alarm, which survives eviction
		if (hasValue && sameEpoch && age < spec.ttl + spec.staleIfError) {
			if (!backedOff) await this.ctx.storage.setAlarm(now)
			return this.#served(row, 'stale')
		}

		// nothing usable: refresh before answering
		if (!backedOff) {
			try {
				return this.#served(await this.#refresh(), 'fresh')
			} catch {
				row = this.#row()!
			}
		}
		if (row.fetched_at !== null) return this.#served(row, 'stale-error')
		return {state: 'error', error: row.last_error ?? 'upstream unavailable'}
	}

	/// Single-flight: readers that arrive while a fetch is out share it. Awaiting
	/// `fetch` yields the object, so without this each of them would start its own.
	#refresh(): Promise<Row> {
		return (this.#inflight ??= this.#load().finally(() => {
			this.#inflight = null
		}))
	}

	async #load(): Promise<Row> {
		let row = this.#row()!
		let spec = registry[row.name]!
		let now = clock.now()
		try {
			let params = JSON.parse(row.params) as never
			let value = await spec.load(params, this.env)
			this.ctx.storage.sql.exec(
				`UPDATE entry SET value = ?, fetched_at = ?, epoch = ?,
					failures = 0, backoff_until = 0, last_error = NULL WHERE id = 1`,
				JSON.stringify(value),
				now,
				spec.epoch?.(new Date(now)) ?? null,
			)
			// the history is kept beside the answer; failing to keep it does not fail the answer
			if (spec.record) {
				this.ctx.waitUntil(
					spec.record(params, value, this.env, now).catch((err: unknown) => {
						console.warn(`${row.name}: could not record the history`, String(err))
					}),
				)
			}
			return this.#row()!
		} catch (err) {
			let failures = row.failures + 1
			this.ctx.storage.sql.exec(
				'UPDATE entry SET failures = ?, backoff_until = ?, last_error = ? WHERE id = 1',
				failures,
				now + Math.min(MIN_BACKOFF * 2 ** (failures - 1), MAX_BACKOFF),
				String(err),
			)
			throw err
		} finally {
			await this.#schedule()
		}
	}

	/// Next alarm: when the value goes stale, or when backoff ends. A source
	/// nobody reads stops being warmed.
	async #schedule() {
		let row = this.#row()!
		let spec = registry[row.name]!
		let now = clock.now()
		if (now - row.last_read > IDLE_AFTER) return this.ctx.storage.deleteAlarm()
		let next = row.backoff_until > now ? row.backoff_until : (row.fetched_at ?? now) + spec.ttl
		await this.ctx.storage.setAlarm(next)
	}

	override async alarm() {
		let row = this.#row()
		if (!row || clock.now() - row.last_read > IDLE_AFTER) return
		try {
			await this.#refresh()
		} catch {
			// recorded and rescheduled in #load; throwing here would only make the runtime retry
		}
	}

	/// Everything but the value: what a `/_cache` listing would show for this source.
	inspect() {
		let {value: _value, ...meta} = this.#row() ?? ({} as Partial<Row>)
		return meta
	}

	async purge() {
		this.ctx.storage.sql.exec('DELETE FROM entry')
		await this.ctx.storage.deleteAlarm()
	}
}
