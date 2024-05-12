import type Router from 'koa-router'

export type RouterState = unknown
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ContextState = {cacheControl: (n: number) => unknown}
export type Route = Router.IMiddleware<RouterState, ContextState>

export type Context = Parameters<Route>[0]
