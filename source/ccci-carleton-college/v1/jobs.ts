import {z} from 'zod'
import {HTTPError} from 'ky'
import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {JobPostSchema, convertJobPost, type JobPost} from './jobs-shape.ts'

export {convertJobPost} from './jobs-shape.ts'

const jobsUrl = 'https://www.carleton.edu/student-employment/post-jobs/wp-json/wp/v2/posts'

const PAGE_SIZE = 100

/// WordPress caps `per_page` at 100, so a longer list is read a page at a time.
/// A page past the end answers 400, which is how a list of exactly 100n posts
/// shows its end.
async function fetchAllPosts() {
	let posts: JobPost[] = []
	for (let page = 1; ; page++) {
		let batch: JobPost[]
		try {
			// pages are read in turn: whether there is a next one depends on this one
			// eslint-disable-next-line no-await-in-loop
			let body = await getJson(jobsUrl, {
				searchParams: {per_page: PAGE_SIZE, page, _embed: 'wp:term'},
			})
			batch = z.array(JobPostSchema).parse(body)
		} catch (error) {
			if (page > 1 && error instanceof HTTPError && error.response.status === 400) break
			throw error
		}
		posts.push(...batch)
		if (batch.length < PAGE_SIZE) break
	}
	return posts
}

export async function getAllJobs() {
	let posts = await fetchAllPosts()
	return posts
		.filter((p) => !p._embedded?.['wp:term']?.flat().some((t) => t.name === 'Archived'))
		.map(convertJobPost)
}

export async function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = await getAllJobs()
}
