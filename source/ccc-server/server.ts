import * as Sentry from '@sentry/node'
import {createApp, InstitutionSchema} from './app.ts'

async function main() {
	const smokeTesting = Boolean(process.env['SMOKE_TEST'])

	const rawInstitution = process.env['INSTITUTION']
	Sentry.setTag('INSTITUTION', rawInstitution)

	const institutionResult = InstitutionSchema.safeParse(process.env['INSTITUTION'])
	if (institutionResult.error) {
		console.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}, but got: ${String(rawInstitution)}`,
		)
		Sentry.logger.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}`,
		)
		process.exit(1)
	}
	const institution = institutionResult.data
	// on every metric this process sends
	Sentry.getGlobalScope().setAttribute('institution', institution)

	const app = await createApp(institution)

	//
	// start the app
	//

	if (smokeTesting) {
		return
	}

	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const PORT = process.env['NODE_PORT'] || '3000'
	const parsedPort = Number.parseInt(PORT, 10)
	if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
		console.error(`NODE_PORT must be an integer between 0 and 65535, but got: ${PORT}`)
		process.exit(1)
	}

	const server = app.listen(parsedPort)
	await new Promise<void>((resolve, reject) => {
		server.once('listening', resolve)
		server.once('error', reject)
	})

	let boundAddress = server.address()
	if (boundAddress === null || typeof boundAddress === 'string') {
		console.error('failed to determine bound server address')
		process.exit(1)
	}
	const boundPort = boundAddress.port
	console.log(`listening on port ${String(boundPort)}`)

	if (process.env['ADVERTISE_MDNS'] === '1') {
		const {hostname} = await import('node:os')
		const serviceName = `ccc-server (${hostname()})`
		let shutdownInitiated = false
		let stopAdvertisement: (() => void | Promise<void>) | undefined
		const closeServer = () =>
			new Promise<void>((resolve) => {
				server.close(() => {
					resolve()
				})
			})
		const installShutdownHandlers = () => {
			const handleSignal = (signal: NodeJS.Signals) => {
				if (shutdownInitiated) return
				shutdownInitiated = true
				void (async () => {
					await stopAdvertisement?.()
					await closeServer()
					process.removeListener('SIGTERM', onSigTerm)
					process.removeListener('SIGINT', onSigInt)
					process.kill(process.pid, signal)
				})()
			}
			const onSigTerm = () => {
				handleSignal('SIGTERM')
			}
			const onSigInt = () => {
				handleSignal('SIGINT')
			}
			process.once('SIGTERM', onSigTerm)
			process.once('SIGINT', onSigInt)
		}

		if (process.platform === 'darwin') {
			// On macOS, delegate to dns-sd so registration goes through the system
			// mDNSResponder. A pure-JS mDNS stack competing on port 5353 triggers
			// Bonjour name-conflict dialogs and can rename the host.
			const {spawn} = await import('node:child_process')
			const child = spawn(
				'dns-sd',
				[
					'-R',
					serviceName,
					'_ccc-server._tcp',
					'local',
					String(boundPort),
					`institution=${institution}`,
					'path=/v1/',
				],
				{stdio: 'ignore', detached: false},
			)
			child.once('error', (error) => {
				console.warn(`mDNS advertisement disabled: failed to start dns-sd (${error.message})`)
			})
			console.log(
				`advertising mDNS service: ${serviceName}._ccc-server._tcp on port ${String(boundPort)}`,
			)

			stopAdvertisement = () => {
				child.kill()
			}
			installShutdownHandlers()
		} else {
			try {
				const {Bonjour} = await import('bonjour-service')
				const bonjour = new Bonjour()
				const service = bonjour.publish({
					name: serviceName,
					type: 'ccc-server',
					port: boundPort,
					txt: {institution, path: '/v1/'},
				})
				console.log(
					`advertising mDNS service: ${service.name}._ccc-server._tcp on port ${String(boundPort)}`,
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
				installShutdownHandlers()
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				console.warn(`mDNS advertisement disabled: ${message}`)
			}
		}
	}
}

await main()
