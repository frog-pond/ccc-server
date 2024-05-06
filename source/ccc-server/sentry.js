import * as Sentry from '@sentry/node'
import {stripUrlQueryAndFragment} from '@sentry/utils'

export const sentryRequestHandler = (ctx, next) => {
	Sentry.runWithAsyncContext(() => {
		const scope = Sentry.getCurrentScope()
		scope.addEventProcessor((event) =>
			Sentry.addRequestDataToEvent(event, ctx.request, {
				include: {
					user: false,
				},
			}),
		)

		next()
	})
}

export const sentryTracingMiddleware = (ctx, next) => {
	const reqMethod = (ctx.method || '').toUpperCase()
	const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url)

	// connect to trace of upstream app
	let traceparentData
	if (ctx.request.get('sentry-trace')) {
		traceparentData = Sentry.extractTraceparentData(
			ctx.request.get('sentry-trace'),
		)
	}

	const transaction = Sentry.startTransaction({
		name: `${reqMethod} ${reqUrl}`,
		op: 'http.server',
		...traceparentData,
	})

	ctx.__sentry_transaction = transaction

	// We put the transaction on the scope so users can attach children to it
	Sentry.getCurrentScope().setSpan(transaction)

	ctx.res.on('finish', () => {
		// Push `transaction.finish` to the next event loop so open spans have a chance to finish before the transaction closes
		setImmediate(() => {
			// if using koa router, a nicer way to capture transaction using the matched route
			if (ctx._matchedRoute) {
				const mountPath = ctx.mountPath || ''
				transaction.setName(`${reqMethod} ${mountPath}${ctx._matchedRoute}`)
			}
			transaction.setHttpStatus(ctx.status)
			transaction.finish()
		})
	})

	next()
}
