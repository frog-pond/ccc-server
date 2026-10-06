import {z} from 'zod'
import type {PostingUnits} from './units.ts'

/// What the app is told a posting's unit is when no area lists the one it
/// has, or it has none. The areas file puts this unit in its catch-all area.
export const OTHER_UNIT = 'other'

/// The published areas file, which AAO-React-Native writes in
/// data/student-work-areas.yaml. Only the units matter here.
const AreasSchema = z.object({data: z.array(z.object({units: z.array(z.string())}))})

/// Every unit some area lists, or undefined when the file is not the shape
/// the app publishes.
export function listedUnitsOf(body: unknown): Set<string> | undefined {
	let parsed = AreasSchema.safeParse(body)
	return parsed.success ? new Set(parsed.data.data.flatMap((area) => area.units)) : undefined
}

/// Each posting's unit as the app sorts it into areas: the unit itself when
/// an area lists it, otherwise OTHER_UNIT, so every posting lands in some
/// area. With no list of units to check against, only a posting with no unit
/// is sent to OTHER_UNIT, and the rest keep the units they have.
export function groupUnits(
	units: PostingUnits,
	listed: Set<string> | undefined,
): Record<string, string> {
	let grouped: Record<string, string> = {}
	for (let [id, unit] of Object.entries(units)) {
		grouped[id] = unit !== null && (listed === undefined || listed.has(unit)) ? unit : OTHER_UNIT
	}
	return grouped
}
