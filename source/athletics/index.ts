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

export const ScoreSchema = z.object({
	id: z.string(),
	sport: z.string(),
	sport_abbrev: z.string(),
	date: z.string(),
	dateFormatted: z.string(),
	date_utc: z.string(),
	date_end_utc: z.string(),
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
