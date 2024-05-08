/**
 * Creates a map for consumption by `findHtmlKey` for fast key/value queries from html structures.
 *
 * Example:
 *
 * ```js
 * new Map({
 *  'Job Type' => '...',
 *  'Job Description' => '...',
 *  'key' => 'value',
 * })
 * ```
 *
 * @param {NodeListOf<HTMLElement>} details - Details is a node list of HTML{*}Element values.
 * It is a scoped version of the webpage containing all the html elements that we aim to parse.
 * @param {Array<string>} paragraphicalKeys  A set of strings that are parsed as long-form content
 * that receive separate parsing for line breaks and special characters.
 */
export function getDetailMap(
	details: NodeListOf<HTMLElement>,
	paragraphicalKeys: readonly string[],
) {
	let map = new Map<string, string>()

	for (const listEl of details) {
		let [node, ...childNodeValue] = listEl.childNodes
		if (!node) {
			continue
		}

		let key = node.textContent?.replace(/:$/, '') ?? ''
		let value = ''

		if (paragraphicalKeys.includes(key)) {
			let paragraphs = [...listEl.querySelectorAll('p')]
			let content = paragraphs.length ? paragraphs : childNodeValue
			value = content
				.map((el) => el.textContent)
				.join('\n\n')
				.trim()
		} else {
			value = childNodeValue
				.map((el) => el.textContent)
				.join(' ')
				.trim()
		}

		map.set(key, value)
	}

	return map
}

/**
 * Enables fast lookup of a named section of html content using the data structure
 * generated from `getDetailMap`.
 *
 * For example, if we need to find  content associated with a section on a page
 * named "Description", we call this function looking for that string along with
 * the output from `getDetailMap` to quickly return the value for a key.
 *
 * @param value - a key name to look up
 * @param detailMap - a data structure containing the key:value content pairs
 */
export function findHtmlKey(value: string, detailMap: Map<string, string>) {
	return detailMap.get(value) ?? ''
}

/**
 * Replaces whitespace with an empty string.
 *
 * @param text - the text to clean
 */
export function cleanTextBlock(text: string) {
	return text.replace(/\s+/g, ' ')
}
