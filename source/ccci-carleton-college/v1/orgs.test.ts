import {test} from 'node:test'
import {SortableCarletonStudentOrgSchema} from './orgs.ts'

/// `domToOrg` assigns '' for an org with no website and no admin link, which
/// most orgs are. The schema demanded a URL for both, so parsing such an org
/// threw — and since `getOrgs` parses inside an unguarded loop, one of them
/// took down the whole list.

const ORG = {
	id: 'chess',
	name: 'Chess Club',
	description: 'Plays chess.',
	contacts: [],
	categories: [],
	socialLinks: [],
	adminLink: 'https://apps.carleton.edu/student/orgs/?manage=chess',
	website: 'https://example.com/chess',
	$sortableName: 'Chess Club',
	$groupableName: 'C',
}

void test('an org keeps its website and admin link when it has them', (t) => {
	let org = SortableCarletonStudentOrgSchema.parse(ORG)

	t.assert.equal(org.website, 'https://example.com/chess')
	t.assert.equal(org.adminLink, 'https://apps.carleton.edu/student/orgs/?manage=chess')
})

void test('an org with no website still parses', (t) => {
	let org = SortableCarletonStudentOrgSchema.parse({...ORG, website: ''})

	t.assert.equal(org.website, '')
})

void test('an org with no admin link still parses', (t) => {
	let org = SortableCarletonStudentOrgSchema.parse({...ORG, adminLink: ''})

	t.assert.equal(org.adminLink, '')
})

void test('a website that is neither empty nor a URL is still rejected', (t) => {
	t.assert.throws(() => SortableCarletonStudentOrgSchema.parse({...ORG, website: 'not a url'}))
})
