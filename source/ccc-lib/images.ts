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
	if (!isPublishedImage(group, name)) {
		ctx.status = 404
		return
	}

	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	const response = await http.get(imageUrl(group, name), {throwHttpErrors: false})
	if (response.status === 404) {
		ctx.status = 404
		return
	}
	if (!response.ok) {
		ctx.throw(502, `GitHub Pages answered ${response.status.toFixed(0)} for ${group}/${name}`)
	}

	ctx.type = 'image/webp'
	ctx.body = Buffer.from(await response.arrayBuffer())
}
