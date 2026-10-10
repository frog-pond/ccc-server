import moment from 'moment-timezone'
import {
	CafeMenuIsClosed as closedMenu,
	CafeMenuWithError as menuWithError,
	CustomCafe as customCafe,
} from './shape.ts'

/**
 * The zone both colleges keep time in. BonApp's cafe pages show the day it is
 * on campus, so the day a response is dated has to be read on the same clock.
 */
const CAMPUS_TIMEZONE = 'America/Chicago'

/**
 * Today's date on campus, e.g. `2026-09-22`.
 *
 * Not the UTC date: from 7 PM (6 PM in winter) until midnight, UTC is already
 * on the next day, and a response dated by it claims tomorrow for the dayparts
 * BonApp is showing for today.
 */
export function campusToday(now: Date = new Date()): string {
	return moment(now).tz(CAMPUS_TIMEZONE).format('YYYY-MM-DD')
}

export const CustomCafe = (message: string) => customCafe(message, campusToday())

export const CafeMenuIsClosed = () => closedMenu(campusToday())

export const CafeMenuWithError = (error: unknown, label: string) =>
	menuWithError(error, label, campusToday())
