// vendored from https://github.com/koajs/accesslog/tree/ab4fc5ba5f80afc9678d858bd84740e5caf27885
import type {Context, Next} from 'koa'
import type {Writable} from 'node:stream'

/**
 * Look-up map of month number into month short name (in english).
 * A month number is the value returned by Date#getMonth() and a short month name
 * is a 3 letter representation of a month of the year.
 */
const shortMonthByMonthNumber = {
	0: 'Jan',
	1: 'Feb',
	2: 'Mar',
	3: 'Apr',
	4: 'May',
	5: 'Jun',
	6: 'Jul',
	7: 'Aug',
	8: 'Sep',
	9: 'Oct',
	10: 'Nov',
	11: 'Dec',
} as const

/**
 * Returns a [short](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#month)
 * (3-letters) representation of the given month index **in English**.
 */
function toShortMonth(month: number): string {
	return month in shortMonthByMonthNumber
		? shortMonthByMonthNumber[month as keyof typeof shortMonthByMonthNumber]
		: '-'
}

/**
 * Returns a [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) compliant
 * offset string.
 */
function toOffset(offsetMinutes: number): string {
	const absoluteOffset = Math.abs(offsetMinutes)
	const hours = Math.floor(absoluteOffset / 60)
		.toFixed(0)
		.padStart(2, '0')
	const minutes = (absoluteOffset % 60).toFixed(0).padStart(2, '0')
	const sign = offsetMinutes > 0 ? '-' : '+'
	return `${sign}${hours}${minutes}`
}

/**
 * Formats the provided date into a [Common Log Format](https://en.wikipedia.org/wiki/Common_Log_Format)
 * compliant string.
 */
function toCommonAccessLogDateFormat(date: Date): string {
	if (!(date instanceof Date)) {
		throw new TypeError('Not a valid date')
	}

	let day = date.getDate().toFixed(0).padStart(2, '0')
	let month = toShortMonth(date.getMonth())
	let year = date.getFullYear().toFixed(0)
	let hour = date.getHours().toFixed(0).padStart(2, '0')
	let minute = date.getMinutes().toFixed(0).padStart(2, '0')
	let second = date.getSeconds().toFixed(0).padStart(2, '0')
	let offset = toOffset(date.getTimezoneOffset())

	// e.g: 10/Oct/2000:13:55:36 -0700
	return `${day}/${month}/${year}:${hour}:${minute}:${second} ${offset}`
}

export function accessLog(stream: Writable | null = null) {
	stream ??= process.stdout

	return async function accesslog(ctx: Context, next: Next) {
		await next()

		const length = ctx.length ? ctx.length.toString() : '-'
		const date = toCommonAccessLogDateFormat(new Date())

		// ip, date, method, path, status and length
		stream.write(
			`${ctx.ip} - - [${date}] "${ctx.method} ${ctx.path} HTTP/1.1" ${ctx.status.toFixed(0)} ${length}\n`,
		)
	}
}
