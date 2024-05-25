import {z} from 'zod'

export const ColorSchema = z.union([
	z.string().regex(/^#[a-f0-9]{3,6}/i),
	z.string().regex(/^rgb\(\d+, \d+, \d+\)$/i),
	z.tuple([z.number().int(), z.number().int(), z.number().int()]),
])
