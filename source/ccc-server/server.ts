import * as Sentry from '@sentry/node'
import {createApp, InstitutionSchema} from './app.ts'
import {advertise} from '../ccc-lib/mdns.ts'

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
	const discoveryPath = institution === 'all' ? '/' : '/v1/'
	console.log(`listening on port ${String(boundPort)}`)

	if (process.env['ADVERTISE_MDNS'] === '1') {
		const {hostname} = await import('node:os')
		const serviceName = `ccc-server (${hostname()})`
		let shutdownInitiated = false
		const closeServer = () =>
			new Promise<void>((resolve) => {
				server.close(() => {
					resolve()
				})
			})
		const handleSignal = (signal: NodeJS.Signals) => {
			if (shutdownInitiated) return
			shutdownInitiated = true
			void (async () => {
				await stopAdvertisement()
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

		const stopAdvertisement = await advertise({
			name: serviceName,
			port: boundPort,
			txt: {institution, path: discoveryPath},
		})
		process.once('SIGTERM', onSigTerm)
		process.once('SIGINT', onSigInt)
	}
}

await main()
