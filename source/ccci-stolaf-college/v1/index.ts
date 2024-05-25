import zodRouter from 'koa-zod-router'

import * as atoz from './a-z.js'
import * as calendar from './calendar.js'
import * as contacts from './contacts.js'
import * as directory from './directory.js'
import * as dictionary from './dictionary.js'
import * as faqs from './faqs.js'
import * as help from './help.js'
import * as hours from './hours.js'
import * as jobs from './jobs.js'
import * as menus from './menu.js'
import * as news from './news.js'
import * as orgs from './orgs.js'
import * as printing from './printing.js'
import * as reports from './reports.js'
import * as streams from './streams.js'
import * as transit from './transit.js'
import * as util from './util.js'
import * as webcams from './webcams.js'

export const api = zodRouter({
	zodRouter: {exposeRequestErrors: true, exposeResponseErrors: true},
	koaRouter: {prefix: '/v1'},
})

// food
api.register(menus.getBonAppItemNutritionRoute)
api.register(menus.getBonAppMenuRoute)
api.register(menus.getBonAppCafeRoute)
api.register(menus.getNamedMenuRoute)
api.register(menus.getNamedCafeRoute)

// calendar
api.register(calendar.getGoogleCalendarRoute)
api.register(calendar.getInternetCalendarRoute)
api.register(calendar.getKnownCalendarRoute)

// a-to-z
api.register(atoz.getAToZRoute)

// dictionary
api.register(dictionary.getDictionaryRoute)

// directory
api.register(directory.getDepartmentsRoute)
api.register(directory.getMajorsRoute)

// important contacts
api.register(contacts.getContactsRoute)

// help tools
api.register(help.getHelpRoute)

// faqs
api.register(faqs.getFaqsRoute)

// webcams
api.register(webcams.getWebcamsRoute)

// jobs
api.register(jobs.getJobsRoute)

// orgs
api.register(orgs.getStudentOrgsRoute)

// news
api.register(news.getRssFeedRoute)
api.register(news.getWpJsonFeedRoute)
api.register(news.getKnownFeedRoute)

// hours
api.register(hours.getBuildingHoursRoute)

// transit
api.register(transit.getBusTimesRoute)
api.register(transit.getTransitModesRoute)

// streams
api.register(streams.getArchivedRoute)
api.register(streams.getUpcomingRoute)

// stoprint
api.register(printing.getColorPrintersRoute)

// reports
api.get('/reports/stav', reports.stavMealtimeReport)

// utilities
api.register(util.htmlToMarkdownRoute)

// sitemap
api.get('/routes', (ctx) => {
	const leadingVersionRegex = /\/v[0-9]\//
	ctx.body = api.stack
		.map((layer) => ({
			path: layer.path.toString(),
			displayName: layer.path.toString().split(leadingVersionRegex).slice(1).join(),
			params: layer.paramNames.map((param) => param.name),
		}))
		.sort((a, b) => a.path.localeCompare(b.path))
})
