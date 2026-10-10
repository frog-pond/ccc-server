import {z} from 'zod'
import {
	CARLETON_JOBS_ORIGIN,
	CARLETON_JOBS_PAGE_SIZE,
	CarletonJobPostSchema,
	carletonJobsUrl,
	carletonPosting,
	isArchived,
	type CarletonJobPost,
	type CarletonPostingWithDescription,
} from '../../../source/student-work/carleton-shape.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/// A board longer than this many pages is an error rather than a short board.
const MAX_PAGES = 10

async function page(n: number): Promise<{posts: CarletonJobPost[]; pages: number}> {
	let url = carletonJobsUrl(n)
	// built from carleton-shape's own address; a redirect is not followed
	let response = await fetch(url, {redirect: 'manual'})
	let where = `${CARLETON_JOBS_ORIGIN}${new URL(url).pathname}`
	if (!response.ok) {
		throw new Error(`Carleton Student Employment responded ${String(response.status)} for ${where}`)
	}
	let posts = z.array(CarletonJobPostSchema).parse(await response.json())
	let pages = Number(response.headers.get('x-wp-totalpages') ?? '1')
	return {posts, pages: Number.isFinite(pages) && pages > 0 ? pages : 1}
}

/// Carleton's student jobs, every page of them, without the archived ones.
export const carletonStudentWork = defineSource({
	name: 'carleton-student-work',
	key: () => 'carleton',
	async load(): Promise<CarletonPostingWithDescription[]> {
		let first = await page(1)
		if (first.pages > MAX_PAGES) {
			throw new Error(`Carleton Student Employment lists ${String(first.pages)} pages of jobs`)
		}
		let posts = [...first.posts]
		// pages are read in turn, to be gentle with the site
		for (let n = 2; n <= first.pages && first.posts.length === CARLETON_JOBS_PAGE_SIZE; n++) {
			// eslint-disable-next-line no-await-in-loop
			posts.push(...(await page(n)).posts)
		}
		let seen = new Set<number>()
		return posts
			.filter((post) => !seen.has(post.id) && seen.add(post.id) && !isArchived(post))
			.map(carletonPosting)
	},
	ttl: HOUR,
	staleIfError: DAY,
})
registerSource(carletonStudentWork)
