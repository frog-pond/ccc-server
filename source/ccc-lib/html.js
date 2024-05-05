/**
 * Creates a map for consumption by `findHtmlKey` for fast key/value queries from html structures.
 *
 * Example:
 * {
 *  'Job Type' => '...',
 *  'Job Description' => '...',
 *  'key' => 'value',
 * }
 *
 * @param {NodeListOf<HTMLElement>} details  Details is a node list of HTML{*}Element values.
 * It is a scoped version of the webpage containing all of the html elements that we aim to parse.
 * @param {Array<string>} paragraphicalKeys  A set of strings that are parsed as long-form content
 * that receive separate parsing for line breaks and special characters.
 * @returns {Map}
 */
export function getDetailMap(details, paragraphicalKeys) {
	return [...details].reduce((coll, listEl) => {
		let [key, ...childNodeValue] = listEl.childNodes
		key = key ? key.textContent.replace(/:$/, '') : key

		if (paragraphicalKeys.includes(key)) {
			let paragraphs = [...listEl.querySelectorAll('p')]
			let content = paragraphs.length ? paragraphs : childNodeValue
			childNodeValue = content
				.map((el) => el.textContent)
				.join('\n\n')
				.trim()
		} else {
			childNodeValue = childNodeValue
				.map((el) => el.textContent)
				.join(' ')
				.trim()
		}
		coll.set(key, childNodeValue)

		return coll
	}, new Map())
}

/**
 * Enables fast lookup of a named section of html content using the data structure
 * generated from `getDetailMap`.
 *
 * For example, if we need to find  content associated with a section on a page
 * named "Description", we call this function looking for that string along with
 * the output from `getDetailMap` to quickly return the value for a key.
 *
 * @param {string} value  a key name to lookup
 * @param {*} detailMap  a data structure containing the key:value content pairs
 * @returns string
 */
export function findHtmlKey(value, detailMap) {
	return detailMap.get(value) || ''
}

/**
 * Replaces whitespace with an empty string.
 *
 * @param {string} text
 * @returns string
 */
export function cleanTextBlock(text) {
	return text.replace(/\s+/g, ' ')
}
