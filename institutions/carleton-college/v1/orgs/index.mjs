import got from 'got'
import mem from 'mem'
import _jsdom from 'jsdom'
import lodash from 'lodash'
import querystring from 'querystring'
const {groupBy, sortBy, toPairs, startCase} = lodash
const {JSDOM} = _jsdom

const GET_BASE = (url, opts) =>
	got.get(
		url,
		Object.assign(
			{
				headers: {
					'User-Agent':
						'ccc-server/1 (https://github.com/frog-pond/ccc-server)',
				},
			},
			opts,
		),
	)

const ONE_HOUR = 60 * 60 * 1000
const GET_6_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR * 6})

function domToOrg(orgNode) {
	let name = orgNode.querySelector('h4').textContent.replace(/ Manage$/, '').trim()

	const ids = [...orgNode.querySelectorAll('a[name]')].map(n => n.getAttribute('name'))
	const id = ids.length ? ids[0] : name

	const description = orgNode.querySelector('.orgDescription').textContent.trim()

	let contacts = orgNode.querySelector('.contacts')
	contacts = contacts ? contacts.textContent.trim() : ''
	contacts = contacts.replace(/^Contact: /, '')
	contacts = contacts ? contacts.split(', ') : []

	const websiteEls = [...orgNode.querySelectorAll('.site a')].map(n => n.getAttribute('href'))
	let website = websiteEls.length ? websiteEls[0] : ''
	if (website.length && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	const socialLinks = [...orgNode.querySelectorAll('img > a')].map(n => n.parentNode).map(n => n.getAttribute('href'))

	return {
		id,
		contacts,
		description,
		name,
		website,
		categories: [],
		socialLinks,
	}
}

let orgsUrl = 'https://apps.carleton.edu/student/orgs/'

async function fetchOrgs() {
	let resp = await GET_6_HOUR(orgsUrl)
	let dom = new JSDOM(resp.body)

	const allOrgWrappers = dom.window.document.querySelectorAll('.orgContainer, .careerField')
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
	const withSortableNames = Array.from(allOrgs.values()).map(item => {
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

const GET_ORGS = mem(fetchOrgs, {maxAge: ONE_HOUR})

export async function orgs(ctx) {
	ctx.body = await GET_ORGS()
}
