import Turndown from 'turndown'
import {htmlFragment} from '../ccc-lib/dom.ts'

/// What a posting's title and description say, read the way the app reads
/// them (AAO-React-Native's student-work/posting.ts and ccc-jobs'
/// parsers/description.ts), so a client can filter on it without parsing.

/// The three wage structures St. Olaf pays student workers under.
export type PayStructure = 'ST' | 'NST' | 'OSA'
/// Within a structure: 1 is entry-level, 2 needs experience, 3 leads.
export type PayTier = 1 | 2 | 3
export interface PayCode {
	structure: PayStructure
	tier: PayTier
}

/// A pay code, as "(WS-ST2)", "(WS-OSA 1)", or with a doubled closing paren.
const PAY_CODE = /\s*\(WS-(ST|NST|OSA)\s*([123])\)+/u

export const LEVELS = {1: 'entry', 2: 'experienced', 3: 'lead'} as const
export type Level = (typeof LEVELS)[PayTier]

export function payCode(title: string): PayCode | null {
	let match = PAY_CODE.exec(title)
	if (!match) return null
	return {structure: match[1] as PayStructure, tier: Number(match[2]) as PayTier}
}

export type Term = 'academic-year' | 'fall' | 'spring' | 'summer'

/// A term word's optional year, as "Fall 26" or "Summer 2027".
const YEAR = String.raw`(?:\s+\d{2}(?:\d{2})?)?`

/// The term a title opens with. Each is its own word, so "Fallout" is not Fall.
const TERM_PREFIXES: [RegExp, Term][] = [
	[/^AY(?:\s+(?:\d{2}|\d{4})-\d{2})?\s+/u, 'academic-year'],
	[/^\d{4}-\d{2}\s+/u, 'academic-year'],
	[new RegExp(String.raw`^(?:F\d{2}|Fall${YEAR})\s+`, 'u'), 'fall'],
	[new RegExp(String.raw`^(?:Sp?\d{2}|Spring${YEAR})\s+`, 'u'), 'spring'],
	[new RegExp(String.raw`^Summer${YEAR}\s+`, 'u'), 'summer'],
]

/// Some postings name the term in the middle of the title instead.
const ACADEMIC_YEAR = /\bAcademic Year\b/u

export function term(title: string): Term | null {
	let prefixed = TERM_PREFIXES.find(([prefix]) => prefix.test(title))
	if (prefixed) return prefixed[1]
	return ACADEMIC_YEAR.test(title) ? 'academic-year' : null
}

/// The title without its term prefix or pay code.
export function displayTitle(title: string): string {
	let prefixed = TERM_PREFIXES.find(([prefix]) => prefix.test(title))
	let withoutTerm = prefixed ? title.replace(prefixed[0], '') : title
	return withoutTerm.replace(PAY_CODE, '').trim()
}

/// Lowercased words with accents and apostrophes gone, so "lions" finds
/// "Lion’s" and "minagi kin" finds "Mináǧi Kiŋ".
export function searchWords(text: string): string[] {
	return text
		.toLowerCase()
		.replaceAll(/['’]/gu, '')
		.normalize('NFKD')
		.replaceAll(/\p{M}/gu, '')
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word !== '')
}

/// One labelled line of a description, as "Wage Range: $12.00/hour".
export interface DescriptionField {
	/// the label as written, without a leading numeral
	label: string
	value: string
}

/// Which labels a description reader names, and which it leaves out of the
/// body: each board's template has its own.
export interface DescriptionLabels<P extends string> {
	/// lowercased labels worth a name of their own, to that name
	promoted: Readonly<Record<string, P>>
	/// lowercased labels on every posting, or accounting: left out of the body
	dropped: ReadonlySet<string>
}

/// The labels worth a name of their own.
const PROMOTED = {
	'department name': 'department',
	'wage range': 'wage',
	'length of position': 'length',
	'contact person/supervisor': 'contact',
	classification: 'classification',
} as const

export type PromotedField = (typeof PROMOTED)[keyof typeof PROMOTED]

/// On every posting, or HR accounting: left out of the body.
const DROPPED = new Set([
	'job title',
	'unit number',
	'unit number (5 digits)',
	'name and address of employer',
])

const LEADING_NUMERAL = /^[ivx]+\.\s*/iu

function normaliseLabel(label: string): string {
	return label.trim().replace(LEADING_NUMERAL, '').trim().toLowerCase()
}

const ELEMENT = 1
const TEXT = 3

const isElement = (node: Node): node is Element => node.nodeType === ELEMENT

function textOf(node: Node): string {
	return (node.textContent ?? '').split(/\s+/u).join(' ').trim()
}

const BOLD_STYLE = /font-weight:\s*(?:700|800|900|bold)/iu

function isBold(node: Node): boolean {
	if (!isElement(node)) return false
	let tag = node.tagName.toLowerCase()
	if (tag === 'b' || tag === 'strong') return true
	return BOLD_STYLE.test(node.getAttribute('style') ?? '')
}

const LIST_TAGS = new Set(['ul', 'ol'])

/// A run that is one wrapping element (the usual `<p>`) is labelled by what is
/// inside it; a list is not labelled at all.
function contentOf(run: Node[]): Node[] {
	let only = run.length === 1 ? run[0] : undefined
	if (!only || !isElement(only) || LIST_TAGS.has(only.tagName.toLowerCase())) return run
	return [...only.childNodes]
}

/// A run is labelled when its first content is bold text holding a colon,
/// which is how the posting template marks every heading.
function labelOf(run: Node[]): DescriptionField | undefined {
	let content = contentOf(run)
	let first = content.find((node) => isElement(node) || textOf(node) !== '')
	if (!first || !isBold(first)) return undefined

	let heading = textOf(first)
	let whole = content
		.map(textOf)
		.filter((part) => part !== '')
		.join(' ')
	let colon = whole.indexOf(':')
	// the colon is in the bold text, or straight after it ("<b>Label</b>: value")
	if (colon === -1 || whole.slice(heading.length, colon).trim() !== '') return undefined

	return {
		label: whole.slice(0, colon).trim().replace(LEADING_NUMERAL, '').trim(),
		value: whole.slice(colon + 1).trim(),
	}
}

/// A line break, however the editor wrapped it (`<span><br></span>`).
function isLineBreak(node: Node): boolean {
	if (!isElement(node)) return false
	if (node.tagName.toLowerCase() === 'br') return true
	if (textOf(node) !== '') return false
	return [...node.childNodes].some(isLineBreak)
}

/// The template's unit of meaning, one label and its value: a block, or the
/// stretch of a block between line breaks.
function runsOf(root: Element): Node[][] {
	let runs: Node[][] = []
	let visit = (nodes: Node[]) => {
		for (let node of nodes) {
			if (!isElement(node)) {
				if (node.nodeType === TEXT && textOf(node) !== '') runs.push([node])
				continue
			}
			if (node.tagName.toLowerCase() === 'div') {
				visit([...node.childNodes])
				continue
			}
			let children = [...node.childNodes]
			if (!children.some(isLineBreak)) {
				runs.push([node])
				continue
			}
			let current: Node[] = []
			for (let child of children) {
				if (isLineBreak(child)) {
					if (current.length > 0) runs.push(current)
					current = []
				} else {
					current.push(child)
				}
			}
			if (current.length > 0) runs.push(current)
		}
	}
	visit([...root.childNodes])
	return runs
}

function htmlOf(run: Node[]): string {
	return run.map((node) => (isElement(node) ? node.outerHTML : (node.textContent ?? ''))).join('')
}

const turndown = new Turndown({headingStyle: 'atx', hr: '---', bulletListMarker: '-'})
// the editor bolds with a style, not with <b>
turndown.addRule('bold-style', {
	filter: (node) => node.nodeName === 'SPAN' && isBold(node),
	replacement(content) {
		let [, lead, inner, trail] = /^(\s*)([\s\S]*?)(\s*)$/u.exec(content) ?? []
		return inner ? `${lead ?? ''}**${inner}**${trail ?? ''}` : content
	},
})

function markdownOf(html: string): string {
	return turndown.turndown(htmlFragment(html)).trim()
}

export interface Description<P extends string = PromotedField> {
	/// every labelled line, in order
	fields: DescriptionField[]
	/// the labelled lines the app shows on their own, by name; absent when the
	/// posting leaves one blank
	promoted: Partial<Record<P, string>>
	/// the rest of the description, as Markdown: what is neither promoted nor
	/// on every posting
	markdown: string
}

const STOLAF_LABELS: DescriptionLabels<PromotedField> = {promoted: PROMOTED, dropped: DROPPED}

/// A St. Olaf posting's description, read with its template's labels.
export function readDescription(html: string): Description {
	return readDescriptionWith(html, STOLAF_LABELS)
}

export function readDescriptionWith<P extends string>(
	html: string,
	labels: DescriptionLabels<P>,
): Description<P> {
	let fields: DescriptionField[] = []
	let promoted: Description<P>['promoted'] = {}
	let kept: string[] = []

	for (let run of runsOf(htmlFragment(html))) {
		let labelled = labelOf(run)
		if (labelled) {
			fields.push(labelled)
			let normalised = normaliseLabel(labelled.label)
			if (labels.dropped.has(normalised)) continue
			let name = Object.hasOwn(labels.promoted, normalised)
				? labels.promoted[normalised]
				: undefined
			if (name) {
				if (labelled.value && promoted[name] === undefined) promoted[name] = labelled.value
				continue
			}
		}
		kept.push(htmlOf(run))
	}

	let markdown = kept
		.map(markdownOf)
		.filter((part) => part !== '')
		.join('\n\n')
	return {fields, promoted, markdown}
}
