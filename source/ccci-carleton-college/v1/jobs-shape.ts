import {z} from 'zod'
import moment from 'moment'
import getUrls from 'get-urls'
import {htmlFragment, textFromHtml} from '../../ccc-lib/dom.ts'

/// Carleton's student jobs in the shape the app's /jobs screen reads. Nothing
/// here fetches, so the Node server and the Cloudflare Worker share it.

export const JobPostSchema = z.object({
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
export type JobPost = z.infer<typeof JobPostSchema>

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

/// A job as the Worker keeps it: the post's own fields, with its title
/// already read as text and its categories by name.
export interface StoredJobPost {
	id: string
	/// when it was published, as an instant
	postedAt: string
	link: string
	title: string
	html: string
	categories: string[]
}

export function convertJobPost(post: JobPost) {
	return jobFromPost({
		id: String(post.id),
		postedAt: moment.utc(post.date_gmt).toISOString(),
		link: post.link,
		title: textFromHtml(post.title.rendered),
		html: post.content.rendered,
		categories: (post._embedded?.['wp:term'] ?? [])
			.flat()
			.filter((t) => t.taxonomy === 'category')
			.map((t) => t.name),
	})
}

export function jobFromPost(post: StoredJobPost) {
	let text = htmlToText(post.html)
	let categories = post.categories

	/// The category is authoritative; the "Position available" line is a fallback.
	let availability = [...categories, field(text, ['Position available']) ?? ''].join(' ')

	let descriptionStart = /^Description\s*:[ \t]*/im.exec(text)
	let description = descriptionStart
		? text.slice(descriptionStart.index + descriptionStart[0].length)
		: text

	let hrefs = [...htmlFragment(post.html).querySelectorAll('a[href]')].map((a) =>
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
		id: post.id,
		title: post.title,
		offCampus: categories.some((c) => /CBWS/i.test(c)),
		department: field(text, DEPARTMENT_LABELS) ?? '',
		dateOpen: field(text, ['Date Open']) ?? moment.utc(post.postedAt).format('MM/DD/YYYY'),
		duringTerm: /term/i.test(availability),
		duringBreak: /break/i.test(availability),
		description: description,
		links: links,
	}
}
