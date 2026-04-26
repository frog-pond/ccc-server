import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'

// ── Zod schemas ──────────────────────────────────────────────────────────────

const LocationInfoSchema = z.object({
	location: z.string(),
	HAN: z.enum(['H', 'A', 'N']),
	facility: z.string(),
})

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

export type Score = z.infer<typeof ScoreSchema>

const AthleticsResponseSchema = z.object({
	timestamp: z.unknown(),
	status: z.unknown(),
	scores: z.array(ScoreSchema),
})

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchAthleticsScores(url: string): Promise<Score[]> {
	const response = AthleticsResponseSchema.parse(await getJson(url))
	return response.scores
}
