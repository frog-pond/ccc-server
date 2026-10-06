import {z} from 'zod'
import {HTTPError} from 'ky'
import moment from 'moment'
import getUrls from 'get-urls'
import {htmlFragment, textFromHtml} from '../../ccc-lib/dom.ts'
import {getJson} from '../../ccc-lib/http.ts'
import {countedLoad, feedName} from '../../ccc-lib/feed-metrics.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

const jobsUrl = 'https://www.carleton.edu/student-employment/post-jobs/wp-json/wp/v2/posts'

const JobPostSchema = z.object({
	id: z.number(),
	date_gmt: z.string(),
	link: z.url(),
	title: z.object({rendered: z.string()}),
	content: z.object({rendered: z.string()}),
	_embedded: z
		.object({
			'wp:term': z.array(z.array(z.object({taxonomy: z.string(), name: z.string()}))).optional(),
		})
		.optional(),
})
type JobPost = z.infer<typeof JobPostSchema>

/// Postings come in two shapes. Most start with a "Department or Office:" /
/// "Date Open:" / "Position available:" / "Description:" block; community-based
/// work-study postings (category "CBWS Postings") are free-form, with a
/// "Job title:" and "Name and address of employer" instead.
const DEPARTMENT_LABELS = ['Department or Office', 'Department/Office']

/// Renders the post's HTML as text, keeping line and paragraph breaks.
function htmlToText(html: string) {
	let withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
	return htmlFragment(withBreaks)
		.textContent.replace(/\u00a0/g, ' ')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

/// The text after `Label:` on its own line, if the post has one.
function field(text: string, labels: string[]) {
	for (let label of labels) {
		let match = new RegExp(`^${label}\\s*:[ \\t]*(.*)$`, 'im').exec(text)
		if (match?.[1]) return match[1].trim()
	}
	return undefined
}

export function convertJobPost(post: JobPost) {
	let text = htmlToText(post.content.rendered)
	let categories = (post._embedded?.['wp:term'] ?? [])
		.flat()
		.filter((t) => t.taxonomy === 'category')
		.map((t) => t.name)

	/// The category is authoritative; the "Position available" line is a fallback.
	let availability = [...categories, field(text, ['Position available']) ?? ''].join(' ')

	let descriptionStart = /^Description\s*:[ \t]*/im.exec(text)
	let description = descriptionStart
		? text.slice(descriptionStart.index + descriptionStart[0].length)
		: text

	let hrefs = [...htmlFragment(post.content.rendered).querySelectorAll('a[href]')].map((a) =>
		a.getAttribute('href'),
	)
	let links = [
		...new Set([
			post.link,
			...hrefs.filter((h) => h !== null && URL.canParse(h)),
			...getUrls(text),
		]),
	]

	return {
		id: String(post.id),
		title: textFromHtml(post.title.rendered),
		offCampus: categories.some((c) => /CBWS/i.test(c)),
		department: field(text, DEPARTMENT_LABELS) ?? '',
		dateOpen: field(text, ['Date Open']) ?? moment.utc(post.date_gmt).format('MM/DD/YYYY'),
		duringTerm: /term/i.test(availability),
		duringBreak: /break/i.test(availability),
		description: description,
		links: links,
	}
}

const PAGE_SIZE = 100

/// WordPress caps `per_page` at 100, so a longer list is read a page at a time.
/// A page past the end answers 400, which is how a list of exactly 100n posts
/// shows its end.
async function fetchAllPosts() {
	let posts: JobPost[] = []
	for (let page = 1; ; page++) {
		let batch: JobPost[]
		try {
			// pages are read in turn: whether there is a next one depends on this one
			// eslint-disable-next-line no-await-in-loop
			let body = await getJson(jobsUrl, {
				searchParams: {per_page: PAGE_SIZE, page, _embed: 'wp:term'},
			})
			batch = z.array(JobPostSchema).parse(body)
		} catch (error) {
			if (page > 1 && error instanceof HTTPError && error.response.status === 400) break
			throw error
		}
		posts.push(...batch)
		if (batch.length < PAGE_SIZE) break
	}
	return posts
}

export function getAllJobs() {
	return countedLoad('wp-jobs', feedName(jobsUrl), async () => {
		let posts = await fetchAllPosts()
		return posts
			.filter((p) => !p._embedded?.['wp:term']?.flat().some((t) => t.name === 'Archived'))
			.map(convertJobPost)
	})
}

export async function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = await getAllJobs()
}
