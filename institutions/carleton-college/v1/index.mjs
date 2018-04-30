import koaBody from 'koa-bodyparser'
import apollo from 'apollo-server-koa'
import {schema} from './graphql'

import Router from 'koa-router'
import {menu, pauseMenu, cafe} from './menu'
import {dictionary} from './dictionary'
import {jobs} from './jobs'
import {hours} from './hours'
import {nnb} from './news'

const {graphqlKoa, graphiqlKoa} = apollo
const api = new Router({prefix: '/v1'})

// food
api.get('/food/pause/menu', pauseMenu)
api.get('/food/menu/:cafeId', menu)
api.get('/food/cafe/:cafeId', cafe)

// dictionary
api.get('/dictionary', dictionary)

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
api.get('/graphiql', graphiqlKoa({endpointURL: '/api/v1/graphql'}))

export {api as v1}
