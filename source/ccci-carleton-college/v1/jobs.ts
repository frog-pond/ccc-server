import {get} from '../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {JSDOM} from 'jsdom'
import getUrls from 'get-urls'
import pMap from 'p-map'
import type {Context} from '../../ccc-server/context.js'
import assert from 'node:assert/strict'
import {buildDetailMap} from '../../ccc-lib/html.js'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})
const GET_TWO_DAYS = mem(get, {maxAge: ONE_DAY * 2})

const jobsUrl = 'https://apps.carleton.edu/campus/sfs/employment/feeds/jobs'

const BOOLEAN_KEYS = ['Position available during term', 'Position available during break']

const PARAGRAPHICAL_KEYS = ['Description']

export async function fetchJob(link: URL) {
	let id = link.searchParams.get('job_id')
	assert(id)

	if (link.protocol === 'http:') {
		link.protocol = 'https:'
	}

	const body = await GET_TWO_DAYS(link).text()
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
	let detailMap = buildDetailMap(details, {paragraphs: PARAGRAPHICAL_KEYS, boolean: BOOLEAN_KEYS})

	const description = detailMap.get('Description') ?? ''
	const links = Array.from(getUrls(description === true ? '' : description))

	return {
		id: id,
		title: titleText,
		offCampus: offCampus,
		department: detailMap.get('Department or Office'),
		dateOpen: detailMap.get('Date Open') ?? 'Unknown',
		duringTerm: Boolean(detailMap.get('Position available during term')),
		duringBreak: Boolean(detailMap.get('Position available during break')),
		description: detailMap.get('Description') ?? '',
		links: links,
	}
}

async function _getAllJobs() {
	let body = await GET_ONE_DAY(jobsUrl).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let jobLinks = Array.from(dom.window.document.querySelectorAll('rss channel item link')).flatMap(
		(link) => {
			let href = link.textContent?.trim() ?? ''
			return URL.canParse(href) ? [new URL(href)] : []
		},
	)
	return pMap(jobLinks, fetchJob, {concurrency: 4})
}

export const getJobs = mem(_getAllJobs, {maxAge: ONE_HOUR})

export async function jobs(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getJobs()
}
