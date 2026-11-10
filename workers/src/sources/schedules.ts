import {publicationData} from '../../../source/schedules/publications.ts'
import {resolveScheduleResponses} from '../../../source/schedules/resolve.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {upstream} from '../upstream.ts'

const DAY = 24 * 60 * 60 * 1000

/// Only where the building hours are published: the urls come from this
/// worker's own route table.
const SCHEDULE_HOSTS = new Set(['stolaf.dev'])

export type ScheduleParams = {hoursUrl: string; breaksUrl: string}

export type ScheduleResponses = ReturnType<typeof resolveScheduleResponses>

/// Whether `url` is under the dev origin, compared as parsed URLs so that a
/// path like `/out/../secret` is judged by where it really leads.
function underDevOrigin(url: URL, origin: string | undefined): boolean {
	if (origin === undefined) return false
	let base = new URL(origin)
	return url.origin === base.origin && url.pathname.startsWith(base.pathname)
}

/// One published schedule file, unwrapped from its envelope. Only stolaf.dev,
/// or the dev origin when one is set, is read from.
async function published(url: string, origin?: string): Promise<unknown> {
	let parsed = new URL(url)
	if (
		!underDevOrigin(parsed, origin) &&
		(parsed.protocol !== 'https:' || !SCHEDULE_HOSTS.has(parsed.hostname))
	) {
		throw new Error(`${url} is not a schedule file this reads`)
	}
	// the host was checked above, and upstream never follows a redirect away from it
	let response = await upstream(parsed.href)
	if (!response.ok) {
		throw new Error(`The schedule file responded ${String(response.status)} for ${url}`)
	}
	return publicationData(await response.json())
}

/// Both files read and resolved together. `origin` is the dev origin the
/// urls were rebased onto, which is read from despite the host check.
export async function loadSchedules(
	{hoursUrl, breaksUrl}: ScheduleParams,
	origin?: string,
): Promise<ScheduleResponses> {
	let [hours, calendar] = await Promise.all([
		published(hoursUrl, origin),
		published(breaksUrl, origin),
	])
	return resolveScheduleResponses(calendar, hours)
}

/// The building hours with each building's break schedules expanded against
/// the break calendar, and the calendar itself, as the Node server's
/// `/spaces/hours` and `/breaks` answer them (`resolveScheduleResponses` in
/// `source/schedules/resolve.ts`). Both files are read together, so the hours
/// are only ever resolved against the calendar they were read with; either
/// failing, or not resolving, is an error and the last good pair is kept.
export const schedules = defineSource({
	name: 'schedules',
	key: ({hoursUrl, breaksUrl}: ScheduleParams) => `${hoursUrl} ${breaksUrl}`,
	load: (params) => loadSchedules(params),
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(schedules)
