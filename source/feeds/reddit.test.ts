import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseRedditPosts, parseRedditComments, buildCommentTree} from './reddit.ts'

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
    <author><name>/u/second_user</name></author>
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
	t.assert.equal(posts[1]!.author, 'second_user')
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
