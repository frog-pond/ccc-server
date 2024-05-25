import {z} from 'zod'

export const AmPmTimeSchema = z.string().regex(/^1?\d:[0-5]?\d[ap]m$/)
