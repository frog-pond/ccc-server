import {DISCUSSION_URL, UNAVAILABLE_TITLE} from '../../ccc-lib/deprecated.ts'
import {z} from 'zod'

/// The A–Z index's notice for builds that still ask this server for it,
/// shaped for the renderer those builds ship (see `deprecated.ts`).

const LinkGroupSchema = z.object({
	title: z.string(),
	data: z.array(z.object({label: z.string(), url: z.url()})),
})

export function deprecatedLinkGroups(text: string) {
	return LinkGroupSchema.array().parse([
		{title: UNAVAILABLE_TITLE, data: [{label: text, url: DISCUSSION_URL}]},
	])
}

export const A_TO_Z_TEXT = "The A–Z index can't be loaded right now. Tap for details."
