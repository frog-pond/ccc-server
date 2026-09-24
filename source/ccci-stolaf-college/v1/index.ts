import {Hono} from 'hono'
import {bodyLimit} from 'hono/body-limit'
import {FIVE_MINUTES, ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {cacheFor} from '../../ccc-worker/cache.ts'
import type {AppEnv} from '../../ccc-worker/env.ts'
import {listRoutes} from '../../ccc-worker/routes.ts'
import * as athletics from './athletics.ts'
import * as calendar from './calendar.ts'
import * as contacts from './contacts.ts'
import * as departments from './departments.ts'
import * as deprecated from './deprecated.ts'
import * as dictionary from './dictionary.ts'
import * as faqs from './faqs.ts'
import * as help from './help.ts'
import * as hours from './hours.ts'
import * as majors from './majors.ts'
import * as map from './map.ts'
import * as menus from './menu.ts'
import * as news from './news.ts'
import * as orgs from './orgs.ts'
import * as printing from './printing.ts'
import * as reports from './reports.ts'
import * as sources from './sources.ts'
import * as streams from './streams.ts'
import * as transit from './transit.ts'
import * as util from './util.ts'
import * as webcams from './webcams.ts'

const ORGS_TTL = ONE_HOUR * 36

const api = new Hono<AppEnv>().basePath('/v1')

// food
api.get('/food/item/:itemId', cacheFor(ONE_HOUR), menus.bonAppNutrition)
api.get('/food/menu/:cafeId', cacheFor(ONE_HOUR), menus.bonAppMenu)
api.get('/food/cafe/:cafeId', cacheFor(ONE_HOUR), menus.bonAppCafe)

api.get('/food/named/menu/the-pause', cacheFor(ONE_HOUR), menus.pauseMenu)

api.get('/food/named/cafe/stav-hall', cacheFor(ONE_HOUR), menus.stavCafe)
api.get('/food/named/menu/stav-hall', cacheFor(ONE_HOUR), menus.stavMenu)

api.get('/food/named/cafe/the-cage', cacheFor(ONE_HOUR), menus.cageCafe)
api.get('/food/named/menu/the-cage', cacheFor(ONE_HOUR), menus.cageMenu)

api.get('/food/named/cafe/kings-room', cacheFor(ONE_HOUR), menus.kingsRoomCafe)
api.get('/food/named/menu/kings-room', cacheFor(ONE_HOUR), menus.kingsRoomMenu)

api.get('/food/named/cafe/the-cave', cacheFor(ONE_HOUR), menus.caveCafe)
api.get('/food/named/menu/the-cave', cacheFor(ONE_HOUR), menus.caveMenu)

api.get('/food/named/cafe/burton', cacheFor(ONE_HOUR), menus.burtonCafe)
api.get('/food/named/menu/burton', cacheFor(ONE_HOUR), menus.burtonMenu)

api.get('/food/named/cafe/ldc', cacheFor(ONE_HOUR), menus.ldcCafe)
api.get('/food/named/menu/ldc', cacheFor(ONE_HOUR), menus.ldcMenu)

api.get('/food/named/cafe/sayles', cacheFor(ONE_HOUR), menus.saylesCafe)
api.get('/food/named/menu/sayles', cacheFor(ONE_HOUR), menus.saylesMenu)

api.get('/food/named/cafe/weitz', cacheFor(ONE_HOUR), menus.weitzCafe)
api.get('/food/named/menu/weitz', cacheFor(ONE_HOUR), menus.weitzMenu)

api.get('/food/named/cafe/schulze', cacheFor(ONE_HOUR), menus.schulzeCafe)
api.get('/food/named/menu/schulze', cacheFor(ONE_HOUR), menus.schulzeMenu)

// calendar
api.get('/calendar/google', cacheFor(ONE_MINUTE), calendar.google)
api.get('/calendar/ics', cacheFor(ONE_MINUTE), calendar.ics)
api.get('/calendar/named/stolaf', cacheFor(ONE_MINUTE), calendar.stolaf)
api.get('/calendar/named/oleville', cacheFor(ONE_DAY), deprecated.olevilleCalendar)
api.get('/calendar/named/northfield', cacheFor(ONE_MINUTE), calendar.northfield)
api.get('/calendar/named/krlx-schedule', cacheFor(ONE_MINUTE), calendar.krlx)
api.get('/calendar/named/ksto-schedule', cacheFor(ONE_MINUTE), calendar.ksto)

// a-to-z — St. Olaf's WordPress blocks this server's IP; the app fetches it
// directly now.
api.get('/a-to-z', cacheFor(ONE_DAY), deprecated.atoz)

// sources
api.get('/sources', cacheFor(ONE_DAY), sources.sources)

// dictionary
api.get('/dictionary', cacheFor(ONE_DAY), dictionary.dictionary)

// directory
api.get('/directory/departments', cacheFor(ONE_DAY), departments.departments)
api.get('/directory/majors', cacheFor(ONE_DAY), majors.majors)

// important contacts
api.get('/contacts', cacheFor(ONE_DAY), contacts.contacts)

// help tools
api.get('/tools/help', cacheFor(ONE_DAY), help.help)

// faqs
api.get('/faqs', cacheFor(ONE_DAY), faqs.faqs)

// webcams
api.get('/webcams', cacheFor(ONE_DAY), webcams.webcams)

// jobs
api.get('/jobs', cacheFor(ONE_DAY), deprecated.jobs)

// map
api.get('/map', cacheFor(ONE_HOUR), map.map)
api.get('/map/geojson', cacheFor(ONE_HOUR), map.geojson)

// orgs
api.get('/orgs', cacheFor(ORGS_TTL), orgs.orgs)
api.get('/orgs/categories', cacheFor(ORGS_TTL), orgs.orgCategories)

// news
api.get('/news/rss', cacheFor(ONE_HOUR), news.rss)
api.get('/news/wpjson', cacheFor(ONE_HOUR), news.wpJson)
api.get('/news/named/stolaf', cacheFor(ONE_HOUR), news.stolaf)
api.get('/news/named/oleville', cacheFor(ONE_HOUR), news.oleville)
api.get('/news/named/politicole', cacheFor(ONE_HOUR), news.politicole)
api.get('/news/named/mess', cacheFor(ONE_HOUR), news.mess)
api.get('/news/named/ksto', cacheFor(ONE_HOUR), news.ksto)
api.get('/news/named/krlx', cacheFor(ONE_HOUR), news.krlx)

// hours
api.get('/spaces/hours', cacheFor(ONE_HOUR), hours.buildingHours)

// transit
api.get('/transit/bus', cacheFor(ONE_HOUR), transit.bus)
api.get('/transit/modes', cacheFor(ONE_HOUR), transit.modes)

// streams
api.get('/streams/archived', cacheFor(ONE_HOUR), streams.archived)
api.get('/streams/upcoming', cacheFor(ONE_HOUR), streams.upcoming)

// stoprint
api.get('/printing/color-printers', cacheFor(ONE_DAY), printing.colorPrinters)

// reports
api.get('/reports/stav', cacheFor(ONE_HOUR), reports.stavMealtimeReport)

// utilities
api.get('/util/html-to-md', bodyLimit({maxSize: 100 * 1024}), util.htmlToMarkdown)

// athletics
api.get('/athletics/scores', cacheFor(FIVE_MINUTES), athletics.scores)

// sitemap
api.get('/routes', (c) => c.json(listRoutes(api)))

export {api}
