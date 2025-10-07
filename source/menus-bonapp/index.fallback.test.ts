import {describe, test, expect, vi} from 'vitest'
import * as bonapp from './index.js'
import * as v2 from './v2.js'
import { JSDOM } from 'jsdom'
import { get } from '../ccc-lib/http.js'

vi.mock('./v2', async () => {
  const actual = await vi.importActual('./v2.js')
  return {
    ...actual,
    fetchCafe: vi.fn().mockRejectedValue(new Error('V2 API error')),
    fetchMenu: vi.fn().mockRejectedValue(new Error('V2 API error')),
    fetchItem: vi.fn().mockRejectedValue(new Error('V2 API error')),
  }
})

vi.mock('../ccc-lib/http.js', () => ({
  get: vi.fn(),
}))

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

describe('Fallback logic', () => {
  test('cafe function falls back to v1 on v2 failure', async () => {
    vi.mocked(get).mockReturnValue({
      text: () => Promise.resolve(mockHtml),
    } as any)
    const response = await bonapp.cafe('http://example.com');
    expect(response.cafe.name).toEqual('Stav Hall');
  });

  test('menu function falls back to v1 on v2 failure', async () => {
    vi.mocked(get).mockReturnValue({
      text: () => Promise.resolve(mockHtml),
    } as any)
    const response = await bonapp.menu('http://example.com');
    expect(response.items).toEqual({});
  });

  test('nutrition function falls back to legacy on v2 failure', async () => {
    const mockNutritionResponse = { label: 'Test Item' };
    vi.mocked(get).mockReturnValue({
      json: () => Promise.resolve(mockNutritionResponse),
    } as any)
    const response = await bonapp.nutrition('123');
    expect(response).toEqual(mockNutritionResponse);
  });
});
