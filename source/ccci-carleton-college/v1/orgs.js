import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {JSDOM} from 'jsdom'
import lodash from 'lodash'
const {sortBy, startCase} = lodash

function domToOrg(orgNode) {
	let name = orgNode
		.querySelector('h4')
		.textContent.replace(/ Manage$/, '')
		.trim()

	let adminLink = orgNode.querySelector('h4 > a').href
	adminLink = `https://apps.carleton.edu${adminLink}`

	const ids = [...orgNode.querySelectorAll('a[name]')].map((n) =>
		n.getAttribute('name'),
	)
	const id = ids.length ? ids[0] : name

	const description = orgNode
		.querySelector('.orgDescription')
		.textContent.trim()

	let contacts = orgNode.querySelector('.contacts')
	contacts = contacts ? contacts.textContent.trim() : ''
	contacts = contacts.replace(/^Contact: /, '')
	contacts = contacts ? contacts.split(', ') : []
	contacts = [...new Set(contacts)]

	const websiteEls = [...orgNode.querySelectorAll('.site a')].map((n) =>
		n.getAttribute('href'),
	)
	let website = websiteEls.length ? websiteEls[0] : ''
	if (website.length && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	const socialLinks = [...orgNode.querySelectorAll('a > img')]
		.map((n) => n.parentNode)
		.map((n) => n.getAttribute('href'))

	return {
		id,
		contacts,
		description,
		name,
		website,
		categories: [],
		socialLinks,
		adminLink,
	}
}

async function _getOrgs() {
	let orgsUrl = 'https://apps.carleton.edu/student/orgs/'
	let body = await get(orgsUrl).text()
	let dom = new JSDOM(body)

	const allOrgWrappers = dom.window.document.querySelectorAll(
		'.orgContainer, .careerField',
	)
	const allOrgs = new Map()

	let currentCategory = null
	for (const orgNode of allOrgWrappers) {
		if (orgNode.classList.contains('careerField')) {
			currentCategory = orgNode.textContent.trim()
			continue
		}

		const org = domToOrg(orgNode)
		if (!allOrgs.has(org.id)) {
			allOrgs.set(org.id, org)
		}

		const stored = allOrgs.get(org.id)
		if (!stored || !currentCategory) {
			continue
		}
		if (!stored.categories.includes(currentCategory)) {
			stored.categories.push(currentCategory)
		}
	}

	const sortableRegex = /^(Carleton( College)?|The) +/i
	const withSortableNames = Array.from(allOrgs.values()).map((item) => {
		const sortableName = item.name.replace(sortableRegex, '')

		return {
			...item,
			$sortableName: sortableName,
			$groupableName: startCase(sortableName)[0],
		}
	})

	const sorted = sortBy(withSortableNames, '$sortableName')
	return sorted
}

export const getOrgs = mem(_getOrgs, {maxAge: ONE_HOUR * 6})

export async function orgs(ctx) {
	ctx.cacheControl(ONE_HOUR * 6)

	ctx.body = await getOrgs()
}