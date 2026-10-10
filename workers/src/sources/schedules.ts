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

async function published(url: string): Promise<unknown> {
	let parsed = new URL(url)
	if (parsed.protocol !== 'https:' || !SCHEDULE_HOSTS.has(parsed.hostname)) {
		throw new Error(`${url} is not a schedule file this reads`)
	}
	// the host was checked above, so a redirect to another is not followed
	let response = await upstream(url)
	if (!response.ok) {
		throw new Error(`The schedule file responded ${String(response.status)} for ${url}`)
	}
	return publicationData(await response.json())
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
	async load({hoursUrl, breaksUrl}): Promise<ScheduleResponses> {
		let [hours, calendar] = await Promise.all([published(hoursUrl), published(breaksUrl)])
		return resolveScheduleResponses(calendar, hours)
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(schedules)
