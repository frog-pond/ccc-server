import {JSDOM} from 'jsdom'

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

/// The unit a posting's description names. The description is HTML whose
/// paragraphs run together in its text, so the value is read up to the fifth
/// digit rather than to the end of a line.
export function unitNumberOfDescription(html: string): string | null {
	let text = JSDOM.fragment(html).textContent
	let label = LABEL.exec(text)
	if (!label) return null
	return unitNumber(text.slice(label.index + label[0].length))
}
