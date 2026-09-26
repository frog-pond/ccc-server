import {test} from 'node:test'
import {parseUpcomingConvo} from './convos.ts'

const PAGE_URL = 'https://www.carleton.edu/convocations/calendar/?eId=7'

void test('parseUpcomingConvo reads the description, images, and sponsor', (t) => {
	let html = `<html><body><div class="campus-calendar--event">
<div class="event_description"><p>A <a href="/talk">talk</a></p></div>
<div class="single_event_image"><a href="/img/speaker.jpg">img</a></div>
<div class="sponsorContactInfo"><p>Sponsor</p></div>
</div></body></html>`

	let convo = parseUpcomingConvo(html, PAGE_URL)
	t.assert.equal(convo.content, 'A [talk](https://www.carleton.edu/talk)')
	t.assert.deepEqual(convo.images, ['https://www.carleton.edu/img/speaker.jpg'])
	t.assert.equal(convo.sponsor, 'Sponsor')
})

void test('parseUpcomingConvo throws, naming the page, when the event is missing', (t) => {
	t.assert.throws(
		() => parseUpcomingConvo('<html><body></body></html>', PAGE_URL),
		/campus-calendar--event.*eId=7/,
	)
})
