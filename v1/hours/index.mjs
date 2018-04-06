import got from 'got'
import mem from 'mem'

const ONE_HOUR = 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_HOUR})

const hoursBase = 'https://stodevx.github.io/AAO-React-Native/building-hours.json'

export const getHours = () => GET(hoursBase, {json: true})

export async function hours(ctx) {
  let resp = await getHours()
  ctx.body = resp.body
}
