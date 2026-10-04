import {test} from 'node:test'
import {convertWpJsonItemToStory, fetchWpJson, WpJsonFeedEntrySchema} from './wp-json.ts'

/// A post as WordPress's REST API embeds it, with `media` as its one
/// featured-media entry.
function post(media: unknown, overrides: Record<string, unknown> = {}) {
	return {
		_embedded: {
			author: [{id: 1, name: 'Ole Olson'}],
			'wp:featuredmedia': [media],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Body</p>'},
		excerpt: {rendered: '<p>Teaser</p>'},
		title: {rendered: 'Headline'},
		date_gmt: '2026-10-04T12:00:00',
		link: 'https://example.com/post',
		...overrides,
	}
}

const IMAGE = {
	id: 123,
	media_type: 'image',
	media_details: {
		sizes: {medium_large: {source_url: 'https://example.com/image-768.jpg'}},
	},
	source_url: 'https://example.com/image.jpg',
}

/// What WordPress embeds in place of an image it cannot show: a deleted or
/// private attachment.
const UNAVAILABLE = {
	code: 'rest_forbidden',
	message: 'Sorry, you are not allowed to do that.',
	data: {status: 401},
}

const story = (media: unknown) => convertWpJsonItemToStory(WpJsonFeedEntrySchema.parse(post(media)))

void test('a post uses its medium_large image', (t) => {
	t.assert.equal(story(IMAGE).featuredImage, 'https://example.com/image-768.jpg')
})

void test('a post without a medium_large size uses the full image', (t) => {
	t.assert.equal(
		story({...IMAGE, media_details: {}}).featuredImage,
		'https://example.com/image.jpg',
	)
})

void test('a post whose image WordPress will not show has no featured image', (t) => {
	let result = story(UNAVAILABLE)
	t.assert.equal(result.featuredImage, null)
	t.assert.equal(result.title, 'Headline')
})

void test('a post whose media entry lacks its fields has no featured image', (t) => {
	t.assert.equal(story({id: 123}).featuredImage, null)
})

void test('one post with an unavailable image does not fail the feed', async (t) => {
	let feed = [post(IMAGE), post(UNAVAILABLE, {link: 'https://example.com/other'})]
	let url = `data:application/json,${encodeURIComponent(JSON.stringify(feed))}`

	let stories = await fetchWpJson(url)

	t.assert.deepEqual(
		stories.map((s) => s.featuredImage),
		['https://example.com/image-768.jpg', null],
	)
})
