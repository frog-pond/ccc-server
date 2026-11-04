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
// the app's start:with-server runs it, and turns Ctrl-C into a hotkey. `::`
// listens on IPv4 and IPv6 both: the app may be handed either address.
const wrangler = spawn(
	'node_modules/.bin/wrangler',
	['dev', '-c', 'wrangler.jsonc', '--ip', '::', '--port', String(PORT)],
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
const withdrawals: (() => Promise<void>)[] = []
/// The adverts being published, so a stop that lands meanwhile still withdraws them.
let publishing: Promise<void> = Promise.resolve()

/// The one way out: withdraws every advert, stops wrangler, and exits.
async function stop(exitCode: number) {
	if (stopping) return
	stopping = true
	await publishing
	await Promise.all(withdrawals.map((withdraw) => withdraw()))
	wrangler.kill('SIGTERM')
	await wranglerExit
	process.exit(exitCode)
}

process.once('SIGINT', () => void stop(0))
process.once('SIGTERM', () => void stop(0))

// wrangler stopping on its own (a port in use, a crash) ends the run with its code.
void wranglerExit.then((code) => stop(code))

/// The Worker's `GET /` answer, once it gives one; undefined if it never does.
async function waitForWorker(): Promise<unknown> {
	const deadline = Date.now() + READY_TIMEOUT_MS
	while (Date.now() < deadline) {
		// Polls one request at a time, on purpose.
		let response: Response | undefined
		try {
			// Each poll is bounded too, so a Worker that takes the connection and never
			// answers still meets the deadline; the signal covers reading the body.
			// eslint-disable-next-line no-await-in-loop
			response = await fetch(`http://localhost:${String(PORT)}/`, {
				signal: AbortSignal.timeout(5000),
			})
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
		publishing = Promise.all(adverts.map((advert) => advertise(advert))).then((published) => {
			withdrawals.push(...published)
		})
		await publishing
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	await stop(1)
}
