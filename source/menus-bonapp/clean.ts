import {toLaxTitleCase} from '@frogpond/titlecase'
import {htmlFragment} from '../ccc-lib/dom.ts'

/// Cleans BonApp's menu text on the server, as the app's `prepareFood` has
/// done on the phone since 2018 (#58), so every client gets readable names.
///
/// Builds already shipped keep cleaning what they receive, so each function
/// here leaves text it has already cleaned alone, and gives what the current
/// app would have shown from BonApp's text -- with the same title-casing
/// library, at the same version. AAO 2.7 title-cases before decoding
/// entities, so there `&amp;` read as "&Amp;"; it now reads "&".

/// Tags whose text should not run into the next: `oil</p><br>served` is
/// "oil served", not "oilserved".
const BLOCK_BOUNDARY = /<(?:br|\/?(?:p|div|li|ul|ol|h[1-6]|tr|td|th))\b[^>]*>/giu

/// HTML's text: tags gone, entities decoded, whitespace evened out.
export function textOf(html: string): string {
	let text = htmlFragment(html.replace(BLOCK_BOUNDARY, ' $&')).textContent
	return text.split(/\s+/u).join(' ').trim()
}

/// BonApp's tags in parentheses at the end of a label -- a brand, "(gf)",
/// "(wellness)" -- however many there are.
function withoutTrailingTags(label: string): string {
	let tag = /\s?\([^)]*?\)\s?$/u
	while (tag.test(label)) {
		label = label.replace(tag, '')
	}
	return label
}

/// "<strong>@leaves & greens</strong>" is "Leaves & Greens". A daypart's
/// station label is the same name, bare, and the app files each item under
/// the station whose label matches its own, so both go through here.
export const stationName = (raw: string): string =>
	toLaxTitleCase(textOf(raw).replace(/^@\s*/u, ''))

export const subStationName = (raw: string): string => toLaxTitleCase(textOf(raw))

/// "fish  &amp; chips (gf)" is "Fish & Chips".
export const itemLabel = (raw: string): string => toLaxTitleCase(withoutTrailingTags(textOf(raw)))

export const itemDescription = (raw: string): string => textOf(raw)

export function cleanMenuItem<
	T extends {station: string; sub_station: string; label: string; description: string},
>(item: T): T {
	return {
		...item,
		station: stationName(item.station),
		sub_station: subStationName(item.sub_station),
		label: itemLabel(item.label),
		description: itemDescription(item.description),
	}
}

export function cleanDayPart<T extends {stations: {label: string}[]}>(daypart: T): T {
	return {
		...daypart,
		stations: daypart.stations.map((station) => ({...station, label: stationName(station.label)})),
	}
}
