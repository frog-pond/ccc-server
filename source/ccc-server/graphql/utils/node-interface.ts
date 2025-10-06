import {fromGlobalId, nodeDefinitions} from 'graphql-relay'
import {z, type ZodObject, type ZodRawShape, type ZodTypeAny} from 'zod'

export type KnownGraphQLTypeNames = 'Contact' | 'DictionaryDefinition'

export interface NodeTypeInfo<T extends ZodTypeAny> {
	schema: T
	fetcher: (id: string) => Promise<z.infer<T> | null>
}

const typeInfoRegistry: {
	[key in KnownGraphQLTypeNames]?: NodeTypeInfo<ZodObject<ZodRawShape>>
} = {}

export function registerType<T extends ZodObject<ZodRawShape>>(
	name: KnownGraphQLTypeNames,
	info: NodeTypeInfo<T>,
) {
	typeInfoRegistry[name] = info
}

function getObject(globalId: string): Promise<object | null> {
	const {type, id} = fromGlobalId(globalId)
	const info = typeInfoRegistry[type as KnownGraphQLTypeNames]
	if (info) {
		return info.fetcher(id)
	}
	return Promise.resolve(null)
}

function resolveNodeType(obj: object): KnownGraphQLTypeNames | undefined {
	for (const name in typeInfoRegistry) {
		if (Object.prototype.hasOwnProperty.call(typeInfoRegistry, name)) {
			const info = typeInfoRegistry[name as KnownGraphQLTypeNames]
			if (info?.schema.safeParse(obj).success) {
				return name as KnownGraphQLTypeNames
			}
		}
	}
	return undefined
}

export const {nodeInterface, nodeField} = nodeDefinitions(getObject, resolveNodeType)
