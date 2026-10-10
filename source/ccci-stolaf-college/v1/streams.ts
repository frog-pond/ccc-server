import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {
	listParams,
	pageLinks,
	searchParams,
	streamsFrom,
	type StOlafParamsType,
} from './streams-shape.ts'

const getStreams = async (params: StOlafParamsType) => {
	const url = 'https://www.stolaf.edu/multimedia/api/collection'
	return streamsFrom(await getJson(url, {searchParams: params}))
}

export async function upcoming(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const params = listParams('upcoming', Object.fromEntries(ctx.URL.searchParams.entries()))
	ctx.body = (await getStreams(params)).streams
}

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const params = listParams('archived', Object.fromEntries(ctx.URL.searchParams.entries()))
	ctx.body = (await getStreams(params)).streams
}

// Upstream answers a page at a time, so what has happened is newest first: with
// ascending order a broad query would only ever show the oldest matches.
export async function search(ctx: Context) {
	// Checked before the cache is asked, so a bad request isn't counted as a
	// miss or made to fill an entry.
	const parsed = searchParams(Object.fromEntries(ctx.URL.searchParams.entries()))
	if ('error' in parsed) ctx.throw(400, parsed.error)
	const {params, count, offset} = parsed

	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const {streams, available} = await getStreams(params)

	// Without a total from upstream there is nothing to say about other pages.
	const link =
		available === undefined
			? undefined
			: pageLinks({path: ctx.path, querystring: ctx.querystring, count, offset, available})
	if (link) ctx.set('Link', link)
	ctx.body = streams
}
