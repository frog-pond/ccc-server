import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const base = 'https://carls-app.github.io/carls/help.json'

export async function help(ctx) {
	let resp = await GET(base, {json: true})
	ctx.body = resp.body
}
