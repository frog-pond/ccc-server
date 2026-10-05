import {test} from 'node:test'
import {parseHtml} from './dom.ts'
import {buildDetailMap} from './html.ts'

/// A Carleton job posting's details, as the jobs page lists them.
const DETAILS = `<ul>
<li><strong>Department or Office:</strong> Admissions &amp; Aid</li>
<li><strong>Date Open:</strong> Jan &amp; Feb</li>
<li><strong>Description:</strong> Greet visitors &amp; answer calls</li>
</ul>`

void test('a detail with an entity in it keeps its key and its whole value', (t) => {
	let details = parseHtml(DETAILS).querySelectorAll('li')
	let map = buildDetailMap(details, {paragraphs: ['Description']})
	t.assert.deepEqual(Object.fromEntries(map), {
		'Department or Office': 'Admissions & Aid',
		'Date Open': 'Jan & Feb',
		Description: 'Greet visitors & answer calls',
	})
})
