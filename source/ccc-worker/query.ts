import {HTTPException} from 'hono/http-exception'
import type {Context} from './env.ts'

export function requireQuery(c: Context, name: string): string {
	let value = c.req.query(name)
	if (!value) {
		throw new HTTPException(400, {message: `?${name} is required`})
	}
	return value
}
