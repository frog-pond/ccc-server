import {createServer, type AddressInfo, type Server} from 'node:net'
import {test} from 'node:test'
import {portIsFree} from './port.ts'

/// A server listening on a port the system picked.
async function listening(): Promise<{server: Server; port: number}> {
	const server = createServer()
	await new Promise<void>((resolve) => {
		server.listen(0, '0.0.0.0', resolve)
	})
	return {server, port: (server.address() as AddressInfo).port}
}

void test('a port something is listening on is not free', async (t) => {
	const {server, port} = await listening()
	try {
		t.assert.equal(await portIsFree(port), false)
	} finally {
		server.close()
	}
})

void test('a port nothing is listening on is free', async (t) => {
	const {server, port} = await listening()
	await new Promise<void>((resolve) => {
		server.close(() => {
			resolve()
		})
	})
	t.assert.equal(await portIsFree(port), true)
})
