import {get} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {JSDOM} from 'jsdom'
import {sortBy} from 'lodash-es'
import {z} from 'zod'
import type {Context} from '../../ccc-server/context.ts'

export type CarletonStudentOrgType = z.infer<typeof CarletonStudentOrgSchema>
export const CarletonStudentOrgSchema = z.object({
	id: z.string(),
	contacts: z.string().array(),
	categories: z.string().array(),
	socialLinks: z.string().url().array(),
	adminLink: z.string().url(),
	description: z.string(),
	website: z.string().url(),
	name: z.string().min(1),
})

export type SortableCarletonStudentOrgType = z.infer<typeof SortableCarletonStudentOrgSchema>
export const SortableCarletonStudentOrgSchema = CarletonStudentOrgSchema.extend({
	/** The name, but with leading common prefixes stripped, such as "The" */
	$sortableName: z.string(),
	$groupableName: z.string(),
})

function domToOrg(orgNode: Element, sortableRegex: RegExp): SortableCarletonStudentOrgType {
	let name =
		orgNode
			.querySelector('h4')
			?.textContent?.replace(/ Manage$/, '')
			.trim() ?? ''

	let adminLink = orgNode.querySelector('h4 > a')?.getAttribute('href')
	adminLink = adminLink ? `https://apps.carleton.edu${adminLink}` : ''

	const ids = Array.from(orgNode.querySelectorAll('a[name]')).map((n) => n.getAttribute('name'))
	const id = ids[0] ?? name

	const description = orgNode.querySelector('.orgDescription')?.textContent?.trim() ?? ''

	let contacts = Array.from(
		new Set(
			orgNode
				.querySelector('.contacts')
				?.textContent?.trim()
				.replace(/^Contact: /, '')
				.split(', ') ?? [],
		),
	)

	const websiteEls = Array.from(orgNode.querySelectorAll('.site a')).flatMap((n) => {
		let href = n.getAttribute('href')
		return href ? [href] : []
	})
	let website = websiteEls[0] ?? ''
	if (website.length && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	const socialLinks = Array.from(orgNode.querySelectorAll('a > img')).flatMap((n) => {
		let href = n.parentElement?.getAttribute('href')
		return href ? [href] : []
	})

	let sortableName = name.replace(sortableRegex, '')

	let orgObj: SortableCarletonStudentOrgType = {
		id,
		contacts,
		description,
		name,
		website,
		categories: [],
		socialLinks,
		adminLink,
		$sortableName: sortableName,
		$groupableName: sortableName.at(0)?.toLocaleUpperCase() ?? '',
	}

	return SortableCarletonStudentOrgSchema.parse(orgObj)
}

async function _getOrgs(): Promise<SortableCarletonStudentOrgType[]> {
	let orgsUrl = 'https://apps.carleton.edu/student/orgs/'
	let body = await get(orgsUrl).text()
	let dom = new JSDOM(body)

	const allOrgWrappers = dom.window.document.querySelectorAll('.orgContainer, .careerField')

	const allOrgs = new Map<string, SortableCarletonStudentOrgType>()
	const sortableRegex = /^(Carleton( College)?|The) +/i
	let currentCategory = null
	for (const orgNode of allOrgWrappers) {
		if (orgNode.classList.contains('careerField')) {
			currentCategory = orgNode.textContent?.trim()
			continue
		}

		const org = domToOrg(orgNode, sortableRegex)
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

	return sortBy(Array.from(allOrgs.values()), '$sortableName')
}

export const getOrgs = mem(_getOrgs, {maxAge: ONE_HOUR * 6})

export async function orgs(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)

	ctx.body = await getOrgs()
}
