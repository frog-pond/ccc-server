import {JSDOM} from 'jsdom'
import {buildDetailMap, cleanTextBlock, findHtmlKey} from '../ccc-lib/html.js'
import getUrls from 'get-urls'
import {z} from 'zod'
import pMap from 'p-map'
import {get} from '../ccc-lib/http.js'
import {ONE_DAY} from '../ccc-lib/constants.js'
import mem from 'memoize'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})
const GET_TWO_DAYS = mem(get, {maxAge: ONE_DAY * 2})

const getJobsUrl = () => new URL('https://wp.stolaf.edu/student-jobs/wp-json/wp/v2/pages/80')

export type JobType = z.infer<typeof JobSchema>
export const JobSchema = z.object({
	comments: z.string(),
	contactEmail: z.string(),
	contactName: z.string(),
	contactPhone: z.string(),
	description: z.string(),
	goodForIncomingStudents: z.boolean(),
	hoursPerWeek: z.string(),
	howToApply: z.string(),
	id: z.string(),
	lastModified: z.string(),
	links: z.string().array(),
	office: z.string(),
	openPositions: z.string(),
	skills: z.string(),
	timeOfHours: z.string(),
	timeline: z.string(),
	title: z.string(),
	type: z.string(),
	url: z.string(),
	year: z.string(),
})

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
] as const

/**
 * Builds a json response suitable for the client to render
 *
 * @param {*} url  the canonical url for the job detail page
 * @param {*} dom  the JSDOM used for extracting one-off selectors
 * @param {*} detailMap  the parsed information
 * @returns a cleaned, parsed, and formatted version of the data as JSON
 */
function buildJobDetailResponse(url: URL, dom: JSDOM, detailMap: Map<string, string>): JobType {
	const id = url.pathname.replace(/\D/g, '')
	const title = cleanTextBlock(dom.window.document.querySelector('.gv-list-view-title > h3')?.textContent ?? '')

	const [contactFirstName = '', contactLastName = ''] = findHtmlKey('Contact Person', detailMap).split(' ')
	const contactName = `${contactFirstName} ${contactLastName}`.trim()

	const description = cleanTextBlock(findHtmlKey('Job Description', detailMap))
	const comments = cleanTextBlock(findHtmlKey('Additional Comments', detailMap))
	const skills = cleanTextBlock(findHtmlKey('Skills Needed', detailMap))
	const howToApply = cleanTextBlock(findHtmlKey('How to Apply', detailMap))
	const links = getLinksFromJob(description, comments, skills, howToApply)

	return {
		comments,
		contactEmail: fixupEmailFormat(findHtmlKey('Contact Email', detailMap)),
		contactName: contactName,
		contactPhone: fixupPhoneFormat(findHtmlKey('Phone Extension', detailMap)),
		description,
		goodForIncomingStudents: Boolean(findHtmlKey('Appropriate for incoming/first-year students', detailMap)),
		hoursPerWeek: findHtmlKey('Hours/week', detailMap),
		howToApply,
		id: id,
		lastModified: findHtmlKey('Date Posted', detailMap),
		links: links,
		office: findHtmlKey('Office', detailMap),
		openPositions: findHtmlKey('Number of Available Positions', detailMap),
		skills,
		timeline: cleanTextBlock(findHtmlKey('Hiring Timeline', detailMap)),
		timeOfHours: findHtmlKey('Time of Hours', detailMap),
		title,
		type: findHtmlKey('Job Type', detailMap),
		url: url.toString(),
		year: findHtmlKey('Job Year', detailMap),
	}
}

async function fetchDetail(url: URL) {
	const body = await GET_TWO_DAYS(url).text()

	/**
	 * run-scripts value is needed to properly evaluate javascript to display an email address.
	 * see the jsdom documentation for more details https://github.com/jsdom/jsdom#executing-scripts
	 */
	const dom = new JSDOM(body, {
		contentType: 'text/html',
		runScripts: 'dangerously',
	})

	/**
	 * Details is a node list of HTMLDivElement. It is a scoped version of the webpage containing
	 * all the text elements we need to parse (both keys and values) via `buildDetailMap`.
	 */
	const details = dom.window.document.querySelectorAll('div')

	/** A key-value Map for querying text elements from html data. */
	const detailMap = buildDetailMap(details, {paragraphs: PARAGRAPHICAL_KEYS})

	return buildJobDetailResponse(url, dom, detailMap)
}

/** Clean up carriage returns, newlines, tabs, and misc symbols, and search for application links in the text */
export function getLinksFromJob(...texts: string[]): string[] {
	return Array.from(new Set(texts.flatMap((text) => Array.from(getUrls(text)))))
}

function fixupPhoneFormat(phoneNumber: string) {
	return phoneNumber.length === 4 ? `507-786-${phoneNumber}` : phoneNumber
}

function fixupEmailFormat(email: string) {
	if (!email.includes('@')) {
		// No @ in address ... e.g. smith
		return `${email}@stolaf.edu`
	} else if (email.endsWith('@')) {
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
function nextPageExists(dom: JSDOM) {
	return Boolean(dom.window.document.querySelector('.next.page-numbers'))
}

/**
 * The top-level results html provides a bunch of html with links to each posting. We can gather
 * each link's href from these pages.
 */
export function findPageUrls(dom: JSDOM) {
	return Array.from(dom.window.document.querySelectorAll('.gv-list-view > .gv-list-view-title > h3 > a')).flatMap(
		(anchor) => {
			let href = anchor.getAttribute('href')
			return href ? [new URL(href)] : []
		},
	)
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
export async function getJobs(): Promise<JobType[]> {
	let allUrls: URL[] = []

	/**
	 * The top-level wp-json endpoint which provides the list of job postings responds to a query
	 * parameter named `pagenum`. The paginator as of 10/16/2022 lists 25 entries at a time, so if
	 * we see 51 entries, we would expect to query this endpoint three times.
	 */
	let pageNumber = 1

	let previousDom = undefined

	do {
		let jobsUrl = getJobsUrl()
		jobsUrl.searchParams.set('pagenum', pageNumber.toString())

		const rendered = z
			.object({content: z.object({rendered: z.string()})})
			// eslint-disable-next-line no-await-in-loop
			.parse(await GET_ONE_DAY(jobsUrl).json()).content.rendered

		const dom = new JSDOM(rendered, {contentType: 'text/html'})
		previousDom = dom
		pageNumber += 1

		allUrls.push(...findPageUrls(dom))
	} while (nextPageExists(previousDom))

	return pMap(allUrls, fetchDetail, {concurrency: 4})
}
