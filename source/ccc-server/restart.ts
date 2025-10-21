import type {Context} from './context.ts'

export function restart(ctx: Context): void {
	ctx.status = 200
	ctx.body = {message: 'Server restart initiated'}

	// Schedule process exit after response is sent
	// The process manager (systemd, PM2, Docker) will restart the process
	setImmediate(() => {
		console.log('Server restart requested - exiting process')
		process.exit(0)
	})
}
