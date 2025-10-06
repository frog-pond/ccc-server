import {test, expect} from 'vitest'
import {z} from 'zod'
import {convertWpJsonItemToStory} from './wp-json.js'

// Import the schema to test it directly
type WpJsonFeedEntryType = z.infer<typeof WpJsonFeedEntrySchema>
const WpJsonFeedEntrySchema = z.object({
	_embedded: z.optional(
		z.object({
			author: z.array(z.object({id: z.unknown(), name: z.string().or(z.undefined())})).optional(),
			'wp:featuredmedia': z
				.array(
					z.object({
						id: z.unknown(),
						media_type: z.union([z.literal('image'), z.string()]).optional(),
						media_details: z.object({
							sizes: z.optional(z.record(z.object({source_url: z.string().url()}))),
						}).optional(),
						source_url: z.string().url().optional(),
					}),
				)
				.nullable()
				.optional(),
			'wp:term': z.array(z.array(z.object({taxonomy: z.string(), name: z.string()}))),
		}),
	),
	/** this is "author ID," not "author name" */
	author: z.unknown(),
	featured_media: z.number().optional(),
	content: z.object({rendered: z.string()}),
	excerpt: z.object({rendered: z.string()}),
	title: z.object({rendered: z.string()}),
	date_gmt: z.string(),
	link: z.string().url(),
})

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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
			'wp:term': [
				[{taxonomy: 'category', name: 'News'}],
			],
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
