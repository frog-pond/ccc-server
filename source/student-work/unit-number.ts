import {htmlFragment} from '../ccc-lib/dom.ts'

/// Zero-width characters the posting editor leaves around values.
const INVISIBLE = /[\u200B-\u200D\uFEFF]/gu

/// A St. Olaf unit: five digits, sometimes behind a two- or three-digit fund
/// ("10-13001", "010-11725"). The fund is not part of the unit, and the areas
/// file lists units without one. When a posting names two units, the first
/// is the one it is filed under.
const UNIT = /^(?:\d{2,3}-)?(\d{5})(?!\d)/u

/// The unit a "Unit Number" value names, or null when it names none.
export function unitNumber(value: string): string | null {
	let match = UNIT.exec(value.replace(INVISIBLE, '').trim())
	return match?.[1] ?? null
}

/// The template's label, with or without its "(5 digits)" hint.
const LABEL = /unit number(?:\s*\(5 digits\))?\s*:/iu

/// The unit a posting's description names. Its top-level elements are joined
/// with spaces, as the app joins them, so a paragraph starting with digits
/// cannot run on into the unit before it. Within one element text still runs
/// together, so the value is read up to its fifth digit.
export function unitNumberOfDescription(html: string): string | null {
	let text = Array.from(htmlFragment(html).childNodes, (node) => node.textContent ?? '').join(' ')
	let label = LABEL.exec(text)
	if (!label) return null
	return unitNumber(text.slice(label.index + label[0].length))
}
