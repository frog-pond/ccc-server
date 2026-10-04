import {JSDOM} from 'jsdom'
import {z} from 'zod'
import {AdvisorSchema, ContactPersonSchema} from './types.ts'
import type {AdvisorType, ContactPersonType} from './types.ts'

/// An org's portal view is the whole form its officers fill in, around 1.5 MB:
/// every field's settings, and among them a few values. Some of those values
/// are not for the public -- an Oracle fund number, the officers' answers to
/// the student activities office's year-end survey -- so only these fields,
/// by label, are ever read.
const FIELDS = {
	contactName: 'Primary Organization Contact',
	contactEmail: 'Primary Organization Contact Email',
	advisorName: 'Advisor Name',
	advisorEmail: 'Advisor Email',
	instagram: 'Instagram Handle',
	constitution: 'Organization Constitution Link',
	officeHours: 'Office Hours',
	officeLocation: 'Office Location',
	additionalInformation: 'Additional Information',
} as const

type Field = keyof typeof FIELDS

const PortalFieldSchema = z.object({label: z.string(), value: z.unknown()})

/// Fields sit in groups' `items`, or stand alone as a group of one.
const PortalViewSchema = z.object({
	fieldData: z.array(z.looseObject({items: z.array(z.unknown()).optional()})),
})

/// The allowlisted fields' text values, by our name for each. A field left
/// blank, or missing from an org's form, reads as ''.
export function portalFields(body: unknown): Record<Field, string> {
	let values = new Map<string, string>()
	for (let group of PortalViewSchema.parse(body).fieldData) {
		for (let raw of group.items ?? [group]) {
			let field = PortalFieldSchema.safeParse(raw)
			if (field.success && typeof field.data.value === 'string') {
				values.set(field.data.label, field.data.value.trim())
			}
		}
	}

	let fields = {} as Record<Field, string>
	for (let [key, label] of Object.entries(FIELDS) as [Field, string][]) {
		fields[key] = values.get(label) ?? ''
	}
	return fields
}

const EMAIL = /[^\s@,;&<>()]+@[^\s@,;&<>()]+\.[a-z]{2,}/giu

/// Officers write several people into one field: "A & B", "A or B", "A, B".
const SEPARATOR = /\s*(?:&|,|;|\/|\bor\b|\band\b)\s*/iu

/// The people a pair of free-text name and email fields names. Names and
/// emails are paired up when there are as many of each. Otherwise each email
/// stands alone -- under every name at once when there is just one, as when
/// two officers share the org's address. A name with no email is left out:
/// the app keys and writes to each contact by address.
function people(names: string, emails: string): {name: string; email: string}[] {
	let addresses = [...new Set((emails.match(EMAIL) ?? []).map((e) => e.toLowerCase()))]
	let named = names.split(SEPARATOR).filter(Boolean)

	if (named.length === addresses.length) {
		return addresses.map((email, i) => ({name: named[i] ?? '', email}))
	}
	if (addresses.length === 1) {
		return addresses.map((email) => ({name: names, email}))
	}
	return addresses.map((email) => ({name: '', email}))
}

export function contactsOf(fields: Record<Field, string>): ContactPersonType[] {
	return people(fields.contactName, fields.contactEmail).flatMap(({name, email}) => {
		let [firstName = '', ...rest] = name.split(/\s+/u)
		let contact = ContactPersonSchema.safeParse({
			firstName,
			lastName: rest.join(' '),
			title: 'Primary Contact',
			email,
		})
		return contact.success ? [contact.data] : []
	})
}

export function advisorsOf(fields: Record<Field, string>): AdvisorType[] {
	return people(fields.advisorName, fields.advisorEmail).flatMap((person) => {
		let advisor = AdvisorSchema.safeParse(person)
		return advisor.success ? [advisor.data] : []
	})
}

/// "@stolafchess", "stolafchess", or several in one field, as profile URLs.
export function instagramLinks(handles: string): string[] {
	return handles
		.split(/[\s,;&]+/u)
		.map((handle) => handle.replace(/^@/u, ''))
		.filter((handle) => /^[\w.]+$/u.test(handle))
		.map((handle) => `https://www.instagram.com/${handle}/`)
}

export function urlOrBlank(text: string): string {
	return URL.canParse(text) && /^https?:/u.test(text) ? text : ''
}

export const plainText = (html: string): string => JSDOM.fragment(html).textContent.trim()
