import {test, type TestContext} from 'node:test'
/* eslint-disable @typescript-eslint/no-non-null-assertion -- test files commonly index into result arrays */
import {
	parseRedditPosts,
	parseRedditComments,
	parseRedditCommentsJson,
	parseRedditPostsJson,
	buildCommentTree,
} from './reddit.ts'

const POSTS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>r/stolaf</title>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc123/test_post/</id>
    <title>Test Post Title</title>
    <author><name>/u/test_user</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;p&gt;Post content here&lt;/p&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/abc123/test_post/"/>
    <media:thumbnail url="https://example.com/thumb.jpg" width="140" height="140"/>
  </entry>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/xyz789/another_post/</id>
    <title>Another Post</title>
    <author><name>u/second_user</name></author>
    <published>2024-01-16T08:00:00+00:00</published>
    <content type="html">&lt;p&gt;Another post&lt;/p&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/xyz789/another_post/"/>
  </entry>
</feed>`

const COMMENTS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:thr="http://purl.org/syndication/thread/1.0">
  <title>Comments on: Test Post</title>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc123/test_post/</id>
    <title>Test Post Title</title>
    <author><name>/u/test_user</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;p&gt;Post body&lt;/p&gt;</content>
  </entry>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc123/test_post/c1/</id>
    <title>comment by commenter1</title>
    <author><name>/u/commenter1</name></author>
    <published>2024-01-15T13:00:00+00:00</published>
    <content type="html">&lt;p&gt;Top-level comment&lt;/p&gt;</content>
    <thr:in-reply-to
      ref="https://www.reddit.com/r/stolaf/comments/abc123/test_post/"
      href="https://www.reddit.com/r/stolaf/comments/abc123/test_post/"/>
  </entry>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc123/test_post/c2/</id>
    <title>comment by commenter2</title>
    <author><name>/u/commenter2</name></author>
    <published>2024-01-15T13:30:00+00:00</published>
    <content type="html">&lt;p&gt;Reply to c1&lt;/p&gt;</content>
    <thr:in-reply-to
      ref="https://www.reddit.com/r/stolaf/comments/abc123/test_post/c1/"
      href="https://www.reddit.com/r/stolaf/comments/abc123/test_post/c1/"/>
  </entry>
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc123/test_post/c3/</id>
    <title>comment by commenter3</title>
    <author><name>/u/commenter3</name></author>
    <published>2024-01-15T14:00:00+00:00</published>
    <content type="html">&lt;p&gt;Second top-level comment&lt;/p&gt;</content>
    <thr:in-reply-to
      ref="https://www.reddit.com/r/stolaf/comments/abc123/test_post/"
      href="https://www.reddit.com/r/stolaf/comments/abc123/test_post/"/>
  </entry>
</feed>`

void test('parseRedditPosts: parses two posts', (t) => {
	const posts = parseRedditPosts(POSTS_FIXTURE)
	t.assert.equal(posts.length, 2)
})

void test('parseRedditPosts: strips /u/ prefix from author', (t) => {
	const posts = parseRedditPosts(POSTS_FIXTURE)
	t.assert.equal(posts[0]!.author, 'test_user')
	t.assert.equal(posts[1]!.author, 'u/second_user')
})

void test('parseRedditPosts: parses thumbnail URL', (t) => {
	const posts = parseRedditPosts(POSTS_FIXTURE)
	t.assert.equal(posts[0]!.thumbnail, 'https://example.com/thumb.jpg')
	t.assert.equal(posts[1]!.thumbnail, null)
})

void test('parseRedditPosts: permalink matches link href', (t) => {
	const posts = parseRedditPosts(POSTS_FIXTURE)
	t.assert.equal(posts[0]!.permalink, 'https://www.reddit.com/r/stolaf/comments/abc123/test_post/')
})

void test('parseRedditComments: returns two top-level comments', (t) => {
	const comments = parseRedditComments(COMMENTS_FIXTURE)
	t.assert.equal(comments.length, 2)
})

void test('parseRedditComments: first comment has one reply', (t) => {
	const comments = parseRedditComments(COMMENTS_FIXTURE)
	t.assert.equal(comments[0]!.replies.length, 1)
	t.assert.equal(comments[0]!.replies[0]!.author, 'commenter2')
})

void test('parseRedditComments: second comment has no replies', (t) => {
	const comments = parseRedditComments(COMMENTS_FIXTURE)
	t.assert.equal(comments[1]!.replies.length, 0)
})

void test('buildCommentTree: empty entries returns empty array', (t) => {
	t.assert.deepEqual(buildCommentTree([]), [])
})

void test('buildCommentTree: single entry (just post) returns empty array', (t) => {
	const result = buildCommentTree([
		{id: 'post-id', author: 'op', contentHtml: '', publishedAt: '', score: 0, parentId: null},
	])
	t.assert.deepEqual(result, [])
})

void test('buildCommentTree: orphan comments become top-level', (t) => {
	const result = buildCommentTree([
		{id: 'post-id', author: 'op', contentHtml: '', publishedAt: '', score: 0, parentId: null},
		{
			id: 'orphan-id',
			author: 'orphan',
			contentHtml: '',
			publishedAt: '',
			score: 0,
			parentId: 'nonexistent-parent',
		},
	])
	t.assert.equal(result.length, 1)
	t.assert.equal(result[0]!.author, 'orphan')
})

void test('parseRedditPosts: drops entry with missing id', (t) => {
	const xmlWithMissingId = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Valid Post</title>
    <author><name>/u/valid_user</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;p&gt;content&lt;/p&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/valid/"/>
    <id>https://www.reddit.com/r/stolaf/comments/valid/</id>
  </entry>
  <entry>
    <title>No ID Post</title>
    <author><name>/u/user2</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;p&gt;content&lt;/p&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/noid/"/>
  </entry>
</feed>`
	const posts = parseRedditPosts(xmlWithMissingId)
	t.assert.equal(posts.length, 1)
	t.assert.equal(posts[0]!.author, 'valid_user')
})

void test('parseRedditPosts: strips "submitted by" footer from post contentHtml', (t: TestContext) => {
	// Real Reddit RSS encodes post body in a table; the actual body is in <div class="md">
	// and a second row contains "submitted by /u/author [link] [comments]"
	const xmlWithFooter = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/abc/footer_test/</id>
    <title>Footer Test</title>
    <author><name>/u/test_user</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;table&gt;&lt;tr&gt;&lt;td&gt;&lt;div class="md"&gt;&lt;p&gt;Real body here&lt;/p&gt;&lt;/div&gt;&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt; submitted by &lt;a href=""&gt;/u/test_user&lt;/a&gt; &lt;a href=""&gt;[link]&lt;/a&gt; &lt;a href=""&gt;[comments]&lt;/a&gt;&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/abc/footer_test/"/>
  </entry>
</feed>`
	const posts = parseRedditPosts(xmlWithFooter)
	t.assert.equal(posts.length, 1)
	t.assert.ok(
		!posts[0]!.contentHtml.includes('submitted by'),
		'contentHtml should not include "submitted by"',
	)
	t.assert.ok(!posts[0]!.contentHtml.includes('[link]'), 'contentHtml should not include "[link]"')
	t.assert.ok(
		posts[0]!.contentHtml.includes('Real body here'),
		'contentHtml should include actual body content',
	)
})

void test('parseRedditPosts: link-only post (no div.md) returns empty contentHtml', (t) => {
	// Link posts have no div.md — only a table with the submitted-by row
	const xmlLinkOnly = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://www.reddit.com/r/stolaf/comments/link1/link_post/</id>
    <title>Link Post</title>
    <author><name>/u/link_user</name></author>
    <published>2024-01-15T12:00:00+00:00</published>
    <content type="html">&lt;table&gt;&lt;tr&gt;&lt;td&gt; &lt;a href="https://example.com"&gt;[link]&lt;/a&gt;&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt; submitted by &lt;a href=""&gt;/u/link_user&lt;/a&gt; &lt;a href=""&gt;[link]&lt;/a&gt; &lt;a href=""&gt;[comments]&lt;/a&gt;&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</content>
    <link rel="alternate" href="https://www.reddit.com/r/stolaf/comments/link1/link_post/"/>
  </entry>
</feed>`
	const posts = parseRedditPosts(xmlLinkOnly)
	t.assert.equal(posts.length, 1)
	t.assert.equal(posts[0]!.contentHtml, '', 'link-only post should have empty contentHtml')
})

// ── parseRedditCommentsJson tests ──────────────────────────────────────────

// Mirrors the shape returned by https://www.reddit.com/r/stolaf/comments/<id>.json?raw_json=1
const JSON_COMMENTS_FIXTURE = [
	// [0] is post listing (ignored)
	{kind: 'Listing', data: {children: [{kind: 't3', data: {id: 'abc123', title: 'Test Post'}}]}},
	// [1] is comment listing
	{
		kind: 'Listing',
		data: {
			children: [
				{
					kind: 't1',
					data: {
						id: 'c1',
						author: 'commenter1',
						body_html: '<div class="md"><p>Top level comment</p></div>',
						created_utc: 1705318800,
						score: 42,
						replies: {
							kind: 'Listing',
							data: {
								children: [
									{
										kind: 't1',
										data: {
											id: 'c2',
											author: 'commenter2',
											body_html: '<div class="md"><p>Reply to c1</p></div>',
											created_utc: 1705320600,
											score: 7,
											replies: '',
										},
									},
									// more kind should be skipped
									{kind: 'more', data: {id: 'c3', count: 5}},
								],
							},
						},
					},
				},
				{
					kind: 't1',
					data: {
						id: 'c4',
						author: 'commenter3',
						body_html: '<div class="md"><p>Second top-level</p></div>',
						created_utc: 1705322400,
						score: 0,
						replies: '',
					},
				},
				// more at root level also skipped
				{kind: 'more', data: {id: 'c5', count: 3}},
			],
		},
	},
]

void test('parseRedditCommentsJson: returns two top-level comments', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	t.assert.equal(comments.length, 2)
})

void test('parseRedditCommentsJson: first comment has one reply', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	t.assert.equal(comments[0]!.replies.length, 1)
	t.assert.equal(comments[0]!.replies[0]!.author, 'commenter2')
})

void test('parseRedditCommentsJson: more kind entries are skipped', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	// root has 2 (not 3), reply list has 1 (not 2)
	t.assert.equal(comments.length, 2)
	t.assert.equal(comments[0]!.replies.length, 1)
})

void test('parseRedditCommentsJson: id is prefixed with t1_', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	t.assert.equal(comments[0]!.id, 't1_c1')
})

void test('parseRedditCommentsJson: created_utc converted to ISO 8601', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	t.assert.equal(comments[0]!.publishedAt, new Date(1705318800 * 1000).toISOString())
})

void test('parseRedditCommentsJson: returns empty array for invalid input', (t) => {
	t.assert.deepEqual(parseRedditCommentsJson(null), [])
	t.assert.deepEqual(parseRedditCommentsJson([]), [])
	t.assert.deepEqual(parseRedditCommentsJson([{}]), [])
})

void test('parseRedditCommentsJson: score is extracted from comment data', (t) => {
	const comments = parseRedditCommentsJson(JSON_COMMENTS_FIXTURE)
	t.assert.equal(comments[0]!.score, 42, 'top-level comment should have score 42')
	t.assert.equal(comments[0]!.replies[0]!.score, 7, 'reply should have score 7')
	t.assert.equal(comments[1]!.score, 0, 'comment with score 0 should be 0')
})

void test('parseRedditCommentsJson: null score defaults to 0 (Reddit hides scores on new/contest posts)', (t) => {
	const fixture = [
		{kind: 'Listing', data: {children: [{kind: 't3', data: {id: 'p1', title: 'Post'}}]}},
		{
			kind: 'Listing',
			data: {
				children: [
					{
						kind: 't1',
						data: {
							id: 'cn1',
							author: 'user',
							body_html: '<div class="md"><p>comment</p></div>',
							created_utc: 1705318800,
							score: null,
							replies: '',
						},
					},
				],
			},
		},
	]
	const comments = parseRedditCommentsJson(fixture)
	t.assert.equal(comments[0]!.score, 0, 'null score should default to 0')
})

// ── parseRedditPostsJson tests ─────────────────────────────────────────────

const JSON_POSTS_FIXTURE = {
	data: {
		children: [
			// Text post
			{
				kind: 't3',
				data: {
					id: 'text1',
					title: 'A simple question',
					author: 'user1',
					created_utc: 1700000000,
					permalink: '/r/stolaf/comments/text1/a_simple_question/',
					selftext_html: '<div class="md"><p>Some body text</p></div>',
					thumbnail: 'self',
					is_self: true,
					is_gallery: false,
				},
			},
			// Image post
			{
				kind: 't3',
				data: {
					id: 'img1',
					title: 'Beautiful campus photo',
					author: 'photog',
					created_utc: 1700001000,
					permalink: '/r/stolaf/comments/img1/beautiful_campus_photo/',
					selftext_html: null,
					thumbnail: 'https://preview.redd.it/thumb.jpg?width=640&format=webp',
					post_hint: 'image',
					is_self: false,
					is_gallery: false,
					url_overridden_by_dest: 'https://i.redd.it/fullres.jpg',
					domain: 'i.redd.it',
				},
			},
			// Gallery post
			{
				kind: 't3',
				data: {
					id: 'gal1',
					title: 'Club event photos',
					author: 'clubprez',
					created_utc: 1700002000,
					permalink: '/r/stolaf/comments/gal1/club_event_photos/',
					selftext_html: null,
					thumbnail: 'https://preview.redd.it/crop.jpg?width=140&height=140',
					is_self: false,
					is_gallery: true,
					url_overridden_by_dest: 'https://www.reddit.com/gallery/gal1',
					domain: 'reddit.com',
					media_metadata: {
						img001: {
							status: 'valid',
							e: 'Image',
							s: {
								u: 'https://preview.redd.it/img001.jpg?width=1728&amp;format=png&amp;auto=webp',
								x: 1728,
								y: 2304,
							},
						},
						img002: {
							status: 'valid',
							e: 'Image',
							s: {
								u: 'https://preview.redd.it/img002.jpg?width=1728&amp;format=png&amp;auto=webp',
								x: 1728,
								y: 2304,
							},
						},
					},
				},
			},
			// Link post
			{
				kind: 't3',
				data: {
					id: 'link1',
					title: 'NYT article about Carleton',
					author: 'newssharer',
					created_utc: 1700003000,
					permalink: '/r/carletoncollege/comments/link1/nyt_article/',
					selftext_html: '<div class="md"><p>Great article!</p></div>',
					thumbnail: 'https://external-preview.redd.it/nyt.jpg',
					post_hint: 'link',
					is_self: false,
					is_gallery: false,
					url_overridden_by_dest: 'https://www.nytimes.com/2026/04/17/article',
					domain: 'nytimes.com',
				},
			},
			// Crosspost
			{
				kind: 't3',
				data: {
					id: 'cross1',
					title: 'Choosing a college advice',
					author: 'sharer',
					created_utc: 1700004000,
					permalink: '/r/stolaf/comments/cross1/choosing_a_college_advice/',
					selftext_html: null,
					thumbnail: 'self',
					is_self: false,
					is_gallery: false,
					crosspost_parent: 't3_orig1',
					crosspost_parent_list: [
						{
							id: 'orig1',
							title: 'Choosing a college advice',
							author: 'original_poster',
							subreddit: 'ApplyingToCollege',
							selftext: 'Original body text here (plain markdown)',
							permalink: '/r/ApplyingToCollege/comments/orig1/choosing_a_college_advice/',
							created_utc: 1699900000,
							is_self: true,
							is_gallery: false,
							thumbnail: 'self',
						},
					],
					url_overridden_by_dest:
						'/r/ApplyingToCollege/comments/orig1/choosing_a_college_advice/',
					domain: 'self.ApplyingToCollege',
				},
			},
			// Non-t3 entry (should be skipped)
			{kind: 'more', data: {id: 'skip1', count: 5}},
		],
	},
}

void test('parseRedditPostsJson: text post', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_text1')!
	t.assert.ok(post, 'text post should be parsed')
	t.assert.equal(post.postType, 'text')
	t.assert.equal(post.thumbnail, null) // 'self' → null
	t.assert.ok(post.contentHtml.includes('Some body text'))
	t.assert.equal(post.images, undefined)
	t.assert.equal(post.linkUrl, null)
})

void test('parseRedditPostsJson: image post', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_img1')!
	t.assert.ok(post, 'image post should be parsed')
	t.assert.equal(post.postType, 'image')
	t.assert.equal(post.imageUrl, 'https://i.redd.it/fullres.jpg')
	t.assert.ok(post.thumbnail?.includes('preview.redd.it'))
	t.assert.equal(post.linkUrl, null)
	t.assert.equal(post.images, undefined)
})

void test('parseRedditPostsJson: gallery post decodes HTML entities in image URLs', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_gal1')!
	t.assert.ok(post, 'gallery post should be parsed')
	t.assert.equal(post.postType, 'gallery')
	t.assert.equal(post.images?.length, 2)
	t.assert.ok(post.images![0]!.includes('&format=png'), 'HTML entities must be decoded')
	t.assert.ok(!post.images![0]!.includes('&amp;'), 'raw &amp; must not remain in URL')
})

void test('parseRedditPostsJson: link post', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_link1')!
	t.assert.ok(post, 'link post should be parsed')
	t.assert.equal(post.postType, 'link')
	t.assert.equal(post.linkUrl, 'https://www.nytimes.com/2026/04/17/article')
	t.assert.equal(post.linkDomain, 'nytimes.com')
	t.assert.ok(post.contentHtml.includes('Great article!'))
	t.assert.equal(post.imageUrl, null)
})

void test('parseRedditPostsJson: crosspost includes original post metadata', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_cross1')!
	t.assert.ok(post, 'crosspost should be parsed')
	t.assert.equal(post.postType, 'crosspost')
	t.assert.equal(post.thumbnail, null)
	t.assert.ok(post.crosspostParent, 'crosspostParent should be present')
	t.assert.equal(post.crosspostParent!.subreddit, 'ApplyingToCollege')
	t.assert.equal(post.crosspostParent!.author, 'original_poster')
	t.assert.ok(post.crosspostParent!.selftext.includes('Original body text'))
	t.assert.ok(post.crosspostParent!.permalink.includes('reddit.com'))
})

void test('parseRedditPostsJson: skips non-t3 entries', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	// 5 valid t3 entries, 1 'more' entry skipped
	t.assert.equal(posts.length, 5)
})

void test('parseRedditPostsJson: normalizes special thumbnail strings to null', (t: TestContext) => {
	const fixture = {
		data: {
			children: [
				{
					kind: 't3',
					data: {
						id: 'tn1',
						title: 'Test',
						author: 'u1',
						created_utc: 1700000000,
						permalink: '/r/stolaf/comments/tn1/test/',
						selftext_html: '',
						thumbnail: 'default',
						is_self: true,
						is_gallery: false,
					},
				},
			],
		},
	}
	const posts = parseRedditPostsJson(fixture)
	t.assert.equal(posts[0]!.thumbnail, null, '"default" thumbnail should normalize to null')
})

void test('parseRedditPostsJson: id is prefixed with t3_', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	t.assert.ok(posts.every((p) => p.id.startsWith('t3_')))
})

void test('parseRedditPostsJson: created_utc converted to ISO 8601', (t: TestContext) => {
	const posts = parseRedditPostsJson(JSON_POSTS_FIXTURE)
	const post = posts.find((p) => p.id === 't3_text1')!
	t.assert.equal(post.publishedAt, new Date(1700000000 * 1000).toISOString())
})

void test('parseRedditPostsJson: returns empty array for invalid input', (t: TestContext) => {
	t.assert.deepEqual(parseRedditPostsJson(null), [])
	t.assert.deepEqual(parseRedditPostsJson({}), [])
})
