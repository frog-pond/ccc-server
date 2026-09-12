import {deburr, sortBy} from 'lodash-es'

/**
 * The key an org sorts and groups by: its name folded to plain lower-case
 * letters, without the article or campus name a reader ignores, and without
 * the punctuation some orgs open with — `¡Presente!` belongs under P.
 */
export function sortableName(name: string, ignoredPrefixes: RegExp): string {
	return deburr(name)
		.replace(ignoredPrefixes, '')
		.replace(/^[^\p{Letter}\p{Number}]+/u, '')
		.toLowerCase()
}

/**
 * The section an org files under. Names that start with a digit, and names
 * left with nothing to file under, share the number sign, which iOS lists
 * after the letters.
 */
export function groupableName(sortableName: string): string {
	let first = sortableName.at(0)
	return first && /\p{Letter}/u.test(first) ? first.toLocaleUpperCase() : '#'
}

/** Orgs in list order: A through Z, then the number sign, the way iOS sorts an indexed list. */
export function sortOrgs<T extends {$groupableName: string; $sortableName: string}>(
	orgs: T[],
): T[] {
	return sortBy(orgs, [(org) => (org.$groupableName === '#' ? 1 : 0), '$sortableName'])
}
