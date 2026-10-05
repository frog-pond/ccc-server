import {test} from 'node:test'
import {convertJobPost} from './jobs.ts'
import {retiredNnb} from './deprecated.ts'
import {RETIRED_TITLE} from '../../ccc-lib/deprecated.ts'

const post = (content: string, categories: string[] = []) => ({
	id: 4060,
	date_gmt: '2026-10-01T19:43:50',
	link: 'https://www.carleton.edu/student-employment/post-jobs/news/peer-research-consultant/',
	title: {rendered: 'Peer &amp; Research Consultant'},
	content: {rendered: content},
	_embedded: {'wp:term': [categories.map((name) => ({taxonomy: 'category', name}))]},
})

void test('convertJobPost reads the labelled block', (t) => {
	let job = convertJobPost(
		post(
			'<p><strong>Department or Office:</strong> Gould Library<br />\n<strong>Date Open:</strong> 01/04/2027<br />\n<strong>Position available:</strong> Available during Term<br />\n<strong>Description:</strong> Help patrons.</p>\n<p><strong>How to Apply:</strong> <a href="https://forms.gle/abc">Form</a></p>',
			['Available during Term'],
		),
	)
	t.assert.equal(job.id, '4060')
	t.assert.equal(job.title, 'Peer & Research Consultant')
	t.assert.equal(job.department, 'Gould Library')
	t.assert.equal(job.dateOpen, '01/04/2027')
	t.assert.equal(job.duringTerm, true)
	t.assert.equal(job.duringBreak, false)
	t.assert.equal(job.offCampus, false)
	t.assert.match(job.description, /^Help patrons\./)
	t.assert.deepEqual(job.links, [post('').link, 'https://forms.gle/abc'])
})

void test('convertJobPost handles free-form community work-study postings', (t) => {
	let job = convertJobPost(
		post('<p><strong>Job title:</strong> Tutor</p><p>Duties: tutoring</p>', [
			'Available during Term and Break',
			'CBWS Postings',
		]),
	)
	t.assert.equal(job.offCampus, true)
	t.assert.equal(job.duringTerm, true)
	t.assert.equal(job.duringBreak, true)
	t.assert.equal(job.department, '')
	t.assert.equal(job.dateOpen, '10/01/2026')
	t.assert.match(job.description, /Duties: tutoring/)
})

void test('retiredNnb says the bulletin is gone, not temporarily down', (t) => {
	let [item] = retiredNnb()
	t.assert.equal(item?.title, RETIRED_TITLE)
})
