import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const buildingsBase = 'https://www.stolaf.edu/directory/buildings?format=json'

export const getBuildings = () => GET(buildingsBase, {json: true})

export async function buildings(ctx) {
  let resp = await getBuildings()
  ctx.body = resp.body
}
