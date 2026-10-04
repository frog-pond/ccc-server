import type Koa from 'koa'

/// What a response stream fails with when the client hangs up before the last
/// byte: an app sent to the background, or a dropped mobile connection.
const CLIENT_HANG_UPS = new Set(['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'EPIPE'])

function isClientHangUp(err: unknown, ctx: Koa.Context | undefined): boolean {
	let code = err && typeof err === 'object' && 'code' in err ? err.code : undefined
	return typeof code === 'string' && CLIENT_HANG_UPS.has(code) && !ctx?.res.writableFinished
}

/// Koa reports a client hanging up mid-response as a server error, and Sentry
/// picks up the log. Nothing failed on our side, so those are dropped here;
/// every other error goes to Koa's own handler as before.
export function ignoreClientHangUps(app: Koa) {
	app.on('error', (err: unknown, ctx?: Koa.Context) => {
		if (isClientHangUp(err, ctx)) return
		app.onerror(err as Error)
	})
	return app
}
