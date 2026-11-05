import {z} from 'zod'
import type {Advert} from '../ccc-lib/mdns.ts'

const WorkerRoot = z.object({campuses: z.array(z.string())})

/// The campuses a running Worker serves, from its `GET /` answer.
export function campusesFrom(body: unknown): string[] {
	const result = WorkerRoot.safeParse(body)
	if (!result.success) {
		throw new Error("the Worker's / did not list its campuses")
	}
	return result.data.campuses
}

/// One advert per campus, each pointing the app at that campus's `/v1/` routes.
export function advertsFor(campuses: readonly string[], host: string, port: number): Advert[] {
	return campuses.map((campus) => ({
		name: `ccc-server ${campus} (${host})`,
		port,
		txt: {campus, path: `/${campus}/v1/`},
	}))
}
