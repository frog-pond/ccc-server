import type Router from '@koa/router'
import type {DefaultState} from 'koa'

export type RouterState = DefaultState
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ContextState = {cacheControl: (n: number) => unknown}
export type Route = Router.Middleware<unknown, ContextState>

export type Context = Parameters<Route>[0]
