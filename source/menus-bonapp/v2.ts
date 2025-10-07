import {get} from '../ccc-lib/http.js'
import * as Sentry from '@sentry/node'
import {CafesResponseSchema, ItemSchema, MenuResponseSchema} from './v2/types.js'

const BON_APPETIT_API_USERNAME = process.env['BON_APPETIT_API_USERNAME']
const BON_APPETIT_API_PASSWORD = process.env['BON_APPETIT_API_PASSWORD']

if (!BON_APPETIT_API_USERNAME || !BON_APPETIT_API_PASSWORD) {
  throw new Error('Missing BON_APPETIT_API_USERNAME or BON_APPETIT_API_PASSWORD')
}

const authHeader = `Basic ${Buffer.from(
  `${BON_APPETIT_API_USERNAME}:${BON_APPETIT_API_PASSWORD}`,
).toString('base64')}`

export async function fetchV2(endpoint: string, params: Record<string, string>) {
  const url = `https://cafemanager-api.cafebonappetit.com/api/2/${endpoint}`
  try {
    const response = await get(url, {
      searchParams: params,
      headers: {
        Authorization: authHeader,
      },
    }).json()
    return response
  } catch (error) {
    console.error(`Error fetching from Bon Appétit API v2 ${endpoint}:`, error)
    Sentry.captureException(error)
    throw error
  }
}

export async function fetchCafe(cafeIndex: string) {
  const response = await fetchV2('cafes', {cafe: cafeIndex})
  return CafesResponseSchema.parse(response)
}

export async function fetchMenu(menuIndex: string) {
  const response = await fetchV2('menus', {cafe: menuIndex})
  return MenuResponseSchema.parse(response)
}

export async function fetchItem(itemIndex: string) {
    const response = await fetchV2('items', {item: itemIndex});
    return ItemSchema.parse(response);
}
