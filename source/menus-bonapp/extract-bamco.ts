/// BonApp café pages set their data as `Bamco.*` assignments in inline
/// scripts. Rather than run those scripts, this reads the assignments directly.
/// Each is a single line of JSON, except `current_cafe`, which is a JS object
/// literal that only needs its `name` and `id`.
///
/// A page with no `Bamco` assignments at all is a closed café. Otherwise every
/// assignment read here must parse: if BonApp changes how it writes one of
/// them, this throws rather than skip it, so the café shows an error (and
/// Sentry hears of it) instead of showing as closed or with an empty menu.

/// Any `Bamco` assignment, however written.
const ANY_ASSIGNMENT = /\bBamco\.\w+(?:\[[^\]]*\])?\s*=(?!=)/

/// The assignments read below, however written, to count against what the
/// patterns after them actually read.
const READ_ASSIGNMENT =
	/\bBamco\.(?:menu_items|cor_icons|current_cafe)\s*=(?!=)|\bBamco\.dayparts\s*\[/g

// Each on a line of its own. Lines end only at \n, not at U+2028 or U+2029,
// which JSON allows inside strings.
const JSON_ASSIGNMENT = /(?:^|\n)[ \t]*Bamco\.(menu_items|cor_icons) = ([^\n]+?);[ \t]*\r?(?=\n|$)/g
const DAYPART_ASSIGNMENT =
	/(?:^|\n)[ \t]*Bamco\.dayparts\['(\d+)'\] = (\{[^\n]*\});[ \t]*\r?(?=\n|$)/g
const CURRENT_CAFE = /Bamco\.current_cafe = \{\s*name: '((?:[^'\\]|\\[\s\S])*)',\s*id: (\d+)\s*\};/

export class BamcoFormatError extends Error {
	override name = 'BamcoFormatError'
}

const LINE_BREAKS = new Set(['\r\n', '\n', '\r', '\u2028', '\u2029'])

const SINGLE_CHARACTER_ESCAPES: Record<string, string> = {
	n: '\n',
	t: '\t',
	r: '\r',
	b: '\b',
	f: '\f',
	v: '\v',
	'0': '\0',
}

/// A single-quoted JS string literal's contents, as the script would read it.
export function unescapeJsString(literal: string): string {
	return literal.replace(
		/\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(\r\n|[\s\S]))/g,
		(_match, codePoint?: string, unit?: string, byte?: string, char?: string) => {
			if (codePoint) return String.fromCodePoint(parseInt(codePoint, 16))
			if (unit) return String.fromCharCode(parseInt(unit, 16))
			if (byte) return String.fromCharCode(parseInt(byte, 16))
			// a backslash before a line break continues the string onto the next line
			if (char === undefined || LINE_BREAKS.has(char)) return ''
			return SINGLE_CHARACTER_ESCAPES[char] ?? char
		},
	)
}

export function extractBamco(html: string): unknown {
	if (!ANY_ASSIGNMENT.test(html)) {
		return undefined
	}

	let cafe = CURRENT_CAFE.exec(html)
	if (!cafe) {
		throw new BamcoFormatError('BonApp page has Bamco data, but no current_cafe this can read')
	}
	let read = 1

	let bamco: Record<string, unknown> = {
		current_cafe: {name: unescapeJsString(cafe[1] ?? ''), id: Number(cafe[2])},
	}

	for (let [, key, json] of html.matchAll(JSON_ASSIGNMENT)) {
		if (key && json) {
			bamco[key] = JSON.parse(json)
			read += 1
		}
	}

	let dayparts: Record<string, unknown> = {}
	for (let [, id, json] of html.matchAll(DAYPART_ASSIGNMENT)) {
		if (id && json) {
			dayparts[id] = JSON.parse(json)
			read += 1
		}
	}
	bamco['dayparts'] = dayparts

	let written = html.match(READ_ASSIGNMENT)?.length ?? 0
	if (read !== written) {
		throw new BamcoFormatError(
			`BonApp page has ${String(written)} Bamco assignments to read, but only ${String(read)} could be read`,
		)
	}

	return bamco
}
