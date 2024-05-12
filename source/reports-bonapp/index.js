import {get} from '../ccc-lib/http.js'
import {ONE_MINUTE} from '../ccc-lib/constants.js'

import {JSDOM, VirtualConsole} from 'jsdom'
import mem from 'memoize'
import * as Sentry from '@sentry/node'

import {StavReportType} from './types.js'

const getBonAppPage = mem(get, {maxAge: ONE_MINUTE})

const NUMBER_OF_CHARTS_TO_PARSE = 7

/**
 * @param {string|URL} url
 * @return {Promise<JSDOM>}
 */
async function getBonAppReportWebpage(url) {
	const virtualConsole = new VirtualConsole()
	virtualConsole.sendTo(console, {omitJSDOMErrors: true})
	virtualConsole.on('jsdomError', (err) => {
		let jsdomErrorMessagesToSkip = [
			'Uncaught [ReferenceError: wp is not defined]',
			'Uncaught [ReferenceError: jQuery is not defined]',
			'Uncaught [Error: Create skia surface failed]',
			"Uncaught [TypeError: Cannot read properties of undefined (reading 'slice')]",
			"Failed to create chart: can't acquire context from the given item",
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
		}
	})
}

/**
 * @param {string|URL} reportUrl
 * @returns {Promise<StavReportType>}
 */
async function _report(reportUrl) {
	let dom = await getBonAppReportWebpage(reportUrl)

	dom.window.console.info = ((info) => { 
		let infoMessagesToSkip = [
			'Initialized global navigation scripts',
			'Initialized mobile menu script scripts',
			'Initialized tools navigation scripts',
			'Initialized all javascript that targeted document ready.',
		]
		if (infoMessagesToSkip.includes(info)) {
			return
		}
		console.info(info)
	})

	dom.window.onload = () => {
		const charts = dom.window.Chart.instances

		const parse = (chart) => {
			const {labels, datasets} = chart.data
			return {
				title: datasets[0].label,
				times: labels,
				data: datasets[0].data,
			}
		}

		const payload = []

		for(let i=0; i<NUMBER_OF_CHARTS_TO_PARSE; ++i) {
			try {
				payload.push(parse(charts[i]))
			} catch (err) {
				console.warn({error: err.message})
			}
		}

		// TODO: we have data here but we can't return it back fast enough
		// while in the dom.window.onload callback to the `report` function
		console.log(StavReportType.parse(payload))

		return StavReportType.parse(payload)
	}
}

/**
 * @param {string|URL} reportUrl
 * @returns {Promise<StavReportType>}
 */
export function report(reportUrl) {
	try {
		return _report(reportUrl)
	} catch (err) {
		console.error(err)
		Sentry.isInitialized() && Sentry.captureException(err)
		return CustomCafe({message: 'Could not load BonApp report'})
	}
}
