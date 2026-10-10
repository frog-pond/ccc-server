import {clock} from './clock.ts'

/// When a Durable Object that keeps a list of its own reads that list again:
/// on a schedule with jitter, sooner after a run that left work over, later
/// after a failure, and not at all once nobody has asked in a while. The
/// object answers from what it stored in between.

/// What a read answers, or why there is nothing to answer with.
export type BoardResult<T> =
	({state: 'ok'; updatedAt: number} & T) | {state: 'error'; error: string}

export interface Timing {
	/// how often the list is read, plus up to `jitter` more, so refreshes do not
	/// land on the same minute every time
	every: number
	jitter: number
	/// when a run leaves work over, the next one comes this soon
	followUp: number
	/// the first wait after a failure; it doubles with each one, up to `every`
	minBackoff: number
	/// stop reading for an object nobody has asked about in this long
	idleAfter: number
	/// how often a read is recorded, so a busy object is not written on every request
	touchEvery: number
}

type StateRow = {
	board_fetched_at: number | null
	failures: number
	backoff_until: number
	last_error: string | null
	last_read: number
}

/// The object's schedule, kept in its `state` table.
export class BoardSchedule {
	readonly #storage: DurableObjectStorage
	readonly #timing: Timing

	constructor(storage: DurableObjectStorage, timing: Timing) {
		this.#storage = storage
		this.#timing = timing
		storage.sql.exec(`
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

	state(): StateRow {
		return this.#storage.sql.exec<StateRow>('SELECT * FROM state WHERE id = 1').one()
	}

	/// Makes sure there is a list to answer from. With nothing stored yet, it
	/// is read first, unless the last try is still backing off; a stored list
	/// past its refresh is answered at once and refreshed behind.
	async ensure(refresh: () => Promise<void>, unavailable: string): Promise<BoardResult<object>> {
		let now = clock.now()
		let state = this.state()
		if (now - state.last_read > this.#timing.touchEvery) {
			this.#storage.sql.exec('UPDATE state SET last_read = ? WHERE id = 1', now)
		}

		if (state.board_fetched_at === null) {
			if (state.backoff_until <= now) {
				try {
					await refresh()
				} catch {
					// recorded in the state row
				}
			}
			state = this.state()
			if (state.board_fetched_at === null) {
				return {state: 'error', error: state.last_error ?? unavailable}
			}
		} else if ((await this.#storage.getAlarm()) === null) {
			// a list that went quiet: refresh now if it is due, else on schedule
			await this.#storage.setAlarm(Math.max(now, state.board_fetched_at + this.#timing.every))
		}
		return {state: 'ok', updatedAt: state.board_fetched_at}
	}

	/// Runs one read of the list. `read` stores what it read and says how much
	/// work it left for a follow-up run. A failure is recorded and backs the
	/// object off, and is thrown on.
	async run(read: (now: number) => Promise<number>): Promise<void> {
		let now = clock.now()
		let unread = 0
		try {
			unread = await read(now)
			this.#storage.sql.exec(
				'UPDATE state SET failures = 0, backoff_until = 0, last_error = NULL WHERE id = 1',
			)
		} catch (err) {
			let failures = this.state().failures + 1
			this.#storage.sql.exec(
				'UPDATE state SET failures = ?, backoff_until = ?, last_error = ? WHERE id = 1',
				failures,
				now + Math.min(this.#timing.minBackoff * 2 ** (failures - 1), this.#timing.every),
				err instanceof Error ? err.message : String(err),
			)
			throw err
		} finally {
			await this.#schedule(unread)
		}
	}

	/// Records that the list was read whole at `now`.
	stored(now: number) {
		this.#storage.sql.exec('UPDATE state SET board_fetched_at = ? WHERE id = 1', now)
	}

	async #schedule(unread: number) {
		let state = this.state()
		let now = clock.now()
		if (this.idle()) return this.#storage.deleteAlarm()
		let next =
			state.backoff_until > now
				? state.backoff_until
				: unread > 0
					? now + this.#timing.followUp
					: now + this.#timing.every + Math.random() * this.#timing.jitter
		await this.#storage.setAlarm(next)
	}

	/// Whether nobody has asked in so long that the list is no longer read.
	idle(): boolean {
		return clock.now() - this.state().last_read > this.#timing.idleAfter
	}

	async purge() {
		this.#storage.sql.exec(
			`UPDATE state SET board_fetched_at = NULL, failures = 0, backoff_until = 0,
				last_error = NULL, last_read = 0 WHERE id = 1`,
		)
		await this.#storage.deleteAlarm()
	}
}
