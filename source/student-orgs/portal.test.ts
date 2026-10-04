import {test} from 'node:test'
import {
	advisorsOf,
	contactsOf,
	instagramLinks,
	plainText,
	portalFields,
	urlOrBlank,
} from './portal.ts'

/// A portal view cut down to the shape that matters: fields grouped under
/// `items`, a field standing alone as its own group, and the private fields
/// the reader must never pass on.
const PORTAL = {
	id: '084c6e75',
	fieldData: [
		{
			items: [
				{label: 'Organization Name', value: '¡Presente!'},
				{label: 'Oracle Fund Number', value: '91683'},
				{label: 'Meeting Time', value: ''},
			],
		},
		{label: 'Cover Image', value: 'https://stolaf-cdn.presence.io/cover.png'},
		{
			items: [
				{label: 'Primary Organization Contact', value: 'Fatima Mena-Salcedo & Diana Gutierrez'},
				{
					label: 'Primary Organization Contact Email',
					value: 'menasa1@stolaf.edu & gutier13@stolaf.edu',
				},
				{label: 'Advisor Name', value: 'Wendy Gonzalez'},
				{label: 'Advisor Email', value: 'gonzalez@stolaf.edu'},
			],
		},
		{items: [{label: 'Instagram Handle', value: '@presentestolaf'}]},
		{
			items: [
				{
					label: 'If you could do it all again, what would you do differently?',
					value: 'Better planning',
				},
				{
					label: 'Does your organization utilize space in student organization storage?',
					value: {itemValue: 'abc', name: 'Yes'},
				},
			],
		},
	],
}

void test('portalFields reads the allowlisted fields', (t) => {
	let fields = portalFields(PORTAL)
	t.assert.equal(fields.contactName, 'Fatima Mena-Salcedo & Diana Gutierrez')
	t.assert.equal(fields.advisorEmail, 'gonzalez@stolaf.edu')
	t.assert.equal(fields.instagram, '@presentestolaf')
})

void test('portalFields reads a field missing from the form as blank', (t) => {
	t.assert.equal(portalFields(PORTAL).officeHours, '')
})

void test('portalFields passes on nothing outside its allowlist', (t) => {
	let text = JSON.stringify(portalFields(PORTAL))
	t.assert.doesNotMatch(text, /91683/)
	t.assert.doesNotMatch(text, /Better planning/)
	t.assert.doesNotMatch(text, /cover\.png/)
})

/// The allowlisted fields, blank but for `overrides`.
function fields(overrides: Partial<ReturnType<typeof portalFields>>) {
	return {...portalFields({fieldData: []}), ...overrides}
}

void test('a lone contact', (t) => {
	t.assert.deepEqual(
		contactsOf(fields({contactName: 'Harry Schiller', contactEmail: 'schill8@stolaf.edu'})),
		[
			{
				firstName: 'Harry',
				lastName: 'Schiller',
				title: 'Primary Contact',
				email: 'schill8@stolaf.edu',
			},
		],
	)
})

void test('contacts joined by & are paired with their addresses', (t) => {
	let contacts = contactsOf(portalFields(PORTAL))
	t.assert.deepEqual(
		contacts.map((c) => [c.firstName, c.lastName, c.email]),
		[
			['Fatima', 'Mena-Salcedo', 'menasa1@stolaf.edu'],
			['Diana', 'Gutierrez', 'gutier13@stolaf.edu'],
		],
	)
})

void test('contacts joined by "or" are paired with their addresses', (t) => {
	let contacts = contactsOf(
		fields({
			contactName: 'Esther Staplin or Sydney Sjodin',
			contactEmail: 'stapli2@stolaf.edu or sjodin1@stolaf.edu',
		}),
	)
	t.assert.deepEqual(
		contacts.map((c) => c.email),
		['stapli2@stolaf.edu', 'sjodin1@stolaf.edu'],
	)
})

void test('several contacts sharing one address are one contact', (t) => {
	let contacts = contactsOf(
		fields({
			contactName: 'Garrett Fitzgerald & Kayla Gruenes',
			contactEmail: 'oleprogramming@stolaf.edu',
		}),
	)
	t.assert.equal(contacts.length, 1)
	t.assert.equal(
		`${contacts[0]?.firstName ?? ''} ${contacts[0]?.lastName ?? ''}`,
		'Garrett Fitzgerald & Kayla Gruenes',
	)
})

void test('addresses are lowercased', (t) => {
	t.assert.equal(
		contactsOf(fields({contactName: 'Kira Maeda', contactEmail: 'Maeda3@stolaf.edu'}))[0]?.email,
		'maeda3@stolaf.edu',
	)
})

void test('a contact with no address is left out', (t) => {
	t.assert.deepEqual(contactsOf(fields({contactName: 'Somebody'})), [])
})

void test('advisors are read like contacts', (t) => {
	t.assert.deepEqual(advisorsOf(portalFields(PORTAL)), [
		{name: 'Wendy Gonzalez', email: 'gonzalez@stolaf.edu'},
	])
	t.assert.deepEqual(advisorsOf(fields({})), [])
})

void test('instagram handles become profile links, with or without @', (t) => {
	t.assert.deepEqual(instagramLinks('@stolafchess'), ['https://www.instagram.com/stolafchess/'])
	t.assert.deepEqual(instagramLinks('kso.stolaf'), ['https://www.instagram.com/kso.stolaf/'])
	t.assert.deepEqual(instagramLinks('@rozelliiott, @cathal_mee'), [
		'https://www.instagram.com/rozelliiott/',
		'https://www.instagram.com/cathal_mee/',
	])
	t.assert.deepEqual(instagramLinks(''), [])
})

void test('only a web address passes as a link', (t) => {
	t.assert.equal(
		urlOrBlank('https://docs.google.com/document/d/1'),
		'https://docs.google.com/document/d/1',
	)
	t.assert.equal(urlOrBlank('see our doc'), '')
	t.assert.equal(urlOrBlank('javascript:alert(1)'), '')
})

void test('additional information is read as plain text', (t) => {
	t.assert.equal(plainText('<p>Everyone is <b>welcome</b>!</p>'), 'Everyone is welcome!')
})
