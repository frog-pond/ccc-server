import {test, expect, vi} from 'vitest'

import * as bonApp from './index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.js'
import {get} from '../ccc-lib/http.js'
import * as v2 from './v2.js'

vi.mock('../ccc-lib/http.js', () => ({
  get: vi.fn(),
}))

vi.mock('./v2.js', () => ({
    fetchCafe: vi.fn(),
    fetchMenu: vi.fn(),
    fetchItem: vi.fn(),
}));


const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

const mockBamcoObject = {
  current_cafe: { id: '243', name: 'Stav Hall' },
  dayparts: {},
  menu_items: {},
  cor_icons: {},
}

const mockHtml = `
  <html>
    <body>
      <script>
        window.Bamco = ${JSON.stringify(mockBamcoObject)};
      </script>
    </body>
  </html>
`

vi.mocked(get).mockReturnValue({
  text: () => Promise.resolve(mockHtml),
} as any)


test('fetching cafe info should not throw', async () => {
    vi.mocked(v2.fetchCafe).mockResolvedValue({ cafes: { '243': { name: 'Stav Hall', days: [], cor_icons: {}, address: '', city: '', state: '', zip: '', latitude: '', longitude: '', description: '', message: '', eod: '', timezone: '', menu_type: '', menu_html: '', location_detail: '', weekly_schedule: '' } } });
	await expect(bonApp.cafe(STAV)).resolves.not.toThrow()
})

test('fetching cafe info should return a CafeInfoResponseSchema struct', async () => {
    vi.mocked(v2.fetchCafe).mockResolvedValue({ cafes: { '243': { name: 'Stav Hall', days: [], cor_icons: {}, address: '', city: '', state: '', zip: '', latitude: '', longitude: '', description: '', message: '', eod: '', timezone: '', menu_type: '', menu_html: '', location_detail: '', weekly_schedule: '' } } });
	const data = await bonApp.cafe(STAV)
	expect(() => CafeInfoResponseSchema.parse(data)).not.toThrow()
})

test('fetching menu info should not throw', async () => {
    vi.mocked(v2.fetchMenu).mockResolvedValue({ days: [], items: {}, superplates: [], goitems: [], cor_icons: [], version: 2 });
	await expect(bonApp.menu(STAV)).resolves.not.toThrow()
})

test('fetching menu info should return a CafeMenuResponseSchema struct', async () => {
    vi.mocked(v2.fetchMenu).mockResolvedValue({ days: [], items: {}, superplates: [], goitems: [], cor_icons: [], version: 2 });
	const data = await bonApp.menu(STAV)
	expect(() => CafeMenuResponseSchema.parse(data)).not.toThrow()
})
