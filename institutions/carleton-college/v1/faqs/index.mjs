import got from 'got'
import mem from 'mem'

const ONE_HOUR = 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_HOUR})

const base = 'https://carls-app.github.io/carls/faqs.json'

export async function faqs(ctx) {
	let resp = await GET(base, {json: true})
	ctx.body = resp.body
}
