import {z} from 'zod'

const envelope = z.object({data: z.unknown()})

/** Unwrap AAO's normalized publications; expansion checks their structural compatibility. */
export function publicationData(file: unknown): unknown {
	return envelope.parse(file).data
}
