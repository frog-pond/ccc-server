import {parseArgs} from 'node:util'
import {bundleSchool, SCHOOLS, startWorker} from '../test/harness.ts'
import {FIXTURES_DIR, recordingUpstream} from '../test/fixtures.ts'
import {testableRoutes} from '../test/testable-routes.ts'

/// Runs each school's Worker against the real upstreams, walking the same
/// routes the replay tests walk, and saves every upstream answer as a fixture.
/// A host that fails keeps its previous recordings.

const {values} = parseArgs({options: {out: {type: 'string', default: FIXTURES_DIR}}})
const out = values.out

let failedHosts = new Set<string>()
let recordedHosts = new Set<string>()

// one school at a time; they share upstream hosts
for (let school of SCHOOLS) {
	let recording = recordingUpstream(out)
	// eslint-disable-next-line no-await-in-loop
	let mf = await startWorker({
		scriptPath: bundleSchool(school),
		bindings: {
			INSTITUTION: school,
			GOOGLE_CALENDAR_API_KEY: process.env['GOOGLE_CALENDAR_API_KEY'] ?? '',
		},
		upstream: recording.upstream,
	})

	// eslint-disable-next-line no-await-in-loop
	let routes = (await (await mf.dispatchFetch('http://localhost/v1/routes')).json()) as {
		path: string
	}[]
	// one route at a time, so upstreams see the same gentle load the server gives them
	for (let path of testableRoutes(routes)) {
		// eslint-disable-next-line no-await-in-loop
		let response = await mf.dispatchFetch(`http://localhost${path}`)
		// eslint-disable-next-line no-await-in-loop
		await response.arrayBuffer()
		console.log(`${school} ${String(response.status)} ${path}`)
	}

	for (let host of recording.failedHosts) failedHosts.add(host)
	for (let host of recording.recordedHosts) recordedHosts.add(host)
	// eslint-disable-next-line no-await-in-loop
	await mf.dispose()
}

for (let host of recordedHosts) failedHosts.delete(host)

if (failedHosts.size) {
	console.log(`\nkept old recordings for: ${[...failedHosts].toSorted().join(', ')}`)
}
if (!recordedHosts.size) {
	console.error('every host failed; nothing was recorded')
	process.exit(1)
}
