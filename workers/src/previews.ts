import {ERROR_MAX_AGE} from './lifetimes.ts'
import {upstream} from './upstream.ts'

/// The repository whose branches Workers Builds deploys as Previews.
const PULLS = 'https://api.github.com/repos/frog-pond/ccc-server/pulls?state=open&per_page=100'

/// Where each Preview is served: `<preview name>-ccc-server.<subdomain>.workers.dev`.
const PREVIEW_HOST = 'ccc-server.frog-pond-d8f.workers.dev'

/// How long Cloudflare keeps GitHub's list of pull requests. Branches to test
/// open rarely, and the Worker has no purge, so a new one can take this long
/// to appear. GitHub answers an unauthenticated client 60 times an hour.
const PULLS_CACHE_TTL = 15 * 60

/// How long a client keeps the list. Short, so an app's refresh reaches the
/// Worker rather than its own HTTP cache.
const PREVIEWS_MAX_AGE = 60

/// The Preview name Workers Builds gives a branch: lowercased, with each run
/// of anything but letters and digits made one `-`. Checked against the
/// Preview URLs Cloudflare posted on every pull request through #1256.
export const previewName = (branch: string) =>
	branch
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '')

/// The longest name a Preview keeps whole: `<name>-ccc-server` is one DNS
/// label, at most 63 characters. Cloudflare cuts a longer one and adds a hash
/// of the branch, which cannot be worked out here.
const LONGEST_NAME = 63 - '-ccc-server'.length

/// The URL a branch's Preview is served at, or null when Cloudflare shortens
/// its name.
export function previewUrl(branch: string): string | null {
	let name = previewName(branch)
	return name.length > LONGEST_NAME ? null : `https://${name}-${PREVIEW_HOST}`
}

type Pull = {
	number: number
	title: string
	html_url: string
	head: {ref: string; repo: {full_name: string} | null}
	base: {repo: {full_name: string}}
}

/// An open pull request and the Preview its branch is deployed to.
export type Preview = {
	number: number
	title: string
	branch: string
	prUrl: string
	/// null for a pull request from a fork, whose branch Workers Builds does not
	/// build, and for a branch whose Preview name Cloudflare shortens
	previewUrl: string | null
}

const fromPull = (pull: Pull): Preview => ({
	number: pull.number,
	title: pull.title,
	branch: pull.head.ref,
	prUrl: pull.html_url,
	previewUrl:
		pull.head.repo?.full_name === pull.base.repo.full_name ? previewUrl(pull.head.ref) : null,
})

/// The open pull requests and their Preview URLs, newest first. A Preview's
/// URL is answered whether or not its build has finished, or succeeded.
export async function previews(): Promise<Response> {
	try {
		let response = await upstream(PULLS, {
			headers: {Accept: 'application/vnd.github+json'},
			cf: {cacheTtl: PULLS_CACHE_TTL, cacheEverything: true},
		})
		if (!response.ok) throw new Error(`GitHub answered ${response.status.toFixed(0)}`)
		let pulls = await response.json<Pull[]>()
		return Response.json(pulls.map(fromPull), {
			headers: {'Cache-Control': `public, max-age=${PREVIEWS_MAX_AGE.toFixed(0)}`},
		})
	} catch (err) {
		console.error(err)
		return Response.json(
			{message: err instanceof Error ? err.message : String(err)},
			{status: 502, headers: {'Cache-Control': `public, max-age=${ERROR_MAX_AGE.toFixed(0)}`}},
		)
	}
}
