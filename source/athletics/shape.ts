import {z} from 'zod'
import {ONE_DAY, ONE_MINUTE} from '../ccc-lib/constants.ts'

// ── Zod schemas ──────────────────────────────────────────────────────────────

/** The feed calls home/away `HAN`; the output calls it `homeAway`. */
const LocationInfoSchema = z
	.object({
		location: z.string(),
		HAN: z.enum(['H', 'A', 'N']).optional(),
		facility: z.string(),
	})
	.transform(({HAN, ...location}) => (HAN === undefined ? location : {...location, homeAway: HAN}))

/**
 * The feed's own status. Its indicator plays no part in a game's state (see
 * `gameState`) beyond `C`, a cancelled game, so any letter is accepted: one
 * the schema did not know would otherwise fail the whole response.
 */
const StatusInfoSchema = z.object({
	indicator: z.string(),
	value: z.string(),
})

const LinkSchema = z.object({
	url: z.string(),
	text: z.string(),
})

const LinksSchema = z
	.object({
		postgame: LinkSchema.optional(),
		boxscore: LinkSchema.optional(),
		livestats: LinkSchema.optional(),
		streaming_video: LinkSchema.optional(),
	})
	.catchall(z.unknown())

/**
 * Parses the upstream API's non-standard "M/D/YYYY h:mm:ss AM/PM" UTC format
 * and returns an ISO 8601 string so consumers can use new Date() safely.
 */
function parseDateUtcField(dateStr: string): string {
	const parts = dateStr.split(' ')
	if (parts.length !== 3) {
		return dateStr
	}
	const [datePart, timePart, ampm] = parts as [string, string, string]
	const [month, day, year] = datePart.split('/').map(Number) as [number, number, number]
	const [hours, minutes, seconds] = timePart.split(':').map(Number) as [number, number, number]
	let hour24 = hours % 12
	if (ampm === 'PM') {
		hour24 += 12
	}
	return new Date(Date.UTC(year, month - 1, day, hour24, minutes, seconds)).toISOString()
}

export const ScoreSchema = z.object({
	id: z.string(),
	sport: z.string(),
	sport_abbrev: z.string(),
	date: z.string(),
	dateFormatted: z.string(),
	date_utc: z.string().transform(parseDateUtcField),
	date_end_utc: z.string().transform(parseDateUtcField),
	time: z.string(),
	timestamp: z.number(),
	location: LocationInfoSchema,
	status: StatusInfoSchema,
	hometeam: z.string(),
	hometeam_logo: z.string(),
	opponent: z.string(),
	opponent_logo: z.string(),
	team_score: z.string(),
	opponent_score: z.string(),
	result: z.enum(['W', 'L', 'T', 'N', '']),
	ip_time: z.string(),
	prescore_info: z.string(),
	postscore_info: z.string(),
	links: LinksSchema,
	coverage: z.record(z.string(), z.unknown()),
})

/** A game record as the scores feed sends it, after parsing. */
export type FeedScore = z.infer<typeof ScoreSchema>

/** Where a game stands, decided from the scores feed, livestats and the clock. */
export type GameState = 'scheduled' | 'started' | 'live' | 'unofficial-final' | 'final'

/** A game as this server returns it. */
export type Score = Omit<FeedScore, 'status'> & {status: {indicator: GameState; value: string}}

const AthleticsResponseSchema = z.object({
	timestamp: z.unknown().optional(),
	status: z.unknown().optional(),
	scores: z.array(ScoreSchema),
})

// ── Livestats schemas ────────────────────────────────────────────────────────

const LivestatsTeamSchema = z.object({
	Id: z.string(),
	Name: z.string(),
	Score: z.number(),
})

const LivestatsGameSchema = z.object({
	GameId: z.number(),
	Path: z.string(),
	FullPath: z.string(),
	Link: z.string(),
	SportTitle: z.string(),
	Opponent: z.string(),
	Location: z.string(),
	Time: z.string(),
	HasStarted: z.boolean(),
	IsComplete: z.boolean(),
	ClockSeconds: z.number(),
	ShowExtraPeriodsAsOT: z.boolean(),
	PeriodsRegulation: z.number(),
	Period: z.number(),
	PeriodName: z.string(),
	HomeTeam: LivestatsTeamSchema,
	VisitingTeam: LivestatsTeamSchema,
})

const LivestatsResponseSchema = z.object({
	Games: z.array(LivestatsGameSchema),
})

export type LiveGame = z.infer<typeof LivestatsGameSchema>

// ── Calendar schemas ─────────────────────────────────────────────────────────

const CalendarLinkSchema = z.object({url: z.string().nullable()}).nullable()

/**
 * One fixture on the athletics site's calendar. Unlike the scores feed, its
 * `date` is the school's local time with no offset, and its result is always
 * from the school's side: `team_score` is the school's, home or away.
 */
const CalendarEventSchema = z.object({
	id: z.number(),
	date: z.string(),
	time: z.string().nullable(),
	location: z.string().nullable(),
	location_indicator: z.enum(['H', 'A', 'N']).nullable(),
	noplay_text: z.string().nullable(),
	sport: z.object({title: z.string(), abbreviation: z.string().nullable()}),
	opponent: z.object({
		title: z.string(),
		image: z.object({path: z.string(), filename: z.string()}).nullable(),
	}),
	facility: z.object({title: z.string()}).nullable(),
	result: z
		.object({
			status: z.string().nullable(),
			team_score: z.string().nullable(),
			opponent_score: z.string().nullable(),
			prescore_info: z.string().nullable(),
			postscore_info: z.string().nullable(),
			boxscore: CalendarLinkSchema,
			recap: CalendarLinkSchema,
		})
		.nullable(),
})

type CalendarEvent = z.infer<typeof CalendarEventSchema>

/** The calendar lists a week from the requested day, one entry per day. */
const CalendarResponseSchema = z.array(
	z.object({date: z.string(), events: z.array(z.unknown()).nullable()}),
)

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Derives the livestats URL from a scores URL by replacing the path.
 * e.g. https://athletics.stolaf.edu/services/scores_chris.aspx?format=json
 *   -> https://athletics.stolaf.edu/services/livestats.ashx
 */
export function livestatsUrlFromScoresUrl(scoresUrl: string): string {
	const url = new URL(scoresUrl)
	url.pathname = '/services/livestats.ashx'
	url.search = ''
	return url.toString()
}

/** The calendar the athletics site's own schedule page reads, beside the scores feed. */
function calendarUrlFromScoresUrl(scoresUrl: string): string {
	const url = new URL(scoresUrl)
	url.pathname = '/services/responsive-calendar.ashx'
	url.search = ''
	return url.toString()
}

/**
 * A timed game's kickoff. All-day events carry a bare date, which
 * `parseDateUtcField` leaves as it came, so they have no kickoff; nor does a
 * date that does not parse.
 */
export function kickoffTime(score: {date_utc: string}): Date | undefined {
	if (!score.date_utc.includes('T')) {
		return undefined
	}
	const kickoff = new Date(score.date_utc)
	return Number.isNaN(kickoff.getTime()) ? undefined : kickoff
}

/**
 * Decides where a game stands. The first rule that matches wins: a posted
 * result, then livestats, then the clock. The scores feed's own 'A'/'O' play
 * no part — across two recorded game days its 'O' arrived only together with
 * a result.
 */
export function gameState(score: FeedScore, liveGame: LiveGame | undefined, now: Date): Score {
	const withState = (indicator: GameState): Score => ({
		...score,
		status: {indicator, value: score.status.value},
	})

	if (score.result !== '') {
		return withState('final')
	}

	if (liveGame && (liveGame.IsComplete || liveGame.HasStarted)) {
		// Both feeds list the home side first, whichever side St. Olaf is on.
		return {
			...withState(liveGame.IsComplete ? 'unofficial-final' : 'live'),
			team_score: String(liveGame.HomeTeam.Score),
			opponent_score: String(liveGame.VisitingTeam.Score),
		}
	}

	const kickoff = kickoffTime(score)
	const hasKickedOff = kickoff !== undefined && kickoff.getTime() <= now.getTime()
	return {...withState(hasKickedOff ? 'started' : 'scheduled'), team_score: '', opponent_score: ''}
}

const FIVE_MINUTES = 5 * ONE_MINUTE

/** States in which a game can change from one minute to the next. */
const IN_PLAY: ReadonlySet<GameState> = new Set(['started', 'live', 'unofficial-final'])

/**
 * Whether the scores should be re-read every minute rather than every five:
 * a game is under way or waiting for its official result, or one kicks off
 * within five minutes.
 *
 * A game counts as in play for at most a day after kickoff. A result can go
 * unposted for good -- Carleton's feed still had a 2026-09-27 tennis match with
 * none a week later -- and that one game would otherwise hold every request to
 * the one-minute rate indefinitely.
 */
export function needsFrequentRefresh(scores: Score[], now: Date): boolean {
	return scores.some((score) => {
		const kickoff = kickoffTime(score)
		if (IN_PLAY.has(score.status.indicator)) {
			return kickoff === undefined || now.getTime() - kickoff.getTime() < ONE_DAY
		}
		if (kickoff === undefined) {
			return false
		}
		const untilKickoff = kickoff.getTime() - now.getTime()
		return untilKickoff > 0 && untilKickoff < FIVE_MINUTES
	})
}

/**
 * Indexes the livestats games by id. Live data only adds to what the scores
 * feed says, so a body that does not parse counts as no live games.
 */
function liveGamesById(livestatsJson: unknown): Map<string, LiveGame> {
	const parsed = LivestatsResponseSchema.safeParse(livestatsJson)
	if (!parsed.success) {
		return new Map()
	}
	return new Map(parsed.data.Games.map((game) => [String(game.GameId), game]))
}

/**
 * Turns the two feeds' bodies into the scores this server returns, as of
 * `now`. A cancelled game is left out: with no result ever coming, it would
 * otherwise read as started from kickoff on.
 */
export function scoresFromFeeds(scoresJson: unknown, livestatsJson: unknown, now: Date): Score[] {
	const liveGames = liveGamesById(livestatsJson)
	return AthleticsResponseSchema.parse(scoresJson)
		.scores.filter((score) => score.status.indicator !== 'C')
		.map((score) => gameState(score, liveGames.get(score.id), now))
}

// ── Yesterday, from the calendar ─────────────────────────────────────────────

/** Both schools on this server keep Central time; the calendar's dates are in it. */
const SCHOOL_TIME_ZONE = 'America/Chicago'

interface CalendarDay {
	year: number
	month: number
	day: number
}

/** The school's calendar day `days` days after the one `now` falls on. */
function schoolDay(now: Date, days: number): CalendarDay {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SCHOOL_TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(now)
	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
	const shifted = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + days))
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	}
}

/** A day as the feeds write one, `M/D/YYYY` -- or `M.D` with `.` and no year. */
function formatDay({year, month, day}: CalendarDay, separator: '/' | '.'): string {
	const monthDay = `${String(month)}${separator}${String(day)}`
	return separator === '/' ? `${monthDay}/${String(year)}` : monthDay
}

/** The school's local wall-clock time as an instant. */
function schoolTimeToInstant(day: CalendarDay, hours: number, minutes: number): Date {
	const asUtc = Date.UTC(day.year, day.month - 1, day.day, hours, minutes)
	const offset = new Intl.DateTimeFormat('en-US', {
		timeZone: SCHOOL_TIME_ZONE,
		timeZoneName: 'longOffset',
	})
		.formatToParts(asUtc)
		.find((p) => p.type === 'timeZoneName')?.value
	const [, sign = '+', offsetHours = '0', offsetMinutes = '0'] =
		/^GMT(?:([+-])(\d{2}):(\d{2}))?$/u.exec(offset ?? '') ?? []
	const offsetMs = (Number(offsetHours) * 60 + Number(offsetMinutes)) * 60_000
	return new Date(sign === '-' ? asUtc + offsetMs : asUtc - offsetMs)
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u

const RESULTS: ReadonlySet<string> = new Set(['W', 'L', 'T', 'N'])

/** Who is listed first in a game the scores feed would send. */
export interface School {
	/** The site the feeds are served from, for the calendar's relative links. */
	origin: string
	/** What the scores feed calls the school's own team, e.g. "Oles". */
	teamName: string
}

/**
 * Turns a finished calendar fixture into a game as the scores feed would send
 * it, or undefined when there is nothing to show: no result, or a meet with no
 * team score to report.
 *
 * The scores feed lists the home side first -- for an away game, `hometeam` is
 * the opponent and `team_score` is theirs -- so an away fixture's sides are
 * swapped from the calendar's school-first order. A neutral-site game keeps
 * the school first. An all-day fixture gets the feed's bare `M/D/YYYY` date
 * and no time, as the feed sends one.
 */
export function scoreFromCalendarEvent(event: CalendarEvent, school: School): Score | undefined {
	const result = event.result
	const resultLetter = result?.status ?? ''
	if (!result || event.noplay_text || !RESULTS.has(resultLetter)) {
		return undefined
	}
	if (result.prescore_info?.toLowerCase() === 'no team scores') {
		return undefined
	}

	const match = CALENDAR_DATE.exec(event.date)
	if (!match) {
		return undefined
	}
	const [, year, month, day, hours, minutes] = match.map(Number) as [
		number,
		number,
		number,
		number,
		number,
		number,
	]
	const calendarDay = {year, month, day}
	const kickoff = schoolTimeToInstant(calendarDay, hours, minutes)
	// The calendar marks an all-day fixture by a midnight start.
	const isAllDay = hours === 0 && minutes === 0

	const link = (url: string | null | undefined, text: string) =>
		url ? {url: new URL(url, school.origin).toString(), text} : undefined
	const boxscore = link(result.boxscore?.url, 'Box')
	const postgame = link(result.recap?.url, 'Recap')

	const schoolSide = {
		team: school.teamName,
		logo: new URL('/images/logos/site/site.png', school.origin).toString(),
		score: result.team_score ?? '',
	}
	const opponentImage = event.opponent.image
	const opponentSide = {
		team: event.opponent.title,
		logo: opponentImage
			? new URL(`${opponentImage.path}/${opponentImage.filename}`, school.origin).toString()
			: '',
		score: result.opponent_score ?? '',
	}
	const isAway = event.location_indicator === 'A'
	const [home, visitor] = isAway ? [opponentSide, schoolSide] : [schoolSide, opponentSide]

	return {
		id: String(event.id),
		sport: event.sport.title,
		sport_abbrev: event.sport.abbreviation ?? '',
		date: formatDay(calendarDay, '.'),
		dateFormatted: formatDay(calendarDay, '.'),
		date_utc: isAllDay ? formatDay(calendarDay, '/') : kickoff.toISOString(),
		date_end_utc: '',
		time: isAllDay ? '' : (event.time ?? ''),
		timestamp: Math.floor(kickoff.getTime() / 1000),
		location: {
			location: event.location ?? '',
			facility: event.facility?.title ?? '',
			...(event.location_indicator ? {homeAway: event.location_indicator} : {}),
		},
		status: {indicator: 'final', value: ''},
		hometeam: home.team,
		hometeam_logo: home.logo,
		opponent: visitor.team,
		opponent_logo: visitor.logo,
		team_score: home.score,
		opponent_score: visitor.score,
		result: resultLetter as Score['result'],
		ip_time: '',
		prescore_info: result.prescore_info ?? '',
		postscore_info: result.postscore_info ?? '',
		links: {...(boxscore ? {boxscore} : {}), ...(postgame ? {postgame} : {})},
		coverage: {},
	}
}

/** The calendar query that lists the school's yesterday, as of `now`. */
export function yesterdayCalendarUrl(scoresUrl: string, now: Date): string {
	const url = new URL(calendarUrlFromScoresUrl(scoresUrl))
	url.search = new URLSearchParams({
		type: 'events',
		sport: '0',
		date: formatDay(schoolDay(now, -1), '/'),
	}).toString()
	return url.toString()
}

/**
 * The finished games the calendar lists for the school's yesterday, as of
 * `now`. The scores feed drops a day's games once it is over, so this is the
 * only place they are still found. The calendar only adds to the scores feed,
 * so a body that does not parse counts as no games, and so does a fixture
 * that does not.
 */
export function yesterdaysGames(calendarJson: unknown, now: Date, school: School): Score[] {
	const parsed = CalendarResponseSchema.safeParse(calendarJson)
	if (!parsed.success) {
		return []
	}
	const {year, month, day} = schoolDay(now, -1)
	const key = `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	const events = parsed.data.find((entry) => entry.date.startsWith(key))?.events ?? []
	return events.flatMap((raw) => {
		const event = CalendarEventSchema.safeParse(raw)
		const score = event.success ? scoreFromCalendarEvent(event.data, school) : undefined
		return score ? [score] : []
	})
}

/** Yesterday's games added to the feed's, where the feed does not have them already. */
export function withYesterday(scores: Score[], yesterday: Score[]): Score[] {
	const known = new Set(scores.map((score) => score.id))
	return [...yesterday.filter((score) => !known.has(score.id)), ...scores]
}
