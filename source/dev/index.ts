// Runs the Worker locally with `wrangler dev`, and advertises one server per
// campus over mDNS so the app's Server URL screen finds it. Ctrl-C withdraws
// the adverts and stops wrangler.

import {spawn} from 'node:child_process'
import {hostname} from 'node:os'
import {setTimeout as sleep} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'
import {advertise} from '../ccc-lib/mdns.ts'
import {advertsFor, campusesFrom} from './discovery.ts'
import {portIsFree} from './port.ts'

const PORT = 8787
const READY_TIMEOUT_MS = 60_000
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// The readiness check below takes any answer on the port for this Worker's, so
// a port already in use would have this run advertise someone else's server.
if (!(await portIsFree(PORT))) {
	console.error(
		`port ${String(PORT)} is in use: is another \`mise run dev\` or \`wrangler dev\` running?`,
	)
	process.exit(1)
}

// The binary itself, not `npx wrangler`: a signal sent to npx is not a signal
// sent to wrangler.
const wrangler = spawn(
	'node_modules/.bin/wrangler',
	['dev', '-c', 'wrangler.jsonc', '--ip', '0.0.0.0', '--port', String(PORT)],
	{cwd: repoRoot, stdio: 'inherit'},
)
const wranglerExit = new Promise<number>((resolve) => {
	wrangler.once('exit', (code) => {
		resolve(code ?? 1)
	})
})

let stopping = false
/// Read through a function: `stopping` changes in signal handlers, which
/// TypeScript's narrowing cannot see.
const isStopping = () => stopping
const withdrawals: (() => Promise<void>)[] = []
const withdrawAll = () => Promise.all(withdrawals.map((withdraw) => withdraw()))

async function stop(exitCode: number) {
	if (stopping) return
	stopping = true
	await withdrawAll()
	wrangler.kill('SIGTERM')
	await wranglerExit
	process.exit(exitCode)
}

process.once('SIGINT', () => void stop(0))
process.once('SIGTERM', () => void stop(0))

// wrangler stopping on its own (a port in use, a crash) ends the run with its code.
void wranglerExit.then(async (code) => {
	if (stopping) return
	stopping = true
	await withdrawAll()
	process.exit(code)
})

/// The Worker's `GET /` answer, once it gives one; undefined if it never does.
async function waitForWorker(): Promise<unknown> {
	const deadline = Date.now() + READY_TIMEOUT_MS
	while (Date.now() < deadline) {
		// Polls one request at a time, on purpose.
		try {
			// eslint-disable-next-line no-await-in-loop
			const response = await fetch(`http://localhost:${String(PORT)}/`)
			// eslint-disable-next-line no-await-in-loop
			if (response.ok) return await response.json()
		} catch {
			// not listening yet
		}
		// eslint-disable-next-line no-await-in-loop
		await sleep(500)
	}
	return undefined
}

const root = await waitForWorker()
if (root === undefined) {
	console.error(
		`wrangler dev did not answer on port ${String(PORT)} within ${String(READY_TIMEOUT_MS / 1000)}s`,
	)
	await stop(1)
} else {
	const adverts = advertsFor(campusesFrom(root), hostname(), PORT)
	withdrawals.push(...(await Promise.all(adverts.map((advert) => advertise(advert)))))
	// A Ctrl-C while they were being published found nothing to withdraw yet.
	if (isStopping()) await withdrawAll()
}
