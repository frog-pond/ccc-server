import {get} from '../ccc-lib/http.js'
import lodash from 'lodash'
import {JSDOM} from 'jsdom'
import pMap from 'p-map'
const {sortBy, startCase} = lodash

/*
type ContactPersonType = {
	lastName: string,
	title: string,
	firstName: string,
	email: string,
}

type AdvisorType = {
	email: string,
	name: string,
}

type StudentOrgType = {
	meetings: string,
	contacts: ContactPersonType[],
	advisors: AdvisorType[],
	description: string,
	category: string,
	lastUpdated: string,
	website: string,
	name: string,
}
*/

export function cleanOrg(org) {
	// console.log(org)

	let name = org.name.trim()

	// let contacts = org.contacts.map(c =>
	// 	Object.assign({}, c, {
	// 		title: c.title.trim(),
	// 		firstName: c.firstName.trim(),
	// 		lastName: c.lastName.trim(),
	// 	}),
	// )

	let category = org.categories.join(', ')
	let meetings =
		(org.regularMeetingLocation || '').trim() +
		(org.regularMeetingTime || '').trim()
	let description = JSDOM.fragment(org.description).textContent.trim()
	let website = (org.website || '').trim()
	if (website && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	return {
		advisors: [],
		category,
		contacts: [],
		description,
		lastUpdated: '2000-01-01',
		meetings,
		name,
		website,
	}
}

const fetchOrg = (base) => (org) => get(`${base}/${org.uri}`).json()

export async function presence(school) {
	let orgsUrl = `https://api.presence.io/${school}/v1/organizations`
	let body = await get(orgsUrl).json()

	let orgs = await pMap(body, fetchOrg(orgsUrl), {concurrency: 8})

	let cleaned = orgs.map(cleanOrg)

	let sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i
	let withSortableNames = cleaned.map((item) => {
		let sortableName = item.name.replace(sortableRegex, '').toLowerCase()

		return {
			...item,
			$sortableName: sortableName,
			$groupableName: startCase(sortableName)[0].toUpperCase(),
		}
	})

	return sortBy(withSortableNames, '$sortableName')
}