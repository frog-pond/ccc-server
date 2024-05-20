import {get} from '../ccc-lib/http.js'
import {ONE_MINUTE} from '../ccc-lib/constants.js'

import {JSDOM, VirtualConsole} from 'jsdom'
import mem from 'memoize'
import * as Sentry from '@sentry/node'

import {CustomReportType} from './helpers.js'
import {
	ChartJsInstance,
	type ChartJsInstanceType,
	StavReportInstanceSchema,
	type StavReportInstanceType,
	StavReportSchema,
	type StavReportType,
} from './types.js'

const getBonAppPage = mem(get, {maxAge: ONE_MINUTE})

async function getBonAppReportWebpage(url: string | URL) {
	const virtualConsole = new VirtualConsole()
	virtualConsole.sendTo(console, {omitJSDOMErrors: true})
	virtualConsole.on('jsdomError', (err) => {
		let jsdomErrorMessagesToSkip = [
			'Uncaught [ReferenceError: wp is not defined]',
			'Uncaught [ReferenceError: jQuery is not defined]',
			'Uncaught [Error: Create skia surface failed]',
			"Uncaught [TypeError: Cannot read properties of undefined (reading 'slice')]",
			'Not implemented: HTMLCanvasElement.prototype.getContext (without installing the canvas npm package)',
		]
		if (jsdomErrorMessagesToSkip.includes(err.message)) {
			return
		}
		console.error(err)
	})

	const body = await getBonAppPage(url).text()
	return new JSDOM(body, {
		runScripts: 'dangerously',
		resources: 'usable',
		virtualConsole,
		beforeParse(window) {
			window.fetch = global.fetch
		},
	})
}

async function _report(reportUrl: string | URL): Promise<StavReportType> {
	let dom = await getBonAppReportWebpage(reportUrl)

	let domConsole = dom.window['console'] as typeof console
	domConsole.error = (error: string) => {
		let errorMessagesToSkip = ["Failed to create chart: can't acquire context from the given item"]
		if (errorMessagesToSkip.includes(error)) {
			return
		}
		console.error(error)
	}

	domConsole.info = (info: unknown) => {
		let infoMessagesToSkip = [
			'Initialized global navigation scripts',
			'Initialized mobile menu script scripts',
			'Initialized tools navigation scripts',
			'Initialized all javascript that targeted document ready.',
		]
		if (
			(typeof info === 'string' && info.startsWith('Initialized ')) ||
			infoMessagesToSkip.includes(info as string)
		) {
			return
		}
		console.info(info)
	}

	const parse = (chart: ChartJsInstanceType): StavReportInstanceType => {
		const {labels, datasets} = chart.data
		return StavReportInstanceSchema.parse({
			title: datasets[0].label,
			times: labels,
			data: datasets[0].data,
		})
	}

	return new Promise((resolve, _reject) => {
		dom.window.onload = () => {
			const {instances: charts} = dom.window['Chart'] as {
				instances: {labels: string[]; datasets: {label: string; data: number[]}[]}[]
			}

			const payload: StavReportInstanceType[] = Object.values(charts).flatMap((chart) => {
				try {
					return [parse(ChartJsInstance.parse(chart))]
				} catch (err) {
					console.warn(err)
					return []
				}
			})

			resolve(StavReportSchema.parse(payload))
		}
	})
}

export function report(reportUrl: string | URL): Promise<StavReportType> {
	try {
		return _report(reportUrl)
	} catch (err) {
		console.error(err)
		Sentry.isInitialized() && Sentry.captureException(err)
		return Promise.resolve(CustomReportType('Could not load BonApp report'))
	}
}
