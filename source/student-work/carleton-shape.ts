import {z} from 'zod'
import {textFromHtml} from '../ccc-lib/dom.ts'
import {readDescriptionWith, type Description, type DescriptionLabels} from './posting-shape.ts'

/// Carleton's student jobs, as its Student Employment WordPress site publishes
/// them, read into the fields a client can filter on without parsing. Nothing
/// here fetches, so the Worker and the Node server can share it.

export const CARLETON_JOBS_ORIGIN = 'https://www.carleton.edu'
const CARLETON_JOBS_API = `${CARLETON_JOBS_ORIGIN}/student-employment/post-jobs/wp-json/wp/v2/posts`
/// WordPress answers at most 100 posts a page.
export const CARLETON_JOBS_PAGE_SIZE = 100

export function carletonJobsUrl(page: number): string {
	let params = new URLSearchParams({
		per_page: String(CARLETON_JOBS_PAGE_SIZE),
		page: String(page),
		_embed: 'wp:term',
	})
	return `${CARLETON_JOBS_API}?${params.toString()}`
}

export const CarletonJobPostSchema = z.object({
	id: z.number(),
	date_gmt: z.string(),
	modified_gmt: z.string(),
	link: z.url(),
	title: z.object({rendered: z.string()}),
	content: z.object({rendered: z.string()}),
	_embedded: z
		.object({
			'wp:term': z.array(z.array(z.object({taxonomy: z.string(), name: z.string()}))).optional(),
		})
		.optional(),
})
export type CarletonJobPost = z.infer<typeof CarletonJobPostSchema>

/// The labels the posting forms use. Most postings open with a "Department or
/// Office:" / "Date Open:" / "Position available:" / "Description:" block;
/// community-based work-study postings (category "CBWS Postings") are a list
/// of labelled lines of their own.
const LABELS = {
	promoted: {
		'department or office': 'department',
		'department/office': 'department',
		'date open': 'dateOpen',
		'position available': 'availability',
		classification: 'classification',
		'rate of pay': 'wage',
		supervisor: 'supervisor',
		'name and address of employer': 'employer',
		'address of where duties are performed': 'workLocation',
		'location where duties performed': 'workLocation',
		'date position is active': 'active',
	},
	// the post's own title
	dropped: new Set(['job title']),
} as const satisfies DescriptionLabels<string>

export type CarletonField = (typeof LABELS.promoted)[keyof typeof LABELS.promoted]

export interface CarletonPosting {
	id: string
	title: string
	/// the posting's page on the Student Employment site
	url: string
	/// when it was published and last edited, as ISO instants
	postedAt: string
	modifiedAt: string
	/// "Date Open" as `YYYY-MM-DD`, when the posting gives a date
	opensOn: string | null
	/// the WordPress categories, as named ("Available during Term", "CBWS Postings")
	categories: string[]
	duringTerm: boolean
	duringBreak: boolean
	/// community-based work-study, with an employer other than the college
	offCampus: boolean
	/// the labelled lines worth a name of their own, as written
	department: string | null
	dateOpen: string | null
	availability: string | null
	classification: string | null
	wage: string | null
	supervisor: string | null
	employer: string | null
	workLocation: string | null
	active: string | null
	/// every link in the posting (application forms, attachments), in order
	links: string[]
}

export type CarletonDescription = Description<CarletonField> & {html: string}

export interface CarletonPostingWithDescription extends CarletonPosting {
	description: CarletonDescription
}

const categoriesOf = (post: CarletonJobPost) =>
	(post._embedded?.['wp:term'] ?? [])
		.flat()
		.filter((term) => term.taxonomy === 'category')
		.map((term) => textFromHtml(term.name))

/// Archived postings stay on the site, filed under "Archived".
export const isArchived = (post: CarletonJobPost) =>
	categoriesOf(post).some((name) => name === 'Archived')

/// WordPress's GMT times have no zone; they are UTC.
const instant = (gmt: string) => new Date(`${gmt}Z`).toISOString()

/// "10/22/2026" as "2026-10-22".
function isoDate(written: string | undefined): string | null {
	let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(written?.trim() ?? '')
	if (!match) return null
	let [, month = '', day = '', year = ''] = match
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function linksOf(html: string): string[] {
	let hrefs = [...html.matchAll(/\bhref\s*=\s*"([^"]*)"/giu)].map(([, href = '']) =>
		textFromHtml(href),
	)
	return [...new Set(hrefs.filter((href) => /^(?:https?|mailto):/iu.test(href)))]
}

export function carletonPosting(post: CarletonJobPost): CarletonPostingWithDescription {
	let html = post.content.rendered
	let description = readDescriptionWith(html, LABELS)
	let named = description.promoted
	let categories = categoriesOf(post)
	// the category is authoritative; the "Position available" line is a fallback
	let availability = [...categories, named.availability ?? ''].join(' ')

	return {
		id: String(post.id),
		title: textFromHtml(post.title.rendered),
		url: post.link,
		postedAt: instant(post.date_gmt),
		modifiedAt: instant(post.modified_gmt),
		opensOn: isoDate(named.dateOpen),
		categories,
		duringTerm: /\bterm\b/iu.test(availability),
		duringBreak: /\bbreak\b/iu.test(availability),
		offCampus: categories.some((name) => /CBWS/iu.test(name)),
		department: named.department ?? null,
		dateOpen: named.dateOpen ?? null,
		availability: named.availability ?? null,
		classification: named.classification ?? null,
		wage: named.wage ?? null,
		supervisor: named.supervisor ?? null,
		employer: named.employer ?? null,
		workLocation: named.workLocation ?? null,
		active: named.active ?? null,
		links: linksOf(html),
		description: {...description, html},
	}
}
