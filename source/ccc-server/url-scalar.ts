import {GraphQLScalarType, Kind} from 'graphql'

export const URLScalar = new GraphQLScalarType({
	name: 'URL',
	description: 'A URL, represented as a string.',

	serialize(value: unknown): string {
		if (value instanceof URL) {
			return value.toString()
		}
		throw new Error('URLScalar can only serialize URL objects')
	},

	parseValue(value: unknown): URL {
		if (typeof value !== 'string') {
			throw new Error('URLScalar can only parse string values')
		}
		try {
			return new URL(value)
		} catch (error) {
			throw new Error('Invalid URL format')
		}
	},

	parseLiteral(ast): URL {
		if (ast.kind !== Kind.STRING) {
			throw new Error('URLScalar can only parse string literals')
		}
		try {
			return new URL(ast.value)
		} catch (error) {
			throw new Error('Invalid URL format')
		}
	},
})
