/// Where All About Olaf's data files and images are published: the prefix a
/// dev origin takes the place of.
export const STOLAF_PUBLISHED = 'https://stolaf.dev/AAO-React-Native/'

/// The origin `wrangler dev` was told to serve St. Olaf's data from in place
/// of stolaf.dev, or undefined. The Mac data editor passes it through
/// `source/dev/index.ts`; wrangler.jsonc never sets it, so a deploy has none.
export function devPagesOrigin(env: {
	PAGES_ORIGIN_OVERRIDE?: string | undefined
}): string | undefined {
	let value = env.PAGES_ORIGIN_OVERRIDE
	if (!value) return undefined
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		return undefined
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
	return parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`
}

/// `url` on `origin` when it is one of St. Olaf's published files; otherwise `url`.
export function rebased(url: string, origin: string | undefined): string {
	if (origin === undefined || !url.startsWith(STOLAF_PUBLISHED)) return url
	return origin + url.slice(STOLAF_PUBLISHED.length)
}
