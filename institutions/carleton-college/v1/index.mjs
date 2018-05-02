import koaBody from 'koa-bodyparser'
import apollo from 'apollo-server-koa'
import {schema} from './graphql'

import Router from 'koa-router'
import {menu, pauseMenu, cafe} from './menu'
import * as calendar from './calendar'
import {dictionary} from './dictionary'
import {jobs} from './jobs'
import * as convos from './convos'
import {hours} from './hours'
import {nnb} from './news'

const {graphqlKoa, graphiqlKoa} = apollo
const api = new Router({prefix: '/v1'})

// food
api.get('/food/pause/menu', pauseMenu)
api.get('/food/menu/:cafeId', menu)
api.get('/food/cafe/:cafeId', cafe)

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
api.get('/dictionary', dictionary)

// jobs
api.get('/convos/upcoming', calendar.convos)
api.get('/convos/archived', convos.archived)

// jobs
api.get('/jobs', jobs)

// news
api.get('/news/nnb', nnb)
// api.get('/news/carleton-now', carletonNow)
// api.get('/news/carletonian', carletonian)
// api.get('/news/krlx', krlxNews)

// hours
api.get('/spaces/hours', hours)

// graphql
api.post('/graphql', koaBody(), graphqlKoa({schema}))
api.get('/graphql', graphqlKoa({schema}))
api.get('/graphiql', graphiqlKoa({endpointURL: '/v1/graphql'}))

export {api as v1}
