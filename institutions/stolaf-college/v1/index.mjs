import koaBody from 'koa-bodyparser'
import apollo from 'apollo-server-koa'
import {schema} from './graphql'

import Router from 'koa-router'
import {menu, pauseMenu, cafe} from './menu'
import {dictionary} from './dictionary'
import {jobs} from './jobs'
import {departments} from './departments'
import {majors} from './majors'
import {hours} from './hours'

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

// directory
api.get('/directory/departments', departments)
api.get('/directory/majors', majors)

// hours
api.get('/spaces/hours', hours)

// graphql
api.post('/graphql', koaBody(), graphqlKoa({schema}))
api.get('/graphql', graphqlKoa({schema}))
api.get('/graphiql', graphiqlKoa({endpointURL: '/api/v1/graphql'}))

export {api as v1}