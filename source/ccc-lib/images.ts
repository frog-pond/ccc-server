import {Buffer} from 'node:buffer'
import {http} from './http.ts'
import {ONE_DAY} from './constants.ts'
import type {Context} from '../ccc-server/context.ts'

/**
 * The folders of the app repo's `images/` that its `bundle-data` task publishes
 * under `img/` on GitHub Pages. Anything else is refused before it reaches
 * Pages, so this route cannot be used to fetch the rest of the site.
 */
export const IMAGE_GROUPS = new Set(['contacts', 'news-sources', 'spaces', 'streaming', 'webcams'])

/** A published file name: lowercase words joined by hyphens, as WebP. */
const IMAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/u

export function isPublishedImage(group: string, name: string): boolean {
	return IMAGE_GROUPS.has(group) && IMAGE_NAME.test(name)
}

/**
 * Both institutions' servers serve the All About Olaf site's images, not their
 * own `gh-pages.ts` site, so the address is here rather than there.
 */
export const imageUrl = (group: string, name: string): URL =>
	new URL(`https://stodevx.github.io/AAO-React-Native/img/${group}/${name}`)

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
		response = await http.get(imageUrl(group, name), {throwHttpErrors: false})
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
