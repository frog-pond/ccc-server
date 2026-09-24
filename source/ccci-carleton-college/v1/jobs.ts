import {getText} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import {parseHtml, parseXml} from '../../ccc-lib/dom.ts'
import getUrls from 'get-urls'
import pMap from 'p-map'
import type {Context} from '../../ccc-server/context.ts'
import {buildDetailMap} from '../../ccc-lib/html.ts'
import {unavailableJobs} from './deprecated.ts'

const jobsUrl = 'https://apps.carleton.edu/campus/sfs/employment/feeds/jobs'

const BOOLEAN_KEYS = ['Position available during term', 'Position available during break']

const PARAGRAPHICAL_KEYS = ['Description']

export function jobIdFromLink(link: URL): string {
	let id = link.searchParams.get('job_id')
	if (!id) {
		throw new Error(`no job_id in ${link.href}`)
	}
	return id
}

export function parseJobPage(html: string, id: string, pageUrl: URL) {
	const jobs = parseHtml(html).querySelector('#jobs')
	if (!jobs) {
		throw new Error(`no #jobs element in ${pageUrl.href}`)
	}
	const title = jobs.querySelector('h3')
	if (!title) {
		throw new Error(`no job title (#jobs h3) in ${pageUrl.href}`)
	}

	let titleText = title.textContent.trim()
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

export async function fetchJob(link: URL) {
	let id = jobIdFromLink(link)

	if (link.protocol === 'http:') {
		link.protocol = 'https:'
	}

	return parseJobPage(await getText(link), id, link)
}

/// Kept against the block being lifted: the feed's shape has not changed,
/// only our ability to reach it.
export async function getAllJobs() {
	let body = await getText(jobsUrl)
	let doc = parseXml(body)
	let jobLinks = Array.from(doc.querySelectorAll('rss channel item link')).flatMap((link) => {
		let href = link.textContent.trim()
		return URL.canParse(href) ? [new URL(href)] : []
	})
	return pMap(jobLinks, fetchJob, {concurrency: 4})
}

export function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = unavailableJobs()
}
