import {test} from 'node:test'
import {parseRedditPosts, parseRedditComments, parseRedditCommentsJson, buildCommentTree} from './reddit.ts'

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
		{id: 'post-id', author: 'op', contentHtml: '', publishedAt: '', parentId: null},
	])
	t.assert.deepEqual(result, [])
})

void test('buildCommentTree: orphan comments become top-level', (t) => {
	const result = buildCommentTree([
		{id: 'post-id', author: 'op', contentHtml: '', publishedAt: '', parentId: null},
		{id: 'orphan-id', author: 'orphan', contentHtml: '', publishedAt: '', parentId: 'nonexistent-parent'},
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

void test('parseRedditPosts: strips "submitted by" footer from post contentHtml', (t) => {
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
	t.assert.ok(
		!posts[0]!.contentHtml.includes('[link]'),
		'contentHtml should not include "[link]"',
	)
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
