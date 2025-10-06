import test from 'ava'
import {spawn} from 'child_process'
import type {ChildProcess} from 'child_process'
import ky from 'ky'
import getPort from 'get-port'
import {toGlobalId} from 'graphql-relay'

let server: ChildProcess
let port: number

test.before(async () => {
	port = await getPort()
	await new Promise<void>((resolve, reject) => {
		server = spawn('npm', ['run', 'start:dev'], {
			env: {
				...process.env,
				INSTITUTION: 'stolaf-college',
				NODE_PORT: String(port),
			},
			detached: true,
		})

		server.stdout?.on('data', (data) => {
			if (data.toString().includes(`listening on port ${port}`)) {
				resolve()
			}
		})

		server.stderr?.on('data', (data) => {
			console.error(`server stderr: ${data}`)
		})

		server.on('exit', (code) => {
			if (code !== 0) {
				reject(new Error(`Server exited with code ${code}`))
			}
		})
	})
})

test.after.always(async () => {
	if (server?.pid) {
		// Kill the process group to ensure child processes are also killed.
		process.kill(-server.pid)
	}
})

test('graphql endpoint returns a successful response for a basic query', async (t) => {
	const query = `{ hello }`
	const response = await ky
		.post(`http://localhost:${port}/graphql`, {
			json: {query},
		})
		.json<{data: {hello: string}}>()

	t.is(response.data.hello, 'world')
})

test('graphql endpoint returns a list of contacts in a connection', async (t) => {
	const query = `
		query GetContacts {
			contacts {
				edges {
					node {
						id
						title
					}
				}
			}
		}
	`
	const response = await ky
		.post(`http://localhost:${port}/graphql`, {
			json: {query},
		})
		.json<{data: {contacts: {edges: {node: {id: string; title: string}}[]}}}>()

	const contacts = response.data.contacts.edges
	t.true(Array.isArray(contacts))
	t.truthy(contacts.length)
	t.is(contacts[0]!.node.title, 'St. Olaf Public Safety')
	t.truthy(contacts[0]!.node.id)
})

test('graphql endpoint can fetch a single contact by its global ID', async (t) => {
	const contactTitle = 'St. Olaf Public Safety'
	const globalId = toGlobalId('Contact', contactTitle)

	const query = `
		query GetNode($id: ID!) {
			node(id: $id) {
				... on Contact {
					title
				}
			}
		}
	`
	const response = await ky
		.post(`http://localhost:${port}/graphql`, {
			json: {query, variables: {id: globalId}},
		})
		.json<{data: {node: {title: string}}}>()

	t.is(response.data.node.title, contactTitle)
})