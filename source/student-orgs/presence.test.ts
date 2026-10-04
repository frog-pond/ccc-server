import {test} from 'node:test'
import {cleanOrg, groupCategories, withoutDemoCategory, withoutDemoOrgs} from './presence.ts'
import {SortableStudentOrgSchema, OrgCategorySchema} from './types.ts'

const RAW_ORG = {
	subdomain: 'stolaf',
	campusName: 'St. Olaf College',
	name: 'Agape',
	uri: 'agape',
	regularMeetingTime: '7pm-8pm',
	regularMeetingLocation: 'Norway Room',
	hasCoverImage: true,
	photoUri: '255690e5-0f34-45cd-92ab-1b18d6c21cbe.png',
	photoUriWithVersion: '255690e5-0f34-45cd-92ab-1b18d6c21cbe.png?v=0',
	photoType: 'upload' as const,
	memberCount: 12,
	categories: ['Religious'],
	description: '<p>Fosters fellowship.</p>',
	website: 'agape.stolaf.edu',
}

const sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

void test('cleanOrg carries the org’s Presence slug as organizationUri', (t) => {
	let org = cleanOrg(RAW_ORG, sortableRegex)

	t.assert.equal(org.organizationUri, 'agape')
})

void test('cleanOrg separates the meeting location from the meeting time', (t) => {
	let org = cleanOrg(RAW_ORG, sortableRegex)

	t.assert.equal(org.meetings, 'Norway Room, 7pm-8pm')
})

void test('cleanOrg lists a lone meeting time without a separator', (t) => {
	let org = cleanOrg({...RAW_ORG, regularMeetingLocation: undefined}, sortableRegex)

	t.assert.equal(org.meetings, '7pm-8pm')
})

void test('cleanOrg carries the member count', (t) => {
	let org = cleanOrg(RAW_ORG, sortableRegex)

	t.assert.equal(org.memberCount, 12)
})

/// The StoOrgs shape has to keep working for consumers that don't know about
/// the new fields yet.
void test('cleanOrg still returns the StoOrgs-shaped fields untouched', (t) => {
	let org = cleanOrg(RAW_ORG, sortableRegex)

	t.assert.deepEqual(org.advisors, [])
	t.assert.deepEqual(org.contacts, [])
	t.assert.equal(org.lastUpdated, '2000-01-01')
})

void test('cleanOrg output still parses as SortableStudentOrgSchema', (t) => {
	let org = cleanOrg(RAW_ORG, sortableRegex)

	t.assert.doesNotThrow(() => SortableStudentOrgSchema.parse(org))
})

const MEMBERSHIPS = [
	{catIdh: 'PBnP', name: 'Departments', organizationUri: 'academic-success-center'},
	{catIdh: 'PBnP', name: 'Departments', organizationUri: 'admissions'},
	{catIdh: '9j0V', name: 'Performance', organizationUri: 'agnes-a-cappella'},
]

void test('groupCategories collapses memberships into one row per category', (t) => {
	let categories = groupCategories(MEMBERSHIPS)

	t.assert.equal(categories.length, 2)
})

void test('groupCategories collects every org uri under its category', (t) => {
	let categories = groupCategories(MEMBERSHIPS)
	let departments = categories.find((c) => c.catIdh === 'PBnP')

	t.assert.deepEqual(departments?.organizationUris, ['academic-success-center', 'admissions'])
})

void test('groupCategories keeps the category name', (t) => {
	let categories = groupCategories(MEMBERSHIPS)
	let performance = categories.find((c) => c.catIdh === '9j0V')

	t.assert.equal(performance?.name, 'Performance')
})

void test('groupCategories output parses as OrgCategorySchema', (t) => {
	let categories = groupCategories(MEMBERSHIPS)

	for (let category of categories) {
		t.assert.doesNotThrow(() => OrgCategorySchema.parse(category))
	}
})

void test('groupCategories sorts categories by name', (t) => {
	let categories = groupCategories(MEMBERSHIPS)

	t.assert.deepEqual(
		categories.map((c) => c.name),
		['Departments', 'Performance'],
	)
})

void test('withoutDemoOrgs removes orgs in the Demo category', (t) => {
	let orgs = [
		{...cleanOrg(RAW_ORG, sortableRegex), category: 'Religious'},
		{...cleanOrg(RAW_ORG, sortableRegex), name: 'Balloon Animals Club', category: 'Demo'},
	]

	t.assert.deepEqual(
		withoutDemoOrgs(orgs).map((org) => org.name),
		['Agape'],
	)
})

void test('withoutDemoCategory removes Demo and its orgs from other categories', (t) => {
	let categories = [
		{catIdh: 'demo', name: 'Demo', organizationUris: ['balloon-animals']},
		{catIdh: 'clubs', name: 'Clubs', organizationUris: ['balloon-animals', 'chess']},
	]

	t.assert.deepEqual(withoutDemoCategory(categories), [
		{catIdh: 'clubs', name: 'Clubs', organizationUris: ['chess']},
	])
})
