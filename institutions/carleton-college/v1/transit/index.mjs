import got from 'got'
import mem from 'mem'

const ONE_HOUR = 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_HOUR})

const base = 'https://carls-app.github.io/carls/bus-times.json'

export async function bus(ctx) {
	let resp = await GET(base, {json: true})
	ctx.body = resp.body
}
