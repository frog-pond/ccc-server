import {describe, test, expect, vi} from 'vitest'
import * as v2 from './v2'
import {CafesResponseSchema, MenuResponseSchema} from './v2/types'
import {get} from '../ccc-lib/http'

vi.mock('../ccc-lib/http', () => ({
  get: vi.fn(),
}))

const mockCafeResponse = {
  cafes: {
    '1': {
      name: 'Test Cafe',
      address: '',
      city: '',
      state: '',
      zip: '',
      latitude: '0',
      longitude: '0',
      description: '',
      message: '',
      eod: '02:00',
      timezone: 'America/Chicago',
      menu_type: 'static',
      menu_html: '',
      location_detail: '',
      weekly_schedule: '',
      days: [],
      cor_icons: {},
    },
  },
}

const mockMenuResponse = {
  days: [],
  items: {},
  superplates: [],
  goitems: [],
  cor_icons: [],
  version: 2,
}

describe('Bon Appétit API v2', () => {
  test('fetchCafe should return a valid cafe object', async () => {
    vi.mocked(get).mockReturnValue({
      json: () => Promise.resolve(mockCafeResponse),
    } as any)

    const cafe = await v2.fetchCafe('1')
    expect(CafesResponseSchema.parse(cafe)).toEqual(mockCafeResponse)
  })

  test('fetchMenu should return a valid menu object', async () => {
    vi.mocked(get).mockReturnValue({
      json: () => Promise.resolve(mockMenuResponse),
    } as any)

    const menu = await v2.fetchMenu('1')
    expect(MenuResponseSchema.parse(menu)).toEqual(mockMenuResponse)
  })
})
