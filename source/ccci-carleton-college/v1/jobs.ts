import {get} from '../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {JSDOM} from 'jsdom'
import url from 'url'
import qs from 'querystring'
import getUrls from 'get-urls'
import pMap from 'p-map'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})
const GET_TWO_DAYS = mem(get, {maxAge: ONE_DAY * 2})

const jobsUrl = 'https://apps.carleton.edu/campus/sfs/employment/feeds/jobs'

const BOOLEAN_KEYS = [
	'Position available during term',
	'Position available during break',
]

const PARAGRAPHICAL_KEYS = ['Description']

export async function fetchJob(link) {
	let {job_id: id} = qs.parse(url.parse(link).query)

	link = link.replace(/^http:/, 'https:')
	const body = await GET_TWO_DAYS(link).text()
	const dom = new JSDOM(body)

	const jobs = dom.window.document.querySelector('#jobs')
	const title = jobs.querySelector('h3')

	let titleText = title.textContent.trim()
	const offCampus = /^Off Campus/.test(titleText)
	if (offCampus) {
		titleText = titleText.replace(/^Off Campus: +/, '')
	}

	const details = jobs.querySelectorAll('ul:first-of-type > li')
	const detailMap = [...details].reduce((coll, listEl) => {
		let [key, ...value] = listEl.childNodes
		key = key.textContent.replace(/:$/, '')

		if (BOOLEAN_KEYS.includes(key)) {
			value = true
		} else if (PARAGRAPHICAL_KEYS.includes(key)) {
			let paragraphs = [...listEl.querySelectorAll('p')]
			let content = paragraphs.length ? paragraphs : value
			value = content
				.map((el) => el.textContent)
				.join('\n\n')
				.trim()
		} else {
			value = value
				.map((el) => el.textContent)
				.join(' ')
				.trim()
		}

		coll.set(key, value)

		return coll
	}, new Map())

	const description = detailMap.get('Description') || ''
	const links = Array.from(getUrls(description))

	return {
		id: id,
		title: titleText,
		offCampus: offCampus,
		department: detailMap.get('Department or Office'),
		dateOpen: detailMap.get('Date Open') || 'Unknown',
		duringTerm: Boolean(detailMap.get('Position available during term')),
		duringBreak: Boolean(detailMap.get('Position available during break')),
		description: detailMap.get('Description') || '',
		links: links,
	}
}

async function _getAllJobs() {
	let body = await GET_ONE_DAY(jobsUrl).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let jobLinks = Array.from(
		dom.window.document.querySelectorAll('rss channel item link'),
	).map((link) => link.textContent.trim())
	return pMap(jobLinks, fetchJob, {concurrency: 4})
}

export const getJobs = mem(_getAllJobs, {maxAge: ONE_HOUR})

export async function jobs(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getJobs()
}