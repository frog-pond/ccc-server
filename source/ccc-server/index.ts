import * as Sentry from '@sentry/node'
import {nodeProfilingIntegration} from '@sentry/profiling-node'
import {captureConsoleIntegration} from '@sentry/node'

function setupSentry() {
	const dsn = process.env['SENTRY_DSN']
	if (!dsn) {
		console.warn('no SENTRY_DSN set, not starting Sentry')
		return
	}

	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const environment = process.env['NODE_ENV'] || 'development'

	Sentry.init({
		dsn,
		environment,
		integrations: [nodeProfilingIntegration(), captureConsoleIntegration()],
		// Performance Monitoring
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
	})
}

setupSentry()

await import('dotenv/config')
await import('./server.js')
