import {ERROR_MAX_AGE} from './lifetimes.ts'
import {upstream} from './upstream.ts'

/// The repository whose branches Workers Builds deploys as Previews.
const PULLS = 'https://api.github.com/repos/frog-pond/ccc-server/pulls?state=open&per_page=100'

/// Where each Preview is served: `<preview name>-ccc-server.<subdomain>.workers.dev`.
const PREVIEW_HOST = 'ccc-server.frog-pond-d8f.workers.dev'

/// How long the list of pull requests is kept, here and by clients. GitHub
/// answers an unauthenticated client 60 times an hour.
const PREVIEWS_MAX_AGE = 60

/// The Preview name Workers Builds gives a branch: lowercased, with each run
/// of anything but letters and digits made one `-`. Checked against the
/// Preview URLs Cloudflare posted on every pull request through #1256.
export const previewName = (branch: string) =>
	branch
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '')

export const previewUrl = (branch: string) => `https://${previewName(branch)}-${PREVIEW_HOST}`

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
	/// null for a pull request from a fork, whose branch Workers Builds does not build
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
			cf: {cacheTtl: PREVIEWS_MAX_AGE, cacheEverything: true},
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
