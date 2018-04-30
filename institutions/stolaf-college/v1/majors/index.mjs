import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const majorsBase = 'https://www.stolaf.edu/directory/majors?format=json'

export const getMajors = () => GET(majorsBase, {json: true})

export async function majors(ctx) {
	let resp = await getMajors()
	ctx.body = resp.body
}
