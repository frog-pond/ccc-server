import type {BreakCalendar, Schedule} from './types.ts'

export type DefaultPolicy<T> =
	{kind: 'inline'; policy: Schedule<T>} | {kind: 'template'; policy: Schedule<T>}

export type SpacePolicy<T> =
	| DefaultPolicy<T>
	| {kind: 'normal'}
	| {kind: 'inherit'; fallback: DefaultPolicy<T>}
	| {kind: 'alias'; target: string}

function fail(path: string, message: string): never {
	throw new Error(`${path}: ${message}`)
}

/** Local templates replace global policies completely; inherited object keys never count. */
function template<T>(
	calendar: BreakCalendar<T>,
	key: string,
	name: string,
	path: string,
): DefaultPolicy<T> {
	let local = calendar.breaks[key]?.templates ?? {}
	let global = calendar.templates ?? {}
	let policy = Object.hasOwn(local, name)
		? local[name]
		: Object.hasOwn(global, name)
			? global[name]
			: undefined
	if (policy === undefined) fail(path, `unknown template ${name} in ${key}'s context`)
	return {kind: 'template', policy}
}

/** Defaults deliberately support only inline policies and template names. */
export function classifyDefault<T>(
	calendar: BreakCalendar<T>,
	key: string,
	policy: string | Schedule<T>,
	path: string,
): DefaultPolicy<T> {
	if (typeof policy !== 'string') return {kind: 'inline', policy}
	if (policy === 'normal' || policy === 'inherit' || Object.hasOwn(calendar.breaks, policy)) {
		fail(path, 'defaults cannot use normal, inherit or break references')
	}
	return template(calendar, key, policy, path)
}

/** The single interpretation of authored shorthand, shared by validation and expansion. */
export function classifySpacePolicy<T>(
	calendar: BreakCalendar<T>,
	key: string,
	policy: string | Schedule<T>,
	path: string,
): SpacePolicy<T> {
	if (typeof policy !== 'string') return {kind: 'inline', policy}
	if (policy === 'normal') return {kind: 'normal'}
	if (policy === 'inherit') {
		let fallback = calendar.breaks[key]?.defaultSpaceSchedule
		if (fallback === undefined) fail(path, 'inherit requires a break default')
		return {kind: 'inherit', fallback: classifyDefault(calendar, key, fallback, path)}
	}
	if (Object.hasOwn(calendar.breaks, policy)) return {kind: 'alias', target: policy}
	return template(calendar, key, policy, path)
}
