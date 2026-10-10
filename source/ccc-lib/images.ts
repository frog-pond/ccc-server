import {Buffer} from 'node:buffer'
import {TOTAL_TIMEOUT, http} from './http.ts'
import {ONE_DAY} from './constants.ts'
import type {Context} from '../ccc-server/context.ts'

export {IMAGE_GROUPS, imageUrl, isPublishedImage} from './images-shape.ts'
import {imageUrl, isPublishedImage} from './images-shape.ts'

export async function image(ctx: Context) {
	const {group = '', name = ''} = ctx.params
	// The response cache keys on the whole URL, query string included, and each
	// entry here is a whole image: `?1`, `?2`, ... would each store another copy.
	if (ctx.querystring || !isPublishedImage(group, name)) {
		ctx.status = 404
		return
	}

	if (ctx.cached(ONE_DAY)) {
		ctx.cacheControl(ONE_DAY)
		return
	}

	let response
	try {
		// the signal bounds the body read below too, which ky's totalTimeout doesn't reach
		response = await http.get(imageUrl(group, name), {
			throwHttpErrors: false,
			signal: AbortSignal.timeout(TOTAL_TIMEOUT),
		})
	} catch (error) {
		// a timeout, or a connection that never got an answer
		ctx.throw(502, `GitHub Pages could not be reached for ${group}/${name}`, {cause: error})
	}

	// Cache-Control is set only on a file, so that a 404 for an image Pages has
	// not deployed yet is not held by the app or a proxy for a day.
	if (response.status === 404) {
		ctx.status = 404
		return
	}
	if (!response.ok) {
		ctx.throw(502, `GitHub Pages answered ${response.status.toFixed(0)} for ${group}/${name}`)
	}

	ctx.cacheControl(ONE_DAY)
	ctx.type = 'image/webp'
	ctx.body = Buffer.from(await response.arrayBuffer())
}
