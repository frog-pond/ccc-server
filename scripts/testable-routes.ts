import {text} from 'node:stream/consumers'
import {testableRoutes} from '../test/testable-routes.ts'

/// Reads a /v1/routes response on stdin and prints the routes worth walking,
/// one per line, for smoke-test.sh.
let routes = JSON.parse(await text(process.stdin)) as {path: string}[]
for (let path of testableRoutes(routes)) {
	console.log(path)
}
