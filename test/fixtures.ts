import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {Response, type Request} from 'miniflare'

export const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures')

/// Values that change on every request (the current time) or must never be
/// committed (API keys). Leaving them out of the fixture name lets a recording
/// made last week answer today's request.
const UNRECORDED_PARAMS = ['key', 'timeMin', 'date_from', 'date_to']

/// File systems cap names at 255 bytes; long query strings get hashed instead.
const MAX_NAME_LENGTH = 200

export interface Fixture {
	status: number
	contentType: string | null
	body: Buffer
}

export function fixtureName(url: URL): string {
	let search = new URLSearchParams(url.search)
	for (let param of UNRECORDED_PARAMS) {
		search.delete(param)
	}
	search.sort()
	let query = search.size ? `?${search.toString()}` : ''
	let name = encodeURIComponent(url.pathname + query)
	if (name.length > MAX_NAME_LENGTH) {
		name = createHash('sha256').update(name).digest('hex')
	}
	return path.join(url.host, name)
}

export function readFixture(root: string, url: URL): Fixture | undefined {
	let base = path.join(root, fixtureName(url))
	if (!existsSync(`${base}.json`)) {
		return undefined
	}
	let meta = JSON.parse(readFileSync(`${base}.json`, 'utf8')) as Omit<Fixture, 'body'>
	return {...meta, body: readFileSync(`${base}.body`)}
}

export function writeFixture(root: string, url: URL, fixture: Fixture): void {
	let base = path.join(root, fixtureName(url))
	mkdirSync(path.dirname(base), {recursive: true})
	writeFileSync(`${base}.body`, fixture.body)
	let meta = {status: fixture.status, contentType: fixture.contentType}
	writeFileSync(`${base}.json`, JSON.stringify(meta, null, '\t') + '\n')
}

function responseInit(status: number, contentType: string | null) {
	return contentType ? {status, headers: {'content-type': contentType}} : {status}
}

/// Answers a Worker's outbound requests from recordings. A request with no
/// recording is collected in `missing` and answered 599, so a test can fail
/// naming it; it never reaches the network.
export function replayUpstream(root: string) {
	let missing: string[] = []
	let upstream = (request: Request) => {
		let fixture = readFixture(root, new URL(request.url))
		if (!fixture) {
			missing.push(request.url)
			return new Response(`no recording for ${request.url}`, {status: 599})
		}
		return new Response(fixture.body, responseInit(fixture.status, fixture.contentType))
	}
	return {missing, upstream}
}

/// Passes a Worker's outbound requests to the network and records the answers.
/// A host that errors or answers 5xx keeps its old recordings.
export function recordingUpstream(root: string) {
	let failedHosts = new Set<string>()
	let recordedHosts = new Set<string>()
	let upstream = async (request: Request) => {
		let url = new URL(request.url)
		let response: globalThis.Response
		try {
			response = await fetch(url, {method: request.method, headers: [...request.headers]})
		} catch (error) {
			failedHosts.add(url.host)
			throw error
		}
		let body = Buffer.from(await response.arrayBuffer())
		let contentType = response.headers.get('content-type')
		if (response.status >= 500) {
			failedHosts.add(url.host)
		} else {
			writeFixture(root, url, {status: response.status, contentType, body})
			recordedHosts.add(url.host)
		}
		// fetch has already decompressed the body, so only the type carries over
		return new Response(body, responseInit(response.status, contentType))
	}
	return {failedHosts, recordedHosts, upstream}
}
