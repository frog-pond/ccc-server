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
// sent to wrangler. No stdin: given a terminal, wrangler puts it in raw mode for
// its hotkeys, which stops it (SIGTTOU) when this runs as a background job, as
// the app's start:with-server runs it, and turns Ctrl-C into a hotkey.
const wrangler = spawn(
	'node_modules/.bin/wrangler',
	['dev', '-c', 'wrangler.jsonc', '--ip', '0.0.0.0', '--port', String(PORT)],
	{cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit']},
)
wrangler.once('error', (error: NodeJS.ErrnoException) => {
	console.error(
		error.code === 'ENOENT'
			? 'wrangler is not installed here: run `npm ci` at the repo root'
			: `could not start wrangler: ${error.message}`,
	)
	process.exit(1)
})
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
		let response: Response | undefined
		try {
			// eslint-disable-next-line no-await-in-loop
			response = await fetch(`http://localhost:${String(PORT)}/`)
		} catch {
			// not listening yet
		}
		// An answer that is not JSON is the Worker's fault, not a Worker still starting.
		if (response?.ok) return response.json()
		// eslint-disable-next-line no-await-in-loop
		await sleep(500)
	}
	return undefined
}

// Any failure from here stops wrangler too, rather than leaving it on the port.
try {
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
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	await stop(1)
}
