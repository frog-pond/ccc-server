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
		integrations: [
			nodeProfilingIntegration(),
			captureConsoleIntegration({levels: ['warn', 'error']}),
			// not using logging console integration to avoid tracking koa access logs
			// consoleLoggingIntegration({levels: ['log', 'warn', 'error']}),
		],
		// Performance Monitoring
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
		// In trace mode, the profiler manages its own start and stop calls, which are based
		// on spans: the profiler continues to run while there is at least one active span,
		// and stops when there are no active spans.
		profileLifecycle: 'trace',
		// Send logs to Sentry
		enableLogs: true,
	})
}

setupSentry()

await import('dotenv/config')
await import('./server.ts')
