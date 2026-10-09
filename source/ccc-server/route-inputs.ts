import type {Next} from 'koa'
import {z} from 'zod'
import type {Context} from './context.ts'

/** One thing a route reads from its request, as the sitemap describes it. */
export interface RouteInput {
	name: string
	in: 'path' | 'query'
	required: boolean
	/** The complete set of accepted values. Present only for true enums. */
	values?: {value: string; label?: string}[]
	/** Known-good values for a free-form input. */
	examples?: string[]
	/** A hint for entry: a calendar date, or a whole number. */
	format?: 'date' | 'integer'
}

/** What a handler says about one input; the name and anything inferable are filled in by `listInputs`. */
export type InputDeclaration = Partial<Omit<RouteInput, 'name'>>
export type InputDeclarations = Record<string, InputDeclaration>

/** A route handler, with the inputs it accepts declared beside it. */
export type DeclaredHandler = ((ctx: Context, next: Next) => unknown) & {
	inputs?: InputDeclarations
}

/**
 * An enum from a lookup table's keys, each labelled with its entry when that
 * entry is a name (`261 → stav`); or from a set's members.
 */
export function oneOf(
	table: Readonly<Record<string, unknown>> | ReadonlySet<string>,
): InputDeclaration {
	if (table instanceof Set) {
		// `instanceof` narrows to `Set<any>`; the parameter's type says what it holds
		const members: ReadonlySet<string> = table
		return {values: [...members].map((value) => ({value}))}
	}
	return {
		values: Object.entries(table).map(([value, entry]) =>
			typeof entry === 'string' ? {value, label: entry} : {value},
		),
	}
}

/** A free-form input with values known to work. */
export function examples(...values: string[]): InputDeclaration {
	return {examples: values}
}

/** A JSON Schema property as zod writes one for a query field, whose values are scalars. */
interface JsonProperty {
	type?: string
	enum?: (string | number | boolean)[]
	format?: string
	default?: string | number | boolean
}

/**
 * Query inputs from a zod object, read as a client sends them: `io: 'input'`,
 * since in zod's default output mode a defaulted or transformed field reads as
 * required.
 */
export function fromSchema(schema: z.ZodType): InputDeclarations {
	const json = z.toJSONSchema(schema, {io: 'input'}) as {
		properties?: Record<string, JsonProperty>
		required?: string[]
	}
	const required = new Set(json.required ?? [])
	return Object.fromEntries(
		Object.entries(json.properties ?? {}).map(([name, property]) => {
			const input: InputDeclaration = {in: 'query', required: required.has(name)}
			if (property.enum) input.values = property.enum.map((value) => ({value: String(value)}))
			if (property.format === 'date') input.format = 'date'
			// zod writes `integer` for `z.number().int()`; a field read from a string
			// says so itself, with `.meta({format: 'integer'})`
			if (property.type === 'integer' || property.format === 'integer') input.format = 'integer'
			if (property.default !== undefined) input.examples = [String(property.default)]
			return [name, input]
		}),
	)
}

/**
 * A layer's inputs: each path param, required whatever was declared, with its
 * declaration merged on; then any other declared name, as a query input.
 */
export function listInputs(paramNames: string[], declared: InputDeclarations = {}): RouteInput[] {
	const path = paramNames.map((name): RouteInput => ({
		...declared[name],
		name,
		in: 'path',
		required: true,
	}))
	const query = Object.entries(declared)
		.filter(([name]) => !paramNames.includes(name))
		.map(([name, declaration]): RouteInput => ({
			...declaration,
			name,
			in: 'query',
			required: declaration.required ?? false,
		}))
	return [...path, ...query]
}
