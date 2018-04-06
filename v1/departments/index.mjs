import got from 'got'
import mem from 'mem'

const ONE_DAY = 24 * 60 * 60 * 1000
const GET = mem(got.get, {maxAge: ONE_DAY})

const departmentsBase = 'https://www.stolaf.edu/directory/departments?format=json'

export const getDepartments = () => GET(departmentsBase, {json: true})

export async function departments(ctx) {
  let resp = await getDepartments()
  ctx.body = resp.body
}
