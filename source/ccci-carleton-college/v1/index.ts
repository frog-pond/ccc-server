import zodRouter from 'koa-zod-router'

import * as calendar from './calendar.js'
import * as contacts from './contacts.js'
/*
import * as convocations from './convos.js'
import * as dictionary from './dictionary.js'
import * as faqs from './faqs.js'
import * as help from './help.js'
import * as hours from './hours.js'
import * as jobs from './jobs.js'
import * as map from './map.js'*/
import * as menus from './menu.js'
/*import * as news from './news.js'
import * as orgs from './orgs.js'
import * as transit from './transit.js'
import * as util from './util.js'
import * as webcams from './webcams.js'
*/

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

/*
// dictionary
api.get('/dictionary', dictionary.dictionary)

// convos
api.get('/convos/upcoming', calendar.convos)
api.get('/convos/upcoming/:id', convocations.upcomingDetail)
api.get('/convos/archived', convocations.archived)

// help tools
api.get('/tools/help', help.help)

// faqs
api.get('/faqs', faqs.faqs)

// webcams
api.get('/webcams', webcams.webcams)

// jobs
api.get('/jobs', jobs.jobs)

// map
api.get('/map', map.map)
api.get('/map/geojson', map.geojson)

// orgs
api.get('/orgs', orgs.orgs)

// news
api.get('/news/rss', news.rss)
api.get('/news/wpjson', news.wpJson)
api.get('/news/named/nnb', news.nnb)
api.get('/news/named/carleton-now', news.carletonNow)
api.get('/news/named/carletonian', news.carletonian)
api.get('/news/named/krlx', news.krlxNews)
api.get('/news/named/covid', news.covidNews)

// hours
api.get('/spaces/hours', hours.buildingHours)

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
			path: layer.path,
			displayName: layer.path.split(leadingVersionRegex).slice(1).join(),
			params: layer.paramNames.map((param) => param.name),
		}))
		.sort((a, b) => a.path.localeCompare(b.path))
})
*/
