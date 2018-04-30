import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const jobsBase =
	'https://www.stolaf.edu/apps/stuwork/index.cfm?fuseaction=getall&nostructure=1'

export const getJobs = () => GET(jobsBase, {json: true})

export async function jobs(ctx) {
	let resp = await getJobs()
	ctx.body = resp.body
}
