import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import {cleanTextBlock, findHtmlKey, getDetailMap} from '../../ccc-lib/html.js'
import mem from 'memoize'
import pMap from 'p-map'
import {JSDOM} from 'jsdom'
import getUrls from 'get-urls'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})
const GET_TWO_DAYS = mem(get, {maxAge: ONE_DAY * 2})

const jobsUrl = 'https://wp.stolaf.edu/student-jobs/wp-json/wp/v2/pages/80'

/**
 * Set of keys in the html to target when looking at long-form content
 * that we need to parse line breaks and special characters within. This
 * is specific to the stolaf-college jobs detail page.
 */
const PARAGRAPHICAL_KEYS = [
	'Job Description',
	'Skills Needed',
	'Additional Comments',
	'How to Apply',
	'Hiring Timeline',
]

/**
 * Builds a json response suitable for the client to render
 *
 * @param {*} url  the canonical url for the job detail page
 * @param {*} dom  the JSDOM used for extracting one-off selectors
 * @param {*} findKey  a function for extracting mapped job data
 * @returns a cleaned, parsed, and formatted version of the data as JSON
 */
function buildJobDetailResponse(url, dom, findKey) {
	const id = url.replace(/\D/g, '')
	const titleText = dom.window.document.querySelector(
		'.gv-list-view-title > h3',
	).textContent

	const [contactFirstName, contactLastName] =
		findKey('Contact Person').split(' ')
	const contactName = `${contactFirstName} ${contactLastName}`.trim()

	const description = cleanTextBlock(findKey('Job Description'))
	const comments = cleanTextBlock(findKey('Additional Comments'))
	const skills = cleanTextBlock(findKey('Skills Needed'))
	const howToApply = cleanTextBlock(findKey('How to Apply'))
	const timeline = cleanTextBlock(findKey('Hiring Timeline'))

	const links = getLinksFromJob({description, comments, skills, howToApply})

	return {
		comments: comments,
		contactEmail: fixupEmailFormat(findKey('Contact Email')),
		contactName: contactName,
		contactPhone: fixupPhoneFormat(findKey('Phone Extension')),
		description: description,
		goodForIncomingStudents: Boolean(
			findKey('Appropriate for incoming/first-year students'),
		),
		hoursPerWeek: findKey('Hours/week'),
		howToApply: howToApply,
		id: id,
		lastModified: findKey('Date Posted'),
		links: links,
		office: findKey('Office'),
		openPositions: findKey('Number of Available Positions'),
		skills: skills,
		timeline: timeline,
		timeOfHours: findKey('Time of Hours'),
		title: titleText,
		type: findKey('Job Type'),
		url: url,
		year: findKey('Job Year'),
	}
}

async function fetchDetail(url) {
	const body = await GET_TWO_DAYS(url).text()

	// run-scripts value is needed to properly evaluate javascript to display an email address.
	// see the jsdom documentation for more details https://github.com/jsdom/jsdom#executing-scripts
	const dom = new JSDOM(body, {
		contentType: 'text/html',
		runScripts: 'dangerously',
	})

	/**
	 * Details is a node list of HTMLDivElement. It is a scoped version of the webpage containing
	 * all the text elements we need to parse (both keys and values) via `getDetailMap`.
	 */
	const details = dom.window.document.querySelectorAll('div')

	/**
	 * A key-value Map for querying text elements from html data.
	 */
	const detailMap = getDetailMap(details, PARAGRAPHICAL_KEYS)

	/**
	 * Wrapper function to simplify the api for calling `findHtmlKey` by centralizing where
	 * the datastructure `detailMap` is passed-in to one place.
	 */
	const findKey = (key) => findHtmlKey(key, detailMap)

	return buildJobDetailResponse(url, dom, findKey)
}

export function getLinksFromJob({description, comments, skills, howToApply}) {
	// Clean up returns, newlines, tabs, and misc symbols...
	// ...and search for application links in the text
	return Array.from(
		new Set([
			...getUrls(description),
			...getUrls(comments),
			...getUrls(skills),
			...getUrls(howToApply),
		]),
	)
}

function fixupPhoneFormat(phoneNumber) {
	return phoneNumber.length === 4 ? `507-786-${phoneNumber}` : phoneNumber
}

function fixupEmailFormat(email) {
	if (!/@/.test(email)) {
		// No @ in address ... e.g. smith
		return `${email}@stolaf.edu`
	} else if (/@$/.test(email)) {
		// @ at end ... e.g. smith@
		return `${email}stolaf.edu`
	} else {
		// Defined address ... e.g. smith@stolaf.edu
		return email
	}
}

/**
 * The paginator is included within the nested html. We can see if we need to continue requesting
 * more data by checking if the button dedicated to clicking next is present.
 *
 * While there are a few ways to go about parsing whether we've reached the last page, the
 * paginator looks like it doesn't even know when it has reached the end of the results! Instead
 * of trying to keep tracking of the amount of items we can opt to check the dom for the presence
 * of the button.
 */
function nextPageExists(dom) {
	if (dom === undefined) {
		return false
	}

	const elements = dom.window.document.querySelectorAll('.next.page-numbers')
	return elements.length > 0
}

/**
 * The top-level results html provides a bunch of html with links to each posting. We can gather
 * each link's href from these pages.
 *
 * @returns {string[]}
 */
export function findPageUrls(dom) {
	return Array.from(
		dom.window.document.querySelectorAll(
			'.gv-list-view > .gv-list-view-title > h3 > a',
		),
	).map((anchor) => anchor.getAttribute('href'))
}

/**
 * The coldfusion endpoint stopped providing a robust json api response and started serving
 * a much rougher wp-json endpoint according to our logs on 09/27/2022. Implementation as of
 * 10/16/2022 is designed around making a series of network requests that involve both json
 * and html parsing to deliver the same set of props to match the client's api contract.
 *
 * In short, we are performing the following fetching and parsing steps:
 * 1. [json] wp-json paginated requests to get page urls (1-3 requests for 25->50->75 entries)
 *           where we target html stored within a json field response
 * 2. [html] detail page html requests, involves html parsing and returning json (easily 50+ requests)
 *
 * So we end up making multiple requests to the paginated wp-json endpoint to build a list of
 * all job posting urls, and finally request each url we find to build our data.
 */
async function _getJobs() {
	/**  @type {string[]} */
	let allUrls = []

	/**
	 * The top-level wp-json endpoint which provides the list of job postings responds to a query
	 * parameter named `pagenum`. The paginator as of 10/16/2022 lists 25 entries at a time, so if
	 * we see 51 entries, we would expect to query this endpoint three times.
	 */
	let pageNumber = 1

	let previousDom = undefined

	do {
		// eslint-disable-next-line no-await-in-loop
		const body = await GET_ONE_DAY(`${jobsUrl}?pagenum=${pageNumber}`).json()
		const {rendered} = body.content

		const dom = new JSDOM(rendered, {contentType: 'text/html'})
		previousDom = dom
		pageNumber += 1

		const fetchedUrls = findPageUrls(dom)
		allUrls.push(...fetchedUrls)
	} while (nextPageExists(previousDom))

	return pMap(allUrls, fetchDetail, {concurrency: 4})
}

export const getJobs = mem(_getJobs, {maxAge: ONE_DAY})

export async function jobs(ctx) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getJobs()
}
