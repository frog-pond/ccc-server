import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const dictionaryBase = 'https://carls-app.github.io/carls/dictionary-carls.json'

export const getDefinitions = () => GET(dictionaryBase, {json: true})

export async function dictionary(ctx) {
	let resp = await getDefinitions()
	ctx.body = resp.body
}
