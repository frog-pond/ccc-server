import type {RouterMiddleware} from '@koa/router'
import type {ExtendableContext} from 'koa'

export type RouterState = unknown
export type Route = RouterMiddleware<RouterState, ExtendableContext>

export type ContextState = ExtendableContext
export type Context = Parameters<Route>[0]
