import {z} from 'zod'

const CorIconSchema = z.object({
  sort: z.string().nullable(),
  label: z.string(),
  description: z.string(),
  image: z.string().url(),
  is_filter: z.enum(['Y', 'N']),
  allergen: z.number(),
})

const DayPartSchema = z.object({
  id: z.string(),
  label: z.string(),
  starttime: z.string(),
  endtime: z.string(),
  message: z.string(),
})

const DaySchema = z.object({
  date: z.string(),
  dayparts: z.array(DayPartSchema),
  status: z.string(),
  message: z.string(),
})

const CafeSchema = z.object({
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  description: z.string(),
  message: z.string(),
  eod: z.string(),
  timezone: z.string(),
  menu_type: z.string(),
  menu_html: z.string(),
  location_detail: z.string(),
  weekly_schedule: z.string(),
  days: z.array(DaySchema),
  cor_icons: z.record(CorIconSchema),
})

export const CafesResponseSchema = z.object({
  cafes: z.record(CafeSchema),
})

const StationSchema = z.object({
    id: z.string(),
    label: z.string(),
    items: z.array(z.object({ id: z.string() })),
}).passthrough();

const MenuDayPartSchema = z.object({
  id: z.string(),
  label: z.string(),
  starttime: z.string(),
  endtime: z.string(),
  stations: z.array(StationSchema),
})

const MenuCafeSchema = z.object({
  name: z.string(),
  comma_operator: z.enum(['Y', 'N']),
  pipe_operator: z.enum(['Y', 'N']),
  menu_id: z.string(),
  dayparts: z.array(MenuDayPartSchema),
})

const MenuDaySchema = z.object({
  date: z.string(),
  cafes: z.record(MenuCafeSchema),
})

const MenuItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  price: z.string(),
  station: z.string(),
  cor_icon: z.array(z.number()),
  nutrition_details: z.string().url(),
})

export const MenuResponseSchema = z.object({
  days: z.array(MenuDaySchema),
  items: z.record(MenuItemSchema),
  superplates: z.array(z.unknown()),
  goitems: z.array(z.unknown()),
  cor_icons: z.array(z.unknown()),
  version: z.number(),
})

export const ItemSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
}).passthrough();
