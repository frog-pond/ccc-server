import {get} from '../ccc-lib/http.js'
import {ONE_DAY} from '../ccc-lib/constants.js'
import {z} from 'zod'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {buildDetailMap} from '../ccc-lib/html.js'
import getUrls from 'get-urls'
import pMap from 'p-map'
import mem from 'memoize'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})

const jobsUrl = 'https://apps.carleton.edu/campus/sfs/employment/feeds/jobs'

const BOOLEAN_KEYS = ['Position available during term', 'Position available during break']

const PARAGRAPH_KEYS = ['Description']

type JobType = z.infer<typeof JobSchema>
const JobSchema = z.object({
	dateOpen: z.string(),
	department: z.string().nullable(),
	description: z.string(),
	duringBreak: z.boolean(),
	duringTerm: z.boolean(),
	id: z.string(),
	links: z.string().url().array(),
	offCampus: z.boolean(),
	title: z.string(),
})

export async function fetchJob(link: URL): Promise<JobType> {
	let id = link.searchParams.get('job_id')
	assert(id)

	if (link.protocol === 'http:') {
		link.protocol = 'https:'
	}

	const body = await GET_ONE_DAY(link).text()
	const dom = new JSDOM(body)

	const jobs = dom.window.document.querySelector('#jobs')
	assert(jobs)
	const title = jobs.querySelector('h3')
	assert(title)

	let titleText = title.textContent?.trim() ?? ''
	const offCampus = titleText.startsWith('Off Campus')
	if (offCampus) {
		titleText = titleText.replace(/^Off Campus: +/, '')
	}

	let details = jobs.querySelectorAll('ul:first-of-type > li')
	let detailMap = buildDetailMap(details, {paragraphs: PARAGRAPH_KEYS, boolean: BOOLEAN_KEYS})

	const description = detailMap.get('Description') ?? ''
	assert(typeof description === 'string')
	const links = Array.from(getUrls(description))

	const department = detailMap.get('Department or Office')
	assert(typeof department === 'string')

	const dateOpen = detailMap.get('Date Open') ?? 'Unknown'
	assert(typeof dateOpen === 'string')

	return JobSchema.parse({
		id: id,
		title: titleText,
		offCampus: offCampus,
		department,
		dateOpen,
		duringTerm: Boolean(detailMap.get('Position available during term')),
		duringBreak: Boolean(detailMap.get('Position available during break')),
		description,
		links: links,
	})
}

export type StudentWorkResponseType = z.infer<typeof StudentWorkResponseSchema>
export const StudentWorkResponseSchema = z.array(JobSchema)

export async function getAllJobs(): Promise<StudentWorkResponseType> {
	let body = await GET_ONE_DAY(jobsUrl).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let jobLinks = Array.from(dom.window.document.querySelectorAll('rss channel item link')).flatMap((link) => {
		let href = link.textContent?.trim() ?? ''
		return URL.canParse(href) ? [new URL(href)] : []
	})
	return pMap(jobLinks, fetchJob, {concurrency: 4})
}
