import {test} from 'node:test'
import {jobIdFromLink, parseJobPage} from './jobs.ts'

const PAGE_URL = new URL('https://apps.carleton.edu/campus/sfs/employment/?job_id=42')

const PAGE = `<html><body><div id="jobs">
<h3>Off Campus: Barista</h3>
<ul>
<li><strong>Department or Office:</strong> Dining</li>
<li><strong>Date Open:</strong> September 1, 2026</li>
<li><strong>Position available during term:</strong></li>
<li><strong>Description:</strong><p>Make coffee. See https://example.com/apply</p></li>
</ul>
</div></body></html>`

void test('jobIdFromLink reads job_id', (t) => {
	t.assert.equal(jobIdFromLink(PAGE_URL), '42')
})

void test('jobIdFromLink throws when the link has no job_id', (t) => {
	t.assert.throws(
		() => jobIdFromLink(new URL('https://apps.carleton.edu/campus/sfs/employment/')),
		/job_id/,
	)
})

void test('parseJobPage reads the job fields', (t) => {
	let job = parseJobPage(PAGE, '42', PAGE_URL)
	t.assert.equal(job.id, '42')
	t.assert.equal(job.title, 'Barista')
	t.assert.equal(job.offCampus, true)
	t.assert.equal(job.department, 'Dining')
	t.assert.equal(job.dateOpen, 'September 1, 2026')
	t.assert.equal(job.duringTerm, true)
	t.assert.equal(job.duringBreak, false)
	t.assert.deepEqual(job.links, ['https://example.com/apply'])
})

void test('parseJobPage throws, naming the page, when #jobs is missing', (t) => {
	t.assert.throws(
		() => parseJobPage('<html><body></body></html>', '42', PAGE_URL),
		/#jobs.*job_id=42/,
	)
})

void test('parseJobPage throws, naming the page, when the title is missing', (t) => {
	t.assert.throws(
		() => parseJobPage('<html><body><div id="jobs"></div></body></html>', '42', PAGE_URL),
		/h3.*job_id=42/,
	)
})
