import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {messageFor, sentryTelegram, signedBySentry} from '../src/sentry-telegram.ts'
import {spyOnFetch} from './spy.ts'

// the secrets vitest.config.ts gives the worker
const SECRET = 'test-sentry-secret'
const TELEGRAM = 'https://api.telegram.org/bottest-bot-token/sendMessage'

async function sign(body: string, secret = SECRET): Promise<string> {
	let encoder = new TextEncoder()
	let key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{name: 'HMAC', hash: 'SHA-256'},
		false,
		['sign'],
	)
	let mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
	return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function post(resource: string, payload: unknown, signature?: string) {
	let body = JSON.stringify(payload)
	return exports.default.fetch(
		new Request('https://worker.test/sentry/telegram', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Sentry-Hook-Resource': resource,
				'Sentry-Hook-Signature': signature ?? (await sign(body)),
			},
			body,
		}),
	)
}

const issue = {
	action: 'created',
	data: {
		issue: {
			title: 'TypeError: <undefined> is not a function',
			culprit: 'app/menus.tsx in render',
			level: 'error',
			shortId: 'AAO-1F',
			web_url: 'https://frog-pond.sentry.io/issues/123/?a=1&b=2',
			project: {slug: 'all-about-olaf', name: 'All About Olaf'},
		},
	},
}

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation(() => Promise.resolve(Response.json({ok: true})))
})
afterEach(() => fetchSpy.mockRestore())

const sentMessage = () => {
	let [url, init] = fetchSpy.mock.calls[0] ?? []
	return {url, body: JSON.parse(String(init?.body)) as Record<string, unknown>}
}

describe('signedBySentry', () => {
	test('takes the HMAC-SHA256 of the body in hex', async () => {
		let body = new TextEncoder().encode('{"a":1}').buffer
		expect(await signedBySentry(body, await sign('{"a":1}'), SECRET)).toBe(true)
	})

	test('refuses another secret, another body, or none', async () => {
		let body = new TextEncoder().encode('{"a":1}').buffer
		expect(await signedBySentry(body, await sign('{"a":1}', 'other'), SECRET)).toBe(false)
		expect(await signedBySentry(body, await sign('{"a":2}'), SECRET)).toBe(false)
		expect(await signedBySentry(body, null, SECRET)).toBe(false)
		expect(await signedBySentry(body, 'abc', SECRET)).toBe(false)
	})
})

describe('POST /sentry/telegram', () => {
	test('posts a new issue to the topic', async () => {
		let response = await post('issue', issue)
		expect(response.status).toBe(204)
		let {url, body} = sentMessage()
		expect(url).toBe(TELEGRAM)
		expect(body).toMatchObject({
			chat_id: '-100123',
			message_thread_id: 42,
			parse_mode: 'HTML',
			link_preview_options: {is_disabled: true},
		})
		expect(body['text']).toBe(
			[
				'🔴 <b>New issue</b> · all-about-olaf · AAO-1F',
				'TypeError: &lt;undefined&gt; is not a function',
				'<code>app/menus.tsx in render</code>',
				'<a href="https://frog-pond.sentry.io/issues/123/?a=1&amp;b=2">Open in Sentry</a>',
			].join('\n'),
		)
	})

	test('posts an alert rule firing, with its rule and environment', async () => {
		let response = await post('event_alert', {
			action: 'triggered',
			data: {
				triggered_rule: 'Any new error',
				event: {
					title: 'Network request failed',
					level: 'warning',
					environment: 'production',
					web_url: 'https://frog-pond.sentry.io/issues/9/events/abc/',
				},
			},
		})
		expect(response.status).toBe(204)
		expect(sentMessage().body['text']).toBe(
			[
				'🟡 <b>Alert: Any new error</b>',
				'Network request failed',
				'env: production',
				'<a href="https://frog-pond.sentry.io/issues/9/events/abc/">Open in Sentry</a>',
			].join('\n'),
		)
	})

	test('posts a metric alert', async () => {
		await post('metric_alert', {
			action: 'critical',
			data: {
				description_title: 'Crash free sessions below 99%',
				description_text: '98.2% crash free sessions in the past hour',
				web_url: 'https://frog-pond.sentry.io/alerts/rules/details/1/',
			},
		})
		expect(sentMessage().body['text']).toBe(
			[
				'🔴 <b>Crash free sessions below 99%</b>',
				'98.2% crash free sessions in the past hour',
				'<a href="https://frog-pond.sentry.io/alerts/rules/details/1/">Open in Sentry</a>',
			].join('\n'),
		)
	})

	test('refuses a body Sentry did not sign, and posts nothing', async () => {
		let response = await post('issue', issue, await sign('something else'))
		expect(response.status).toBe(401)
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('answers the installation webhook without posting', async () => {
		let response = await post('installation', {action: 'created', data: {installation: {}}})
		expect(response.status).toBe(204)
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('is a 502 when Telegram refuses the message', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(Response.json({ok: false, description: 'chat not found'}, {status: 400})),
		)
		let response = await post('issue', issue)
		expect(response.status).toBe(502)
	})

	test('names the secrets that are missing, and not their values', async () => {
		let response = await sentryTelegram(
			new Request('https://worker.test/sentry/telegram', {method: 'POST', body: '{}'}),
			{SENTRY_CLIENT_SECRET: SECRET} as Env,
		)
		expect(response.status).toBe(503)
		expect(await response.json()).toEqual({
			error: 'the Sentry relay is not set up',
			missing: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
		})
	})

	test('is only posted to', async () => {
		let response = await exports.default.fetch(new Request('https://worker.test/sentry/telegram'))
		expect(response.status).toBe(405)
	})
})

describe('messageFor', () => {
	test('says who an issue was assigned by', () => {
		let message = messageFor('issue', {...issue, action: 'assigned', actor: {name: 'Drew'}})
		expect(message?.split('\n')[0]).toBe('🔴 <b>Issue assigned</b> · all-about-olaf · AAO-1F')
		expect(message?.split('\n').at(-1)).toBe('by Drew')
	})

	test('marks a resolved issue', () => {
		expect(messageFor('issue', {...issue, action: 'resolved'})).toMatch(
			/^✅ <b>Issue resolved<\/b>/u,
		)
	})

	test('posts nothing for a comment', () => {
		expect(messageFor('comment', {action: 'created', data: {}})).toBeUndefined()
	})
})
