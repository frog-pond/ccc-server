import {groupUnits, listedUnitsOf} from '../../source/student-work/areas.ts'
import {fetchSource} from './client.ts'
import {defineSource} from './define-source.ts'
import {registerSource} from './registry.ts'
import {pagesJson} from './sources/pages-json.ts'
import {parseFilters, type AreaUnits, type PostingWithDescription} from './student-work-shape.ts'

const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

const failed = (message: string) => json({message}, 502, ONE_MINUTE)

export interface StudentWork {
	/// the published areas file, which says which units each area holds
	areasUrl: string
}

interface Area {
	slug: string
	units: string[]
}

/// The published areas file, read as pages-json reads it, and kept only when
/// it is the shape the app publishes, so a file that is not one leaves the
/// last good copy in place.
export const studentWorkAreas = defineSource({
	name: 'student-work-areas',
	key: ({url}: {url: string}) => url,
	async load(params, env) {
		let body = await pagesJson.load(params, env)
		let data = (body as {data?: unknown} | null)?.data
		let listed = listedUnitsOf(body)
		if (!Array.isArray(data) || !listed) {
			throw new Error('the Student Work areas file is not a list of areas')
		}
		let areas = data.flatMap((entry: unknown) => {
			let {slug, units} = (entry ?? {}) as {slug?: unknown; units?: unknown}
			return typeof slug === 'string' && Array.isArray(units)
				? [{slug, units: units.filter((unit): unit is string => typeof unit === 'string')}]
				: []
		})
		return {areas, listed: [...listed]}
	},
	ttl: pagesJson.ttl,
	staleIfError: pagesJson.staleIfError,
})
registerSource(studentWorkAreas)

/// The areas, or undefined when the file cannot be read.
async function readAreas(
	env: Env,
	url: string,
): Promise<{areas: Area[]; listed: string[]} | undefined> {
	try {
		return (await fetchSource(env, studentWorkAreas, {url})).value
	} catch (err) {
		console.warn('student-work: could not read the areas file', String(err))
		return undefined
	}
}

/// Each area's units as pairs, for the object's queries.
const pairs = (areas: Area[]): AreaUnits =>
	areas.flatMap(({slug, units}) => units.map((unit): [string, string] => [slug, unit]))

const board = (env: Env) => env.STUDENT_WORK.getByName('stolaf')
const iso = (ms: number) => new Date(ms).toISOString()

/// `/student-work/postings`: the board, narrowed by the query, newest first.
export async function postings(env: Env, work: StudentWork, params: URLSearchParams) {
	let filters = parseFilters(params)
	if (typeof filters === 'string') return json({message: filters}, 400)

	let areas = await readAreas(env, work.areasUrl)
	if (filters.area.length > 0 && !areas) return failed('the Student Work areas could not be read')
	let result = await board(env).list(filters, pairs(areas?.areas ?? []))
	if (result.state === 'error') return failed(result.error)
	return json(
		{updatedAt: iso(result.updatedAt), count: result.postings.length, postings: result.postings},
		200,
		ONE_HOUR,
	)
}

/// `/student-work/postings/:id`: one posting, with its description.
export async function posting(env: Env, work: StudentWork, id: string) {
	let areas = await readAreas(env, work.areasUrl)
	let result = await board(env).one(id, pairs(areas?.areas ?? []))
	if (result.state === 'error') return failed(result.error)
	if (!result.posting) return json({message: 'no such posting on the board'}, 404, ONE_MINUTE)
	let body: PostingWithDescription = {...result.posting, description: result.description}
	return json(body, 200, ONE_HOUR)
}

/// `/student-work/units`: each posting's unit by id, as the Node server's
/// route answers it. A posting whose detail has not been read is left out.
export async function units(env: Env, work: StudentWork) {
	let areas = await readAreas(env, work.areasUrl)
	let result = await board(env).units()
	if (result.state === 'error') return failed(result.error)
	return json(groupUnits(result.units, areas && new Set(areas.listed)), 200, ONE_HOUR)
}
