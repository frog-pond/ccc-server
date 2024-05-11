import Router from 'koa-router'

export type Route = Router.IMiddleware<
	unknown,
	{cacheControl: (n: number) => unknown}
>

export type Context = Parameters<Route>[0]
