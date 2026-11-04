/// One `_ccc-server._tcp` service, as the app's Server URL screen discovers it.
export interface Advert {
	name: string
	port: number
	txt: Record<string, string>
}

/// Advertises a service over mDNS, resolving to a function that withdraws it.
/// A failure to advertise is a warning, never a crash: it resolves to a no-op.
export async function advertise(advert: Advert): Promise<() => Promise<void>> {
	const {name, port, txt} = advert

	if (process.platform === 'darwin') {
		// On macOS, delegate to dns-sd so registration goes through the system
		// mDNSResponder. A pure-JS mDNS stack competing on port 5353 triggers
		// Bonjour name-conflict dialogs and can rename the host.
		const {spawn} = await import('node:child_process')
		const child = spawn(
			'dns-sd',
			[
				'-R',
				name,
				'_ccc-server._tcp',
				'local',
				String(port),
				...Object.entries(txt).map(([key, value]) => `${key}=${value}`),
			],
			{stdio: 'ignore', detached: false},
		)
		child.once('error', (error) => {
			console.warn(`mDNS advertisement disabled: failed to start dns-sd (${error.message})`)
		})
		console.log(`advertising mDNS service: ${name}._ccc-server._tcp on port ${String(port)}`)

		return () => {
			child.kill()
			return Promise.resolve()
		}
	}

	try {
		const {Bonjour} = await import('bonjour-service')
		const bonjour = new Bonjour()
		const service = bonjour.publish({name, type: 'ccc-server', port, txt})
		console.log(
			`advertising mDNS service: ${service.name}._ccc-server._tcp on port ${String(port)}`,
		)

		return () =>
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
		return () => Promise.resolve()
	}
}
