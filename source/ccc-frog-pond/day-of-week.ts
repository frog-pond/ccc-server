import {z} from 'zod'

export const DayOfWeekSchema = z.enum(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
