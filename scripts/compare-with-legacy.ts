import {testableRoutes} from '../test/testable-routes.ts'

/// Walks the testable routes on the droplet and on a Worker and reports where
/// their JSON differs. Used once per school before moving DNS; delete it after
/// the droplet is shut down.

/// Fields that differ between any two requests, whichever server answers.
const IGNORED_KEYS = new Set(['datePublished', 'lastModified', 'isOngoing', 'date', 'timeMin'])

/// Routes whose whole body changes minute to minute.
const IGNORED_ROUTES = new Set(['/v1/athletics/scores'])

export function differences(legacy: unknown, worker: unknown, path = '$'): string[] {
	if (Object.is(legacy, worker)) return []

	if (Array.isArray(legacy) && Array.isArray(worker)) {
		let length = Math.max(legacy.length, worker.length)
		return Array.from({length}, (_, i) =>
			differences(legacy[i], worker[i], `${path}[${String(i)}]`),
		).flat()
	}

	if (isObject(legacy) && isObject(worker)) {
		let keys = new Set([...Object.keys(legacy), ...Object.keys(worker)])
		return [...keys]
			.filter((key) => !IGNORED_KEYS.has(key))
			.flatMap((key) => differences(legacy[key], worker[key], `${path}.${key}`))
	}

	return [`${path}: ${JSON.stringify(legacy)} → ${JSON.stringify(worker)}`]
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function main(legacyBase: string, workerBase: string) {
	let routes = (await (await fetch(`${legacyBase}/v1/routes`)).json()) as {path: string}[]
	let failed = 0
	// one route at a time keeps the output in route order
	for (let route of testableRoutes(routes)) {
		if (IGNORED_ROUTES.has(route)) continue
		// eslint-disable-next-line no-await-in-loop
		let [legacy, worker] = await Promise.all([
			fetch(`${legacyBase}${route}`).then((r) => r.json() as Promise<unknown>),
			fetch(`${workerBase}${route}`).then((r) => r.json() as Promise<unknown>),
		])
		let found = differences(legacy, worker)
		if (found.length) {
			failed++
			console.log(`✗ ${route} (${String(found.length)} differences)`)
			for (let line of found.slice(0, 5)) console.log(`    ${line}`)
		} else {
			console.log(`✓ ${route}`)
		}
	}
	if (failed) {
		console.log(`\n${String(failed)} routes differ`)
		process.exit(1)
	}
}

if (process.argv[1] === import.meta.filename) {
	let [legacyBase, workerBase] = process.argv.slice(2)
	if (!legacyBase || !workerBase) {
		console.error('usage: compare-with-legacy.ts <legacy-base-url> <worker-base-url>')
		process.exit(1)
	}
	await main(legacyBase, workerBase)
}
