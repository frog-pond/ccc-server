import koaBody from 'koa-bodyparser'
import apollo from 'apollo-server-koa'
import {schema} from './graphql'

import Router from 'koa-router'
import * as menus from './menu'
import * as calendar from './calendar'
import * as dictionary from './dictionary'
import * as jobs from './jobs'
import * as convos from './convos'
import * as hours from './hours'
import * as news from './news'

const {graphqlKoa, graphiqlKoa} = apollo
const api = new Router({prefix: '/v1'})

// food
// food:bonapp
api.get('/food/menu/:cafeId', menus.bonAppMenu)
api.get('/food/cafe/:cafeId', menus.bonAppCafe)

api.get('/food/named/menu/the-pause', menus.pauseMenu)

api.get('/food/named/cafe/stav-hall', menus.stavCafe)
api.get('/food/named/menu/stav-hall', menus.stavMenu)

api.get('/food/named/cafe/the-cage', menus.cageCafe)
api.get('/food/named/menu/the-cage', menus.cageMenu)

api.get('/food/named/cafe/kings-room', menus.kingsRoomCafe)
api.get('/food/named/menu/kings-room', menus.kingsRoomMenu)

api.get('/food/named/cafe/burton', menus.burtonCafe)
api.get('/food/named/menu/burton', menus.burtonMenu)

api.get('/food/named/cafe/ldc', menus.ldcCafe)
api.get('/food/named/menu/ldc', menus.ldcMenu)

api.get('/food/named/cafe/sayles', menus.saylesCafe)
api.get('/food/named/menu/sayles', menus.saylesMenu)

api.get('/food/named/cafe/weitz', menus.weitzCafe)
api.get('/food/named/menu/weitz', menus.weitzMenu)

// calendar
api.get('/calendar/google', calendar.google)
api.get('/calendar/reason', calendar.reason)
api.get('/calendar/ics', calendar.ics)
api.get('/calendar/named/carleton', calendar.carleton)
api.get('/calendar/named/the-cave', calendar.cave)
api.get('/calendar/named/stolaf', calendar.stolaf)
api.get('/calendar/named/northfield', calendar.northfield)
api.get('/calendar/named/krlx-schedule', calendar.krlx)
api.get('/calendar/named/ksto-schedule', calendar.ksto)
api.get('/calendar/named/upcoming-convos', calendar.convos)
api.get('/calendar/named/sumo-schedule', calendar.sumo)

// dictionary
api.get('/dictionary', dictionary.dictionary)

// jobs
api.get('/convos/upcoming', calendar.convos)
api.get('/convos/archived', convos.archived)

// jobs
api.get('/jobs', jobs.jobs)

// news
api.get('/news/rss', news.rss)
api.get('/news/wpjson', news.wpJson)
api.get('/news/named/nnb', news.nnb)
api.get('/news/named/carleton-now', news.carletonNow)
api.get('/news/named/carletonian', news.carletonian)
api.get('/news/named/krlx', news.krlxNews)

// hours
api.get('/spaces/hours', hours.hours)

// graphql
api.post('/graphql', koaBody(), graphqlKoa({schema}))
api.get('/graphql', graphqlKoa({schema}))
api.get('/graphiql', graphiqlKoa({endpointURL: '/v1/graphql'}))

export {api as v1}
