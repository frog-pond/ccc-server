import {test} from 'node:test'
import {groupableName, sortOrgs, sortableName} from './names.ts'

const sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

void test('a sortable name drops leading punctuation, so the org files under its first letter', (t) => {
	t.assert.equal(sortableName('¡Presente!', sortableRegex), 'presente!')
})

void test('a sortable name folds accents, so an accented initial keeps its letter', (t) => {
	t.assert.equal(sortableName('Étude Club', sortableRegex), 'etude club')
})

void test('a sortable name drops a leading article', (t) => {
	t.assert.equal(sortableName('The Cave', sortableRegex), 'cave')
})

void test('a groupable name is the upper-case first letter', (t) => {
	t.assert.equal(groupableName('presente!'), 'P')
})

void test('a name starting with a digit groups under a number sign', (t) => {
	t.assert.equal(groupableName('3m club'), '#')
})

void test('a name left empty by stripping groups under a number sign', (t) => {
	t.assert.equal(groupableName(''), '#')
})

void test('the number sign group sorts after the letters, as it does on iOS', (t) => {
	let orgs = [
		{$groupableName: '#', $sortableName: '3m club'},
		{$groupableName: 'A', $sortableName: 'agape'},
		{$groupableName: 'Z', $sortableName: 'zumba'},
	]

	t.assert.deepEqual(
		sortOrgs(orgs).map((org) => org.$sortableName),
		['agape', 'zumba', '3m club'],
	)
})
