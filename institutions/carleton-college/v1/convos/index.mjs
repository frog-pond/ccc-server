import got from 'got'
import mem from 'mem'
import _jsdom from 'jsdom'
import moment from 'moment'
import htmlEntities from 'html-entities'
const {JSDOM} = _jsdom
const entities = new htmlEntities.AllHtmlEntities()

const GET_BASE = (url, opts) =>
	got.get(
		url,
		Object.assign(
			{
				headers: {
					'User-Agent':
						'ccc-server/1 (https://github.com/frog-pond/ccc-server)',
				},
			},
			opts,
		),
	)

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = ONE_HOUR * 24

const archiveBase =
	'https://apps.carleton.edu/events/convocations/feeds/media_files?page_id=342645'

function processConvo(event) {
	let enclosure = event.querySelector('enclosure')
	return {
		title: entities.decode(event.querySelector('title').textContent),
		description: event.querySelector('description')
			? entities.decode(event.querySelector('description').textContent)
			: '',
		pubDate: moment(event.querySelector('pubDate').textContent),
		enclosure: enclosure
			? {
					type: enclosure.getAttribute('type')
						? enclosure.getAttribute('type')
						: '',
					url: enclosure.getAttribute('url')
						? enclosure.getAttribute('url')
						: '',
					length: enclosure.getAttribute('length')
						? enclosure.getAttribute('length')
						: '',
			  }
			: null,
	}
}

async function getArchived() {
	let resp = await GET_BASE(archiveBase)
	let dom = new JSDOM(resp.body, {contentType: 'text/xml'})
	let convos = [
		...dom.window.document.querySelectorAll('rss channel item'),
	].map(processConvo)
	convos = convos.slice(0, 100)
	return Promise.all(convos)
}

const GET_ARCHIVED = mem(getArchived, {maxAge: ONE_DAY})

export async function archived(ctx) {
	ctx.body = await GET_ARCHIVED()
}
