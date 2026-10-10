import {DurableObject} from 'cloudflare:workers'
import {
	CARLETON_ORGS_URL,
	orgsFromHtml,
	type SortableCarletonStudentOrgType,
} from '../../source/ccci-carleton-college/v1/orgs-shape.ts'
import {searchWords} from '../../source/student-work/posting-shape.ts'
import {portalFields} from '../../source/student-orgs/portal.ts'
import {
	orgDetail,
	presenceCategories,
	presenceOrgs,
	presencePortalUrl,
	presenceUrls,
	withoutDemoCategory,
	withoutDemoOrgs,
} from '../../source/student-orgs/presence-shape.ts'
import type {
	DetailedStudentOrgType,
	OrgCategoryType,
	SortableStudentOrgType,
} from '../../source/student-orgs/types.ts'
import {BoardSchedule, type BoardResult} from './board-schedule.ts'
import {clock} from './clock.ts'
import {SOURCE_TTL} from './lifetimes.ts'
import {ftsQuery} from './student-work-shape.ts'
import {upstream} from './upstream.ts'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const TIMING = {
	every: SOURCE_TTL,
	jitter: 10 * MINUTE,
	followUp: SOURCE_TTL,
	minBackoff: 5 * MINUTE,
	// stop reading a list nobody has asked about in this long
	idleAfter: 2 * DAY,
	touchEvery: 10 * MINUTE,
}
/// An org's details are read again, behind an answer, once they are this old.
export const DETAIL_TTL = SOURCE_TTL
/// After a failed read of an org's details, they are not tried again for this long.
const DETAIL_BACKOFF = 5 * MINUTE

/// The school Presence files St. Olaf under.
const PRESENCE_SCHOOL = 'stolaf'
const PRESENCE_ORIGIN = 'https://api.presence.io'
const CARLETON_ORIGIN = new URL(CARLETON_ORGS_URL).origin

/// Which list an object holds: St. Olaf's orgs from Presence, or Carleton's
/// from its orgs page. An object holds the list it was first asked about.
export type OrgsKind = 'presence' | 'carleton'

const UNAVAILABLE: Record<OrgsKind, string> = {
	presence: 'Presence unavailable',
	carleton: "Carleton's student orgs unavailable",
}

/// What a list can be narrowed by.
export interface OrgFilters {
	/// words that must each start a word of the name or description
	q: string[]
	/// categories, any of which an org must be in
	category: string[]
}

/// A response from one of the addresses a list is read from. A redirect is
/// not followed, and only the source's own origin is fetched. Errors name the
/// address without its query.
async function read(url: string, origin: string, what: string): Promise<Response> {
	let parsed = new URL(url)
	if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
		throw new Error(`${parsed.origin} is not ${what}`)
	}
	let response = await upstream(url)
	if (!response.ok) {
		throw new Error(`${what} responded ${String(response.status)} for ${origin}${parsed.pathname}`)
	}
	return response
}

const presenceJson = async (url: string): Promise<unknown> =>
	(await read(url, PRESENCE_ORIGIN, 'Presence')).json()

/// A list of student orgs, one row per org in SQLite, kept fresh by the
/// object's own alarm. St. Olaf's also keeps each org's details, read from
/// Presence when someone first opens that org.
export class StudentOrgsDO extends DurableObject<Env> {
	#inflight: Promise<void> | null = null
	readonly #details = new Map<string, Promise<void>>()
	readonly #detailFailedAt = new Map<string, number>()
	readonly #schedule: BoardSchedule

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.#schedule = new BoardSchedule(ctx.storage, TIMING)
		ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS orgs (
				id TEXT PRIMARY KEY,
				-- where it comes in the list
				position INTEGER NOT NULL,
				-- what the list answers for it
				org TEXT NOT NULL
			);
			-- the words of each org's name and description, for searching
			CREATE VIRTUAL TABLE IF NOT EXISTS orgs_fts USING fts5 (
				id UNINDEXED, name, description, tokenize = 'unicode61 remove_diacritics 2'
			);
			CREATE TABLE IF NOT EXISTS categories (
				id TEXT PRIMARY KEY,
				position INTEGER NOT NULL,
				category TEXT NOT NULL
			);
			-- the fields of an org's portal view that are read, by org
			CREATE TABLE IF NOT EXISTS details (
				id TEXT PRIMARY KEY,
				fields TEXT NOT NULL,
				fetched_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS kind (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				kind TEXT NOT NULL
			);`)
	}

	/// The list this object holds, recorded on the first request.
	#kind(asked?: OrgsKind): OrgsKind | undefined {
		let sql = this.ctx.storage.sql
		if (asked) sql.exec('INSERT OR IGNORE INTO kind (id, kind) VALUES (1, ?)', asked)
		return sql.exec<{kind: OrgsKind}>('SELECT kind FROM kind WHERE id = 1').toArray()[0]?.kind
	}

	async #ensure(asked: OrgsKind): Promise<BoardResult<object>> {
		let kind = this.#kind(asked)
		if (kind !== asked) return {state: 'error', error: `this object holds the ${String(kind)} list`}
		return this.#schedule.ensure(() => this.#refresh(), UNAVAILABLE[kind])
	}

	/// The orgs that pass the filters, in list order.
	async list(kind: OrgsKind, filters: OrgFilters): Promise<BoardResult<{orgs: ListedOrg[]}>> {
		let ready = await this.#ensure(kind)
		if (ready.state === 'error') return ready

		let where: string[] = []
		let params: unknown[] = []
		if (filters.category.length > 0) {
			where.push(`EXISTS (SELECT 1 FROM json_each(o.org, '$.categories')
				WHERE value IN (SELECT value FROM json_each(?)))`)
			params.push(JSON.stringify(filters.category))
		}
		if (filters.q.length > 0) {
			where.push('o.id IN (SELECT id FROM orgs_fts WHERE orgs_fts MATCH ?)')
			params.push(ftsQuery(filters.q))
		}
		let orgs = this.ctx.storage.sql
			.exec<{org: string}>(
				`SELECT o.org FROM orgs AS o
					${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
					ORDER BY o.position`,
				...params,
			)
			.toArray()
			.map(({org}) => JSON.parse(org) as ListedOrg)
		return {...ready, orgs}
	}

	/// St. Olaf's categories, each with the uris of its orgs.
	async categories(): Promise<BoardResult<{categories: OrgCategoryType[]}>> {
		let ready = await this.#ensure('presence')
		if (ready.state === 'error') return ready
		let categories = this.ctx.storage.sql
			.exec<{category: string}>('SELECT category FROM categories ORDER BY position')
			.toArray()
			.map(({category}) => JSON.parse(category) as OrgCategoryType)
		return {...ready, categories}
	}

	/// One of St. Olaf's orgs with its details, or null when it is not listed.
	/// Details are read the first time an org is asked for; once they are old
	/// they are answered at once and read again behind.
	async org(uri: string): Promise<BoardResult<{org: DetailedStudentOrgType | null}>> {
		let ready = await this.#ensure('presence')
		if (ready.state === 'error') return ready
		let sql = this.ctx.storage.sql
		let row = sql.exec<{org: string}>('SELECT org FROM orgs WHERE id = ?', uri).toArray()[0]
		if (!row) return {...ready, org: null}

		let now = clock.now()
		let stored = this.#storedDetail(uri)
		let failedAt = this.#detailFailedAt.get(uri)
		let mayRead = failedAt === undefined || now - failedAt >= DETAIL_BACKOFF
		if (!stored) {
			if (mayRead) {
				try {
					await this.#readDetail(uri)
				} catch (err) {
					console.warn('student-orgs: could not read an org', uri, String(err))
				}
			}
			stored = this.#storedDetail(uri)
			if (!stored) return {state: 'error', error: 'Presence unavailable for this org'}
		} else if (now - stored.fetched_at > DETAIL_TTL && mayRead) {
			this.ctx.waitUntil(
				this.#readDetail(uri).catch((err: unknown) => {
					console.warn('student-orgs: could not refresh an org', uri, String(err))
				}),
			)
		}
		let org = JSON.parse(row.org) as SortableStudentOrgType
		let fields = JSON.parse(stored.fields) as ReturnType<typeof portalFields>
		return {...ready, org: orgDetail(org, fields)}
	}

	#storedDetail(uri: string) {
		return this.ctx.storage.sql
			.exec<{fields: string; fetched_at: number}>(
				'SELECT fields, fetched_at FROM details WHERE id = ?',
				uri,
			)
			.toArray()[0]
	}

	/// Reads one org's portal view and keeps only the fields that are read
	/// from it; the rest of the form is not for the public.
	#readDetail(uri: string): Promise<void> {
		let pending = this.#details.get(uri)
		if (pending) return pending
		let reading = (async () => {
			try {
				let fields = portalFields(await presenceJson(presencePortalUrl(PRESENCE_SCHOOL, uri)))
				// dropped from the list while its details were out
				let listed = this.ctx.storage.sql.exec('SELECT 1 FROM orgs WHERE id = ?', uri).toArray()
				if (listed.length === 0) return
				this.ctx.storage.sql.exec(
					`INSERT INTO details (id, fields, fetched_at) VALUES (?, ?, ?)
						ON CONFLICT (id) DO UPDATE SET fields = excluded.fields, fetched_at = excluded.fetched_at`,
					uri,
					JSON.stringify(fields),
					clock.now(),
				)
				this.#detailFailedAt.delete(uri)
			} catch (err) {
				this.#detailFailedAt.set(uri, clock.now())
				throw err
			} finally {
				this.#details.delete(uri)
			}
		})()
		this.#details.set(uri, reading)
		return reading
	}

	#refresh(): Promise<void> {
		return (this.#inflight ??= this.#schedule
			.run(async (now) => {
				if (this.#kind() === 'carleton') {
					this.#save(await readCarleton(), [])
				} else {
					let {orgs, categories} = await readPresence()
					this.#save(orgs, categories)
				}
				this.#schedule.stored(now)
				return 0
			})
			.finally(() => {
				this.#inflight = null
			}))
	}

	/// The list replaces the stored orgs and categories: new ones are added,
	/// changed ones updated, and ones no longer listed dropped, with their details.
	#save(orgs: ListedOrg[], categories: OrgCategoryType[]) {
		let sql = this.ctx.storage.sql
		let stored = sql.exec<{n: number}>('SELECT count(*) AS n FROM orgs').one().n
		// an empty list in place of a full one is far likelier the site's
		// mistake than every org closing at once
		if (orgs.length === 0 && stored > 0) throw new Error('the list of orgs came back empty')

		orgs.forEach((org, position) => {
			let id = idOf(org)
			sql.exec(
				`INSERT INTO orgs (id, position, org) VALUES (?, ?, ?)
					ON CONFLICT (id) DO UPDATE SET position = excluded.position, org = excluded.org`,
				id,
				position,
				JSON.stringify(org),
			)
			sql.exec('DELETE FROM orgs_fts WHERE id = ?', id)
			sql.exec(
				'INSERT INTO orgs_fts (id, name, description) VALUES (?, ?, ?)',
				id,
				searchWords(org.name).join(' '),
				searchWords(org.description).join(' '),
			)
		})
		let listed = JSON.stringify(orgs.map(idOf))
		for (let table of ['orgs', 'orgs_fts', 'details']) {
			sql.exec(`DELETE FROM ${table} WHERE id NOT IN (SELECT value FROM json_each(?))`, listed)
		}

		sql.exec('DELETE FROM categories')
		categories.forEach((category, position) => {
			sql.exec(
				'INSERT INTO categories (id, position, category) VALUES (?, ?, ?)',
				category.catIdh,
				position,
				JSON.stringify(category),
			)
		})
	}

	override async alarm() {
		if (this.#schedule.idle()) return
		try {
			await this.#refresh()
		} catch {
			// recorded and rescheduled by the schedule
		}
	}

	async purge() {
		for (let table of ['orgs', 'orgs_fts', 'categories', 'details', 'kind']) {
			this.ctx.storage.sql.exec(`DELETE FROM ${table}`)
		}
		this.#detailFailedAt.clear()
		await this.#schedule.purge()
	}
}

type ListedOrg = SortableStudentOrgType | SortableCarletonStudentOrgType

const idOf = (org: ListedOrg) => ('organizationUri' in org ? org.organizationUri : org.id)

/// St. Olaf's orgs and categories, as the Node server's routes answer them.
async function readPresence(): Promise<{orgs: ListedOrg[]; categories: OrgCategoryType[]}> {
	let urls = presenceUrls(PRESENCE_SCHOOL)
	let [list, campus, memberships] = await Promise.all([
		presenceJson(urls.organizations),
		presenceJson(urls.campus),
		presenceJson(urls.categories),
	])
	return {
		orgs: withoutDemoOrgs(presenceOrgs(list, campus)),
		categories: withoutDemoCategory(presenceCategories(memberships)),
	}
}

/// Carleton's orgs, from its orgs page. A page with no orgs on it is a page
/// standing in for the list (a bot check, say), not an empty list.
async function readCarleton(): Promise<ListedOrg[]> {
	let response = await read(CARLETON_ORGS_URL, CARLETON_ORIGIN, "Carleton's orgs page")
	let orgs = orgsFromHtml(await response.text())
	if (orgs.length === 0) throw new Error("Carleton's orgs page listed no orgs")
	return orgs
}
