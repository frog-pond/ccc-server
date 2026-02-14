import {test} from 'node:test'
import {cleanOrg} from './presence.ts'

/**
 * Tests for the student-orgs presence module
 *
 * These tests verify that the cleanOrg function correctly handles missing description fields
 * from the Presence.io API responses.
 *
 * Background: Some organizations from the API don't have a description field, which causes
 * a ZodError when the DetailedPresenceOrgSchema tries to parse them. The fix makes description
 * optional and provides a default empty string.
 */

void test('cleanOrg should handle org with description', (t) => {
	const sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	const orgWithDescription = {
		subdomain: 'stolaf',
		campusName: 'St. Olaf College',
		name: 'Test Organization',
		uri: '/test-org',
		hasCoverImage: false,
		photoUri: '/photo.jpg',
		photoUriWithVersion: '/photo.jpg?v=1',
		photoType: 'default' as const,
		memberCount: 10,
		categories: ['Academic', 'Service'],
		description: '<p>This is a test organization</p>',
		website: 'https://example.com',
	}

	const result = cleanOrg(orgWithDescription, sortableRegex)

	t.assert.equal(result.name, 'Test Organization')
	t.assert.equal(result.description, 'This is a test organization')
	t.assert.equal(result.category, 'Academic, Service')
	t.assert.equal(result.website, 'https://example.com')
})

void test('cleanOrg should handle org with missing description', (t) => {
	const sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	const orgWithoutDescription = {
		subdomain: 'stolaf',
		campusName: 'St. Olaf College',
		name: 'Test Organization Without Description',
		uri: '/test-org-2',
		hasCoverImage: false,
		photoUri: '/photo.jpg',
		photoUriWithVersion: '/photo.jpg?v=1',
		photoType: 'default' as const,
		memberCount: 5,
		categories: ['Social'],
		description: undefined,
		website: null,
	}

	const result = cleanOrg(orgWithoutDescription, sortableRegex)

	t.assert.equal(result.name, 'Test Organization Without Description')
	t.assert.equal(result.description, '')
	t.assert.equal(result.category, 'Social')
	t.assert.equal(result.website, '')
})

void test('cleanOrg should handle org with empty description string', (t) => {
	const sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	const orgWithEmptyDescription = {
		subdomain: 'stolaf',
		campusName: 'St. Olaf College',
		name: 'Another Test Org',
		uri: '/test-org-3',
		hasCoverImage: false,
		photoUri: '/photo.jpg',
		photoUriWithVersion: '/photo.jpg?v=1',
		photoType: 'default' as const,
		memberCount: 15,
		categories: ['Academic'],
		description: '',
		website: 'example.com',
	}

	const result = cleanOrg(orgWithEmptyDescription, sortableRegex)

	t.assert.equal(result.name, 'Another Test Org')
	t.assert.equal(result.description, '')
	t.assert.equal(result.website, 'http://example.com')
})
