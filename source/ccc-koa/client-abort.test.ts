import {test} from 'node:test'
import http from 'node:http'
import Koa from 'koa'
import compress from 'koa-compress'
import {ignoreClientHangUps} from './client-abort.ts'

/// A server that sends a large gzipped body, and a client that hangs up as
/// soon as the headers arrive -- an app sent to the background mid-download.
async function hangUpMidResponse(t: test.TestContext, setup: (app: Koa) => void = () => undefined) {
	let app = new Koa()
	setup(app)
	app.use(compress({threshold: 0}))
	app.use((ctx) => {
		// Random, so it does not compress away to nothing.
		ctx.body = {data: Array.from({length: 400_000}, () => Math.random())}
	})

	let errors: unknown[] = []
	t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args))

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')

	await new Promise<void>((resolve) => {
		let req = http.get({port: address.port, headers: {'accept-encoding': 'gzip'}}, (res) => {
			res.pause()
			req.destroy()
		})
		req.on('close', () => {
			resolve()
		})
		req.on('error', () => undefined)
	})
	// Let the server notice the closed socket.
	await new Promise((resolve) => setTimeout(resolve, 200))
	return errors
}

void test('a client hanging up mid-response is reported by default', async (t) => {
	let errors = await hangUpMidResponse(t)
	t.assert.match(String(errors[0]), /ERR_STREAM_PREMATURE_CLOSE/)
})

void test('ignoreClientHangUps drops a client hanging up mid-response', async (t) => {
	let errors = await hangUpMidResponse(t, ignoreClientHangUps)
	t.assert.deepEqual(errors, [])
})

void test('ignoreClientHangUps still reports a real error', (t) => {
	let app = ignoreClientHangUps(new Koa())
	let errors: unknown[] = []
	t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args))

	app.emit('error', new Error('upstream exploded'))

	t.assert.match(String(errors[0]), /upstream exploded/)
})
