import Router from '@koa/router'
import {setupHelpers} from '../ccc-server/helpers.ts'
import * as athletics from './v1/athletics.ts'
import * as calendar from './v1/calendar.ts'
import * as contacts from './v1/contacts.ts'
import * as convos from './v1/convos.ts'
import * as dictionary from './v1/dictionary.ts'
import * as faqs from './v1/faqs.ts'
import * as help from './v1/help.ts'
import * as hours from './v1/hours.ts'
import * as jobs from './v1/jobs.ts'
import * as map from './v1/map.ts'
import * as menus from './v1/menu.ts'
import * as news from './v1/news.ts'
import * as orgs from './v1/orgs.ts'
import * as transit from './v1/transit.ts'
import * as util from './v1/util.ts'
import * as webcams from './v1/webcams.ts'
import * as images from '../ccc-lib/images.ts'
import type {Context, ContextState, RouterState} from '../ccc-server/context.ts'

const api = new Router<RouterState, ContextState>()
setupHelpers(api)

// food
api.get('/v1/food/item/:itemId', menus.bonAppNutrition)
api.get('/v1/food/menu/:cafeId', menus.bonAppMenu)
api.get('/v1/food/cafe/:cafeId', menus.bonAppCafe)

api.get('/v1/food/named/menu/the-pause', menus.pauseMenu)

api.get('/v1/food/named/cafe/stav-hall', menus.stavCafe)
api.get('/v1/food/named/menu/stav-hall', menus.stavMenu)

api.get('/v1/food/named/cafe/the-cage', menus.cageCafe)
api.get('/v1/food/named/menu/the-cage', menus.cageMenu)

api.get('/v1/food/named/cafe/kings-room', menus.kingsRoomCafe)
api.get('/v1/food/named/menu/kings-room', menus.kingsRoomMenu)

api.get('/v1/food/named/cafe/the-cave', menus.caveCafe)
api.get('/v1/food/named/menu/the-cave', menus.caveMenu)

api.get('/v1/food/named/cafe/burton', menus.burtonCafe)
api.get('/v1/food/named/menu/burton', menus.burtonMenu)

api.get('/v1/food/named/cafe/ldc', menus.ldcCafe)
api.get('/v1/food/named/menu/ldc', menus.ldcMenu)

api.get('/v1/food/named/cafe/sayles', menus.saylesCafe)
api.get('/v1/food/named/menu/sayles', menus.saylesMenu)

api.get('/v1/food/named/cafe/weitz', menus.weitzCafe)
api.get('/v1/food/named/menu/weitz', menus.weitzMenu)

api.get('/v1/food/named/cafe/schulze', menus.schulzeCafe)
api.get('/v1/food/named/menu/schulze', menus.schulzeMenu)

// calendar
api.get('/v1/calendar/google', calendar.google)
api.get('/v1/calendar/ics', calendar.ics)
api.get('/v1/calendar/named/carleton', calendar.carleton)
api.get('/v1/calendar/named/the-cave', calendar.cave)
api.get('/v1/calendar/named/stolaf', calendar.stolaf)
api.get('/v1/calendar/named/northfield', calendar.northfield)
api.get('/v1/calendar/named/krlx-schedule', calendar.krlx)
api.get('/v1/calendar/named/ksto-schedule', calendar.ksto)
api.get('/v1/calendar/named/upcoming-convos', calendar.convos)
api.get('/v1/calendar/named/sumo-schedule', calendar.sumo)

// dictionary
api.get('/v1/dictionary', dictionary.dictionary)

// convos
api.get('/v1/convos/upcoming', calendar.convos)
api.get('/v1/convos/upcoming/:id', convos.upcomingDetail)
api.get('/v1/convos/archived', convos.archived)

// important contacts
api.get('/v1/contacts', contacts.contacts)

// help tools
api.get('/v1/tools/help', help.help)

// faqs
api.get('/v1/faqs', faqs.faqs)

// webcams
api.get('/v1/webcams', webcams.webcams)

// images, proxied from the All About Olaf GitHub Pages site
api.get('/v1/images/:group/:name', images.image)

// jobs
api.get('/v1/jobs', jobs.jobs)

// map
api.get('/v1/map', map.map)
api.get('/v1/map/geojson', map.geojson)

// orgs
api.get('/v1/orgs', orgs.orgs)

// news
api.get('/v1/news/rss', news.rss)
api.get('/v1/news/wpjson', news.wpJson)
api.get('/v1/news/named/nnb', news.nnb)
api.get('/v1/news/named/carleton-now', news.carletonNow)
api.get('/v1/news/named/carletonian', news.carletonian)
api.get('/v1/news/named/krlx', news.krlxNews)
api.get('/v1/news/named/covid', news.covidNews)

// hours
api.get('/v1/spaces/hours', hours.buildingHours)

// transit
api.get('/v1/transit/bus', transit.bus)
api.get('/v1/transit/modes', transit.modes)

// utilities
// POST, since the HTML comes in the request body, which fetch will not send
// with a GET; the GET stays for any caller that managed it anyway.
api.post('/v1/util/html-to-md', util.htmlToMarkdown)
api.get('/v1/util/html-to-md', util.htmlToMarkdown)

// athletics
api.get('/v1/athletics/scores', athletics.scores)

// sitemap
api.get('/v1/routes', (ctx: Context) => {
	const mountPrefix = ctx.path.replace(/\/v1\/routes\/?$/i, '')
	const leadingVersionRegex = /^\/v[0-9]+(?:\.[0-9]+)*\//
	ctx.body = api.stack
		.map((layer) => ({
			path: `${mountPrefix}${layer.path.toString()}`,
			displayName: layer.path.toString().replace(leadingVersionRegex, ''),
			params: layer.paramNames.map((param) => param.name),
		}))
		.toSorted((a, b) => a.path.localeCompare(b.path))
})

export {api}
