import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'

// ── Zod schemas ──────────────────────────────────────────────────────────────

/** The feed calls home/away `HAN`; the output calls it `homeAway`. */
const LocationInfoSchema = z
	.object({
		location: z.string(),
		HAN: z.enum(['H', 'A', 'N']).optional(),
		facility: z.string(),
	})
	.transform(({HAN, ...location}) => (HAN === undefined ? location : {...location, homeAway: HAN}))

const StatusInfoSchema = z.object({
	indicator: z.enum(['O', 'A']),
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
	result: z.enum(['W', 'L', 'N', '']),
	ip_time: z.string(),
	prescore_info: z.string(),
	postscore_info: z.string(),
	links: LinksSchema,
	coverage: z.record(z.unknown()),
})

/** A game record as the scores feed sends it, after parsing. */
export type FeedScore = z.infer<typeof ScoreSchema>

/** Where a game stands, decided from the scores feed, livestats and the clock. */
export type GameState = 'scheduled' | 'started' | 'live' | 'unofficial-final' | 'final'

/** A game as this server returns it. */
export type Score = Omit<FeedScore, 'status'> & {status: {indicator: GameState; value: string}}

const AthleticsResponseSchema = z.object({
	timestamp: z.unknown(),
	status: z.unknown(),
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

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Derives the livestats URL from a scores URL by replacing the path.
 * e.g. https://athletics.stolaf.edu/services/scores_chris.aspx?format=json
 *   -> https://athletics.stolaf.edu/services/livestats.ashx
 */
function livestatsUrlFromScoresUrl(scoresUrl: string): string {
	const url = new URL(scoresUrl)
	url.pathname = '/services/livestats.ashx'
	url.search = ''
	return url.toString()
}

/**
 * A timed game's kickoff. All-day events carry a bare date, which
 * `parseDateUtcField` leaves as it came, so they have no kickoff; nor does a
 * date that does not parse.
 */
function kickoffTime(score: {date_utc: string}): Date | undefined {
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

/** Turns the two feeds' bodies into the scores this server returns, as of `now`. */
export function scoresFromFeeds(scoresJson: unknown, livestatsJson: unknown, now: Date): Score[] {
	const liveGames = liveGamesById(livestatsJson)
	return AthleticsResponseSchema.parse(scoresJson).scores.map((score) =>
		gameState(score, liveGames.get(score.id), now),
	)
}

export async function fetchAthleticsScores(url: string): Promise<Score[]> {
	const [scoresJson, livestatsJson] = await Promise.all([
		getJson(url),
		// A failed livestats request counts as no live games.
		getJson(livestatsUrlFromScoresUrl(url)).catch(() => null),
	])
	return scoresFromFeeds(scoresJson, livestatsJson, new Date())
}
