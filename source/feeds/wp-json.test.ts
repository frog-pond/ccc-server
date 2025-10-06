import {test, expect} from 'vitest'
import {
	convertWpJsonItemToStory,
	WpJsonFeedEntrySchema,
	type WpJsonFeedEntryType,
} from './wp-json.js'

test('WpJsonFeedEntrySchema should parse items with missing featuredmedia fields', () => {
	const itemWithMissingFields = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': [
				{
					id: 123,
					// missing media_type, media_details, and source_url
				},
			],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	expect(() => WpJsonFeedEntrySchema.parse(itemWithMissingFields)).not.toThrow()
})

test('WpJsonFeedEntrySchema should parse items with complete featuredmedia fields', () => {
	const itemWithCompleteFields = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': [
				{
					id: 123,
					media_type: 'image',
					media_details: {
						sizes: {
							medium_large: {
								source_url: 'https://example.com/image-medium.jpg',
							},
						},
					},
					source_url: 'https://example.com/image.jpg',
				},
			],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	expect(() => WpJsonFeedEntrySchema.parse(itemWithCompleteFields)).not.toThrow()
})

test('WpJsonFeedEntrySchema should parse items with null wp:featuredmedia', () => {
	const itemWithNullFeaturedMedia = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': null,
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	expect(() => WpJsonFeedEntrySchema.parse(itemWithNullFeaturedMedia)).not.toThrow()
})

test('convertWpJsonItemToStory should handle missing featuredmedia fields', () => {
	const itemWithMissingFields: WpJsonFeedEntryType = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': [
				{
					id: 123,
					// missing media_type, media_details, and source_url
				},
			],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	// Should not throw and featuredImage should be null when fields are missing
	const result = convertWpJsonItemToStory(itemWithMissingFields)
	expect(result.featuredImage).toBe(null)
})

test('convertWpJsonItemToStory should handle complete featuredmedia fields', () => {
	const itemWithCompleteFields: WpJsonFeedEntryType = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': [
				{
					id: 123,
					media_type: 'image',
					media_details: {
						sizes: {
							medium_large: {
								source_url: 'https://example.com/image-medium.jpg',
							},
						},
					},
					source_url: 'https://example.com/image.jpg',
				},
			],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	const result = convertWpJsonItemToStory(itemWithCompleteFields)
	expect(result.featuredImage).toBe('https://example.com/image-medium.jpg')
})

test('convertWpJsonItemToStory should handle null wp:featuredmedia', () => {
	const itemWithNullFeaturedMedia: WpJsonFeedEntryType = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': null,
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	const result = convertWpJsonItemToStory(itemWithNullFeaturedMedia)
	expect(result.featuredImage).toBe(null)
})

test('WpJsonFeedEntrySchema parsing should work with real-world incomplete data', () => {
	// This simulates what WordPress might return when a featured media
	// entry exists but has incomplete information
	const incompleteData = {
		_embedded: {
			author: [{id: 1, name: 'Test Author'}],
			'wp:featuredmedia': [
				{
					id: 123,
					// All other fields missing
				},
			],
			'wp:term': [[{taxonomy: 'category', name: 'News'}]],
		},
		author: 1,
		featured_media: 123,
		content: {rendered: '<p>Test content</p>'},
		excerpt: {rendered: '<p>Test excerpt</p>'},
		title: {rendered: 'Test Title'},
		date_gmt: '2024-01-01T12:00:00',
		link: 'https://example.com/post',
	}

	// Should parse without error
	const parsed = WpJsonFeedEntrySchema.parse(incompleteData)
	expect(parsed).toBeDefined()

	// Convert should also work and return null for featuredImage
	const converted = convertWpJsonItemToStory(parsed)
	expect(converted.featuredImage).toBe(null)
})
