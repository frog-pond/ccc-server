import Router from 'koa-router'
import * as atoz from './a-z.js'
import * as calendar from './calendar.js'
import * as contacts from './contacts.js'
import * as departments from './departments.js'
import * as dictionary from './dictionary.js'
import * as faqs from './faqs.js'
import * as help from './help.js'
import * as hours from './hours.js'
import * as jobs from './jobs.js'
import * as majors from './majors.js'
import * as menus from './menu.js'
import * as news from './news.js'
import * as orgs from './orgs.js'
import * as printing from './printing.js'
import * as reports from './reports.js'
import * as streams from './streams.js'
import * as transit from './transit.js'
import * as util from './util.js'
import * as webcams from './webcams.js'

const api = new Router({prefix: '/v1'})

// food
api.get('/food/item/:itemId', menus.bonAppNutrition)
api.get('/food/menu/:cafeId', menus.bonAppMenu)
api.get('/food/cafe/:cafeId', menus.bonAppCafe)

api.get('/food/named/menu/the-pause', menus.pauseMenu)

api.get('/food/named/cafe/stav-hall', menus.stavCafe)
api.get('/food/named/menu/stav-hall', menus.stavMenu)

api.get('/food/named/cafe/the-cage', menus.cageCafe)
api.get('/food/named/menu/the-cage', menus.cageMenu)

api.get('/food/named/cafe/kings-room', menus.kingsRoomCafe)
api.get('/food/named/menu/kings-room', menus.kingsRoomMenu)

api.get('/food/named/cafe/the-cave', menus.caveCafe)
api.get('/food/named/menu/the-cave', menus.caveMenu)

api.get('/food/named/cafe/burton', menus.burtonCafe)
api.get('/food/named/menu/burton', menus.burtonMenu)

api.get('/food/named/cafe/ldc', menus.ldcCafe)
api.get('/food/named/menu/ldc', menus.ldcMenu)

api.get('/food/named/cafe/sayles', menus.saylesCafe)
api.get('/food/named/menu/sayles', menus.saylesMenu)

api.get('/food/named/cafe/weitz', menus.weitzCafe)
api.get('/food/named/menu/weitz', menus.weitzMenu)

api.get('/food/named/cafe/schulze', menus.schulzeCafe)
api.get('/food/named/menu/schulze', menus.schulzeMenu)

// calendar
api.get('/calendar/google', calendar.google)
api.get('/calendar/ics', calendar.ics)
api.get('/calendar/named/stolaf', calendar.stolaf)
api.get('/calendar/named/oleville', calendar.oleville)
api.get('/calendar/named/northfield', calendar.northfield)
api.get('/calendar/named/krlx-schedule', calendar.krlx)
api.get('/calendar/named/ksto-schedule', calendar.ksto)

// a-to-z
api.get('/a-to-z', atoz.atoz)

// dictionary
api.get('/dictionary', dictionary.dictionary)

// directory
api.get('/directory/departments', departments.departments)
api.get('/directory/majors', majors.majors)

// important contacts
api.get('/contacts', contacts.contacts)

// help tools
api.get('/tools/help', help.help)

// faqs
api.get('/faqs', faqs.faqs)

// webcams
api.get('/webcams', webcams.webcams)

// jobs
api.get('/jobs', jobs.jobs)

// orgs
api.get('/orgs', orgs.orgs)

// news
api.get('/news/rss', news.rss)
api.get('/news/wpjson', news.wpJson)
api.get('/news/named/stolaf', news.stolaf)
api.get('/news/named/oleville', news.oleville)
api.get('/news/named/politicole', news.politicole)
api.get('/news/named/mess', news.mess)
api.get('/news/named/ksto', news.ksto)
api.get('/news/named/krlx', news.krlx)

// hours
api.get('/spaces/hours', hours.buildingHours)

// transit
api.get('/transit/bus', transit.bus)
api.get('/transit/modes', transit.modes)

// streams
api.get('/streams/archived', streams.archived)
api.get('/streams/upcoming', streams.upcoming)

// stoprint
api.get('/printing/color-printers', printing.colorPrinters)

// reports
api.get('/reports/stav', reports.stavMealtimeReport)

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

export {api}
