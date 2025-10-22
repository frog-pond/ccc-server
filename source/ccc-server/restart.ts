import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import type {Context} from './context.ts'

const execFileAsync = promisify(execFile)

async function executeRestart(): Promise<void> {
	console.log('Server restart requested')

	// Check if a custom restart script is configured
	const restartScript = process.env['RESTART_SCRIPT']

	if (restartScript) {
		// Execute custom restart script (e.g., poke-docker.sh for docker-compose pull & restart)
		console.log(`Executing restart script: ${restartScript}`)
		try {
			const {stdout, stderr} = await execFileAsync(restartScript)
			if (stdout) console.log('Restart script output:', stdout)
			if (stderr) console.error('Restart script errors:', stderr)
		} catch (error) {
			console.error('Failed to execute restart script:', error)
			// Fall back to process exit if script fails
			console.log('Falling back to process exit')
			process.exit(0)
		}
	} else {
		// Default behavior: exit process (works with systemd, PM2, Docker restart policies)
		console.log('No RESTART_SCRIPT configured, exiting process')
		process.exit(0)
	}
}

export function restart(ctx: Context): void {
	ctx.status = 200
	ctx.body = {message: 'Server restart initiated'}

	// Schedule restart after response is sent
	setImmediate(() => {
		void executeRestart()
	})
}
