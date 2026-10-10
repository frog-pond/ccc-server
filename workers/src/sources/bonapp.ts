import {extractBamco} from '../../../source/menus-bonapp/extract-bamco.ts'
import {
	BamcoPageContentsSchema,
	type BamcoPageContents,
} from '../../../source/menus-bonapp/types-bonapp.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/// The zone both colleges keep time in; the same one `campusToday` in
/// source/menus-bonapp/helpers.ts uses, without its moment-timezone import.
const CAMPUS_TIMEZONE = 'America/Chicago'

const campusDate = new Intl.DateTimeFormat('en-CA', {
	timeZone: CAMPUS_TIMEZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
})

/// Today's date on campus, e.g. `2026-09-22`.
export const campusToday = (now: Date): string => campusDate.format(now)

/// Only BonApp's own café pages: the url comes from the caller, and this must
/// not become a way to make the worker fetch anything.
const BONAPP_HOST = /^[a-z]+\.cafebonappetit\.com$/

/// A café page's data, or `null` for a closed café. Throws if BonApp's page
/// has Bamco data that can't be read, so a reshaped page is an error and the
/// last good menu keeps being served, rather than a menu that looks closed.
export function parseBonappPage(html: string): BamcoPageContents | null {
	return BamcoPageContentsSchema.parse(extractBamco(html)) ?? null
}

export type BonappPageParams = {url: string}

/// One BonApp café page: what `getBamco` in source/menus-bonapp/index.ts
/// fetches and parses, but once per hour for every reader.
export const bonappPage = defineSource({
	name: 'bonapp-page',
	key: ({url}: BonappPageParams) => url,
	async load({url}) {
		let parsed = new URL(url)
		if (parsed.protocol !== 'https:' || !BONAPP_HOST.test(parsed.hostname)) {
			throw new Error(`${url} is not a BonApp café page`)
		}
		let response = await fetch(url)
		if (!response.ok) {
			throw new Error(`BonApp responded ${String(response.status)} for ${url}`)
		}
		return parseBonappPage(await response.text())
	},
	ttl: HOUR,
	staleIfError: DAY,
	// yesterday's menu is never fresh today, but is still better than nothing
	epoch: campusToday,
})
registerSource(bonappPage)
