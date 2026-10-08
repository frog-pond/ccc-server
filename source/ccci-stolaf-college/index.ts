import Router from '@koa/router'
import {setupHelpers} from '../ccc-server/helpers.ts'
import * as appData from './v1/app-data.ts'
import * as athletics from './v1/athletics.ts'
import * as calendar from './v1/calendar.ts'
import * as contacts from './v1/contacts.ts'
import * as departments from './v1/departments.ts'
import * as courses from './v1/courses.ts'
import * as deprecated from './v1/deprecated.ts'
import * as dictionary from './v1/dictionary.ts'
import * as faqs from './v1/faqs.ts'
import * as help from './v1/help.ts'
import * as hours from './v1/hours.ts'
import * as majors from './v1/majors.ts'
import * as map from './v1/map.ts'
import * as menus from './v1/menu.ts'
import * as mess from './v1/mess.ts'
import * as news from './v1/news.ts'
import * as orgs from './v1/orgs.ts'
import * as printing from './v1/printing.ts'
import * as reports from './v1/reports.ts'
import * as sources from './v1/sources.ts'
import * as streams from './v1/streams.ts'
import * as studentWork from './v1/student-work.ts'
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
api.get('/v1/calendar/named/stolaf', calendar.stolaf)
api.get('/v1/calendar/named/oleville', deprecated.olevilleCalendar)
api.get('/v1/calendar/named/northfield', calendar.northfield)
api.get('/v1/calendar/named/krlx-schedule', calendar.krlx)
api.get('/v1/calendar/named/ksto-schedule', calendar.ksto)

// a-to-z — St. Olaf's WordPress blocks this server's IP; the app fetches it
// directly now.
api.get('/v1/a-to-z', deprecated.atoz)
api.get('/v1/a-to-z/extras', appData.aToZExtras)

// sources
api.get('/v1/sources', sources.sources)

// dictionary
api.get('/v1/dictionary', dictionary.dictionary)

// directory
api.get('/v1/directory/departments', departments.departments)
api.get('/v1/directory/majors', majors.majors)

// important contacts
api.get('/v1/contacts', contacts.contacts)

// help tools
api.get('/v1/tools/help', help.help)

// faqs
api.get('/v1/faqs', faqs.faqs)

// webcams
api.get('/v1/webcams', webcams.webcams)

// images, proxied from GitHub Pages
api.get('/v1/images/:group/:name', images.image)

// jobs
api.get('/v1/jobs', deprecated.jobs)

// map
api.get('/v1/map', map.map)
api.get('/v1/map/geojson', map.geojson)
api.get('/v1/map/categories', appData.mapCategories)
api.get('/v1/map/style', map.styleLight)
api.get('/v1/map/style-dark', map.styleDark)

// orgs
api.get('/v1/orgs', orgs.orgs)
api.get('/v1/orgs/categories', orgs.orgCategories)
api.get('/v1/orgs/category-styles', appData.orgCategoryStyles)
api.get('/v1/orgs/uri/:uri', orgs.org)
api.get('/v1/student-work/units', studentWork.units)
api.get('/v1/student-work/areas', appData.studentWorkAreas)
api.get('/v1/student-work/wages', appData.studentWorkWages)

// courses
api.get('/v1/courses/catalog.db', courses.catalog)

// news
api.get('/v1/news/rss', news.rss)
api.get('/v1/news/wpjson', news.wpJson)
api.get('/v1/news/named/stolaf', news.stolaf)
api.get('/v1/news/named/oleville', news.oleville)
api.get('/v1/news/named/politicole', news.politicole)
api.get('/v1/news/named/mess', news.mess)
api.get('/v1/news/named/ksto', news.ksto)
api.get('/v1/news/named/krlx', news.krlx)

// the Olaf Messenger's WordPress API, cached, for the app's Messenger reader
api.get('/v1/news/mess/wp/v2/:resource', mess.wordpress)
api.get('/v1/news/mess/wp/v2/:resource/:id', mess.wordpress)

// hours
api.get('/v1/spaces/hours', hours.buildingHours)
api.get('/v1/spaces/directory', hours.campusDirectory)

// transit
api.get('/v1/transit/bus', transit.bus)
api.get('/v1/transit/modes', transit.modes)

// streams
api.get('/v1/streams/archived', streams.archived)
api.get('/v1/streams/upcoming', streams.upcoming)
api.get('/v1/streams/search', streams.search)

// stoprint
api.get('/v1/printing/color-printers', printing.colorPrinters)

// reports
api.get('/v1/reports/stav', reports.stavMealtimeReport)

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
