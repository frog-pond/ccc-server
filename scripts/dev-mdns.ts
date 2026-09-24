import {spawn, type ChildProcess} from 'node:child_process'
import {hostname} from 'node:os'

/// Runs `wrangler dev` on the LAN and advertises it over mDNS, so the React
/// Native app on the same network can find it without typing an IP address.

const PORT = 3000
const SCHOOLS = ['stolaf-college', 'carleton-college']

const institution = process.argv[2]
if (!institution || !SCHOOLS.includes(institution)) {
	console.error(`usage: dev-mdns.ts <${SCHOOLS.join('|')}>`)
	process.exit(1)
}

// 0.0.0.0 so a phone on the network can reach it; wrangler dev listens only on
// localhost by default. Each school keeps its own local cache, since both serve
// the same URLs and a shared cache would mix their data.
const wrangler = spawn(
	'npx',
	[
		'wrangler',
		'dev',
		'--env',
		institution,
		'--ip',
		'0.0.0.0',
		'--port',
		String(PORT),
		'--persist-to',
		`.wrangler/state/${institution}`,
	],
	{stdio: 'inherit'},
)

const serviceName = `ccc-server (${hostname()})`
let stopAdvertisement: (() => void | Promise<void>) | undefined

if (process.platform === 'darwin') {
	// On macOS, delegate to dns-sd so registration goes through the system
	// mDNSResponder. A pure-JS mDNS stack competing on port 5353 triggers
	// Bonjour name-conflict dialogs and can rename the host.
	const child: ChildProcess = spawn(
		'dns-sd',
		[
			'-R',
			serviceName,
			'_ccc-server._tcp',
			'local',
			String(PORT),
			`institution=${institution}`,
			'path=/v1/',
		],
		{stdio: 'ignore', detached: false},
	)
	child.once('error', (error) => {
		console.warn(`mDNS advertisement disabled: failed to start dns-sd (${error.message})`)
	})
	console.log(`advertising mDNS service: ${serviceName}._ccc-server._tcp on port ${String(PORT)}`)
	stopAdvertisement = () => {
		child.kill()
	}
} else {
	try {
		const {Bonjour} = await import('bonjour-service')
		const bonjour = new Bonjour()
		const service = bonjour.publish({
			name: serviceName,
			type: 'ccc-server',
			port: PORT,
			txt: {institution, path: '/v1/'},
		})
		console.log(
			`advertising mDNS service: ${service.name}._ccc-server._tcp on port ${String(PORT)}`,
		)
		stopAdvertisement = () =>
			new Promise<void>((resolve) => {
				const stop =
					typeof service.stop === 'function'
						? (service.stop as (callback: () => void) => void)
						: undefined
				if (!stop) {
					bonjour.destroy()
					resolve()
					return
				}
				stop(() => {
					// bonjour.destroy() returns any; call without returning
					bonjour.destroy()
					resolve()
				})
			})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.warn(`mDNS advertisement disabled: ${message}`)
	}
}

let shutdownInitiated = false
const handleSignal = (signal: NodeJS.Signals) => {
	if (shutdownInitiated) return
	shutdownInitiated = true
	void (async () => {
		await stopAdvertisement?.()
		wrangler.kill(signal)
		wrangler.once('exit', () => {
			process.kill(process.pid, signal)
		})
	})()
}
process.once('SIGTERM', () => {
	handleSignal('SIGTERM')
})
process.once('SIGINT', () => {
	handleSignal('SIGINT')
})
wrangler.once('exit', (code) => {
	if (!shutdownInitiated) {
		void (async () => {
			await stopAdvertisement?.()
			process.exit(code ?? 1)
		})()
	}
})
