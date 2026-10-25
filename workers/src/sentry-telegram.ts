import {note} from './trace.ts'

/// Sentry's webhooks, from an internal integration, posted to a Telegram
/// group's topic. Sentry signs each body with the integration's client
/// secret (https://docs.sentry.io/organization/integrations/integration-platform/webhooks/),
/// and a body that does not carry its signature is refused, so nobody else can
/// post to the group through here.

/// The longest title or culprit put in a message. Every part of a message is
/// kept to a length like this one, so the whole stays well under the 4096
/// characters Telegram sends.
const LINE_LIMIT = 500

/// The longest link put in a message. A link cannot be cut short, so a longer
/// one is left out.
const LINK_LIMIT = 1000

/// The bytes a hex string spells, or undefined for anything else.
function fromHex(text: string): Uint8Array<ArrayBuffer> | undefined {
	if (!/^(?:[0-9a-f]{2})+$/iu.test(text)) return undefined
	return Uint8Array.from(text.match(/../gu) ?? [], (pair) => parseInt(pair, 16))
}

/// Whether `signature` is the HMAC-SHA256 of the body under the client secret,
/// in hex, as Sentry sends it in `Sentry-Hook-Signature`. `verify` compares
/// in constant time.
export async function signedBySentry(
	body: ArrayBuffer,
	signature: string | null,
	secret: string,
): Promise<boolean> {
	let mac = fromHex(signature?.trim() ?? '')
	if (!mac) return false
	let key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{name: 'HMAC', hash: 'SHA-256'},
		false,
		['verify'],
	)
	return crypto.subtle.verify('HMAC', key, mac, body)
}

/// Text made safe for Telegram's HTML mode, which knows only these four.
const escape = (text: string) =>
	text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')

/// Text made safe for Telegram's HTML mode, and no longer than `limit` once
/// it is. It is cut between characters, so never inside an entity.
function escapeClipped(text: string, limit = LINE_LIMIT): string {
	let escaped = escape(text)
	if (escaped.length <= limit) return escaped
	let clipped = ''
	for (let char of text) {
		let next = escape(char)
		if (clipped.length + next.length > limit - 1) break
		clipped += next
	}
	return `${clipped}…`
}

/// A link to Sentry, or undefined when there is none to give or it is too long.
function link(url: unknown): string | undefined {
	let href = text(url)
	if (href === undefined || escape(href).length > LINK_LIMIT) return undefined
	return `<a href="${escape(href)}">Open in Sentry</a>`
}

const LEVELS: Record<string, string> = {
	fatal: '🟥',
	error: '🔴',
	warning: '🟡',
	info: '🔵',
	debug: '⚪',
}

const levelMark = (level: unknown) =>
	(typeof level === 'string' && Object.hasOwn(LEVELS, level) ? LEVELS[level] : undefined) ?? '🔴'

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

/// The parts of an issue, event or error a message is made of. Sentry sends
/// more; only these are read.
type Problem = {
	title?: unknown
	culprit?: unknown
	level?: unknown
	web_url?: unknown
	shortId?: unknown
	environment?: unknown
	project?: unknown
}

type Payload = {
	action?: unknown
	actor?: {name?: unknown}
	data?: {
		issue?: Problem
		event?: Problem
		error?: Problem
		triggered_rule?: unknown
		metric_alert?: {alert_rule?: {name?: unknown}}
		description_title?: unknown
		description_text?: unknown
		web_url?: unknown
	}
}

const projectName = (project: unknown) =>
	project && typeof project === 'object'
		? (text((project as {slug?: unknown}).slug) ?? text((project as {name?: unknown}).name))
		: undefined

/// A message about one problem: a headline, its title, where it happened, and
/// a link to it in Sentry.
function problemMessage(
	headline: string,
	problem: Problem,
	mark = levelMark(problem.level),
): string {
	let title = text(problem.title) ?? 'Untitled issue'
	let label = [projectName(problem.project), text(problem.shortId)].filter(Boolean).join(' · ')
	let lines = [
		`${mark} <b>${escapeClipped(headline, 200)}</b>${label ? ` · ${escapeClipped(label, 200)}` : ''}`,
		escapeClipped(title),
	]
	let culprit = text(problem.culprit)
	if (culprit) lines.push(`<code>${escapeClipped(culprit)}</code>`)
	let environment = text(problem.environment)
	if (environment) lines.push(`env: ${escapeClipped(environment, 100)}`)
	let url = link(problem.web_url)
	if (url) lines.push(url)
	return lines.join('\n')
}

const ISSUE_HEADLINES: Record<string, string> = {
	created: 'New issue',
	resolved: 'Issue resolved',
	unresolved: 'Issue unresolved',
	assigned: 'Issue assigned',
	archived: 'Issue archived',
	ignored: 'Issue ignored',
}

const METRIC_MARKS: Record<string, string> = {critical: '🔴', warning: '🟡', resolved: '✅'}

/// The message a webhook is posted as, or undefined for one that is not
/// posted (the integration's own installation, a comment).
export function messageFor(resource: string, payload: Payload): string | undefined {
	let action = text(payload.action) ?? ''
	let data = payload.data ?? {}
	if (resource === 'issue' && data.issue) {
		let headline =
			(Object.hasOwn(ISSUE_HEADLINES, action) ? ISSUE_HEADLINES[action] : undefined) ??
			(action ? `Issue ${action}` : 'Issue')
		let actor = action === 'assigned' ? text(payload.actor?.name) : undefined
		let message = problemMessage(
			headline,
			data.issue,
			action === 'resolved' ? '✅' : levelMark(data.issue.level),
		)
		return actor ? `${message}\nby ${escapeClipped(actor, 100)}` : message
	}
	if (resource === 'event_alert' && data.event) {
		let rule = text(data.triggered_rule)
		return problemMessage(rule ? `Alert: ${rule}` : 'Alert', data.event)
	}
	if (resource === 'error' && data.error) return problemMessage('Error', data.error)
	if (resource === 'metric_alert') {
		let mark = (Object.hasOwn(METRIC_MARKS, action) ? METRIC_MARKS[action] : undefined) ?? '🔴'
		let title =
			text(data.description_title) ?? text(data.metric_alert?.alert_rule?.name) ?? 'Metric alert'
		let lines = [`${mark} <b>${escapeClipped(title)}</b>`]
		let description = text(data.description_text)
		if (description) lines.push(escapeClipped(description))
		let url = link(data.web_url)
		if (url) lines.push(url)
		return lines.join('\n')
	}
	return undefined
}

/// Sends `message` to the group's topic, or undefined when Telegram cannot be
/// reached. The bot token is part of Telegram's address, which there is no
/// other way to give it.
async function sendToTelegram(env: Env, message: string): Promise<Response | undefined> {
	let topic = env.TELEGRAM_TOPIC_ID?.trim() ? Number(env.TELEGRAM_TOPIC_ID) : undefined
	try {
		return await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN ?? ''}/sendMessage`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				chat_id: env.TELEGRAM_CHAT_ID,
				...(topic === undefined ? {} : {message_thread_id: topic}),
				text: message,
				parse_mode: 'HTML',
				link_preview_options: {is_disabled: true},
			}),
		})
	} catch (err) {
		console.error('Telegram could not be reached', err)
		return undefined
	}
}

/// `POST /sentry/telegram`: a Sentry webhook, checked against its signature and
/// posted to the Telegram topic. A 401 for a body Sentry did not sign, a 503
/// naming the worker's secrets that are not set (or saying the topic is not a
/// number), a 502 when Telegram cannot be reached or refuses the message (which
/// Sentry may send again), and otherwise a 204, also for a
/// webhook that is not posted.
export async function sentryTelegram(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return Response.json({error: 'method not allowed'}, {status: 405})
	// the names of the secrets that are missing, never their values
	let missing = (
		['SENTRY_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const
	).filter((name) => !env[name])
	let secret = env.SENTRY_CLIENT_SECRET
	if (!secret || missing.length > 0) {
		return Response.json({error: 'the Sentry relay is not set up', missing}, {status: 503})
	}
	if (env.TELEGRAM_TOPIC_ID?.trim() && !/^\d+$/u.test(env.TELEGRAM_TOPIC_ID.trim())) {
		return Response.json({error: 'TELEGRAM_TOPIC_ID is not a number'}, {status: 503})
	}

	let body = await request.arrayBuffer()
	if (!(await signedBySentry(body, request.headers.get('Sentry-Hook-Signature'), secret))) {
		return Response.json({error: 'bad signature'}, {status: 401})
	}

	let resource = request.headers.get('Sentry-Hook-Resource') ?? ''
	note({'ccc.sentry.resource': resource})
	let payload: Payload
	try {
		payload = JSON.parse(new TextDecoder().decode(body)) as Payload
	} catch {
		return Response.json({error: 'body is not JSON'}, {status: 400})
	}

	let message = messageFor(resource, payload)
	if (message === undefined) return new Response(null, {status: 204})

	let sent = await sendToTelegram(env, message)
	if (sent === undefined) {
		return Response.json({error: 'Telegram could not be reached'}, {status: 502})
	}
	note({'ccc.telegram.status_code': sent.status})
	if (!sent.ok) {
		// Telegram says why (a wrong chat or topic, a bot not in the group)
		console.error('Telegram refused the message', sent.status, await sent.text())
		return Response.json({error: `Telegram answered ${sent.status.toFixed(0)}`}, {status: 502})
	}
	return new Response(null, {status: 204})
}
