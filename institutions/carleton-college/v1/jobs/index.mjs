import got from 'got'
import mem from 'mem'
import _jsdom from 'jsdom'
import url from 'url'
import qs from 'querystring'
import getUrls from 'get-urls'
const {JSDOM} = _jsdom

const GET_BASE = (url, opts) => got.get(url, Object.assign({
	headers: {
		'User-Agent': `ccc-server/1 (https://github.com/frog-pond/ccc-server)`
	},
}, opts))

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = ONE_HOUR * 24
const ONE_WEEK = ONE_DAY * 7
const GET = mem(GET_BASE, {maxAge: ONE_DAY})
const GET_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR})
const GET_WEEK = mem(GET_BASE, {maxAge: ONE_WEEK})

const jobsBase =
	'https://apps.carleton.edu/campus/sfs/employment/feeds/jobs'

const BOOLEAN_KEYS = [
	'Position available during term',
	'Position available during break',
]

const PARAGRAPHICAL_KEYS = ['Description']

export async function fetchJob(link) {
	let {job_id: id} = qs.parse(url.parse(link).query)

	link = link.replace(/^http:/, 'https:')
	const page = await GET_WEEK(link)
	const dom = new JSDOM(page.body)

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
			value = [...listEl.querySelectorAll('p')]
				.map(el => el.textContent)
				.join('\n\n')
				.trim()
		} else {
			value = value.map(el => el.textContent).join(' ').trim()
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

async function getAllJobs(ctx) {
	let resp = await GET_BASE(jobsBase)
	let dom = new JSDOM(resp.body, {contentType: 'text/xml'})
	let jobLinks = [...dom.window.document.querySelectorAll('rss channel item link')].map(link => link.textContent.trim())
	return Promise.all(jobLinks.map(fetchJob))
}

const GET_ALL_JOBS = mem(getAllJobs, {maxAge: ONE_HOUR})

export async function jobs(ctx) {
	ctx.body = await GET_ALL_JOBS(ctx)
}
