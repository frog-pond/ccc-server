import zodRouter from 'koa-zod-router'

import * as calendar from './calendar.js'
import * as contacts from './contacts.js'
import * as dictionary from './dictionary.js'
import * as convocations from './convos.js'
import * as faqs from './faqs.js'
import * as help from './help.js'
import * as hours from './hours.js'
import * as jobs from './jobs.js'
import * as map from './map.js'
import * as menus from './menu.js'
import * as news from './news.js'
import * as orgs from './orgs.js'
import * as transit from './transit.js'
import * as util from './util.js'
import * as webcams from './webcams.js'
import {getJobsRoute} from './jobs.js'
import {getStudentOrgsRoute} from './orgs.js'

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

// important contacts
api.register(contacts.getContactsRoute)

// dictionary
api.register(dictionary.getDictionaryRoute)

// convos
api.register(convocations.getUpcomingConvocations)
api.register(convocations.getConvocationDetail)
api.register(convocations.getArchivedConvocations)

// help tools
api.register(help.getHelpRoute)

// faqs
api.register(faqs.getFaqsRoute)

// webcams
api.register(webcams.getWebcamsRoute)

// jobs
api.register(jobs.getJobsRoute)

// map
api.register(map.getMapRoute)
api.register(map.getMapGeoJsonRoute)

// orgs
api.register(orgs.getStudentOrgsRoute)

// news
api.register(news.getRssFeedRoute)
api.register(news.getWpJsonFeedRoute)
api.register(news.getNoonNewsBulletinRoute)
api.register(news.getKnownFeedRoute)

// hours
api.register(hours.getBuildingHoursRoute)

// transit
api.get('/transit/bus', transit.bus)
api.get('/transit/modes', transit.modes)

// utilities
api.get('/util/html-to-md', util.htmlToMarkdown)

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
