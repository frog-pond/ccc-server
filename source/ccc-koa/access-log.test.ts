import {test} from 'node:test'
import {Writable} from 'node:stream'
import Koa from 'koa'
import {accessLog} from './access-log.ts'
import {BEHIND_NGINX} from './behind-proxy.ts'

/// The access log line for one request with the given X-Forwarded-For.
async function logLine(
	t: test.TestContext,
	options: ConstructorParameters<typeof Koa>[0],
	forwardedFor: string,
) {
	let lines: string[] = []
	let stream = new Writable({
		write(chunk: Buffer, _encoding, done) {
			lines.push(chunk.toString())
			done()
		},
	})

	let app = new Koa(options)
	app.use(accessLog(stream))
	app.use((ctx) => {
		ctx.body = 'ok'
	})

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')

	await fetch(`http://localhost:${String(address.port)}/`, {
		headers: {'x-forwarded-for': forwardedFor},
	})
	return lines[0] ?? ''
}

void test('behind nginx, the access log names the address nginx saw', async (t) => {
	let line = await logLine(t, BEHIND_NGINX, '203.0.113.7')
	t.assert.match(line, /^203\.0\.113\.7 - - \[/)
})

void test('behind nginx, an address the client wrote into the header is ignored', async (t) => {
	// nginx appends the address it saw to whatever the client sent.
	let line = await logLine(t, BEHIND_NGINX, '6.6.6.6, 203.0.113.7')
	t.assert.match(line, /^203\.0\.113\.7 - - \[/)
})
