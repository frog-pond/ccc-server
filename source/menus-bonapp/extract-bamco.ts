/// BonApp café pages set their data as `Bamco.*` assignments in inline
/// scripts. Workers cannot run those scripts (no eval), so this reads the
/// assignments directly. Each is a single line of JSON, except `current_cafe`,
/// which is a JS object literal that only needs its `name` and `id`.
///
/// If BonApp changes how it writes these lines, the Bamco schema check after
/// this fails loudly. The weekly fixture-drift workflow exists to catch that.

const JSON_ASSIGNMENT = /^\s*Bamco\.(menu_items|cor_icons) = (.+);\s*$/gm
const DAYPART_ASSIGNMENT = /^\s*Bamco\.dayparts\['(\d+)'\] = (\{.*\});\s*$/gm
const CURRENT_CAFE = /Bamco\.current_cafe = \{\s*name: '((?:[^'\\]|\\.)*)',\s*id: (\d+)\s*\};/

export function extractBamco(html: string): unknown {
	let cafe = CURRENT_CAFE.exec(html)
	if (!cafe) {
		return undefined
	}

	let bamco: Record<string, unknown> = {
		current_cafe: {name: cafe[1]?.replace(/\\(.)/g, '$1'), id: Number(cafe[2])},
	}

	for (let [, key, json] of html.matchAll(JSON_ASSIGNMENT)) {
		if (key && json) {
			bamco[key] = JSON.parse(json)
		}
	}

	let dayparts: Record<string, unknown> = {}
	for (let [, id, json] of html.matchAll(DAYPART_ASSIGNMENT)) {
		if (id && json) {
			dayparts[id] = JSON.parse(json)
		}
	}
	bamco['dayparts'] = dayparts

	return bamco
}
