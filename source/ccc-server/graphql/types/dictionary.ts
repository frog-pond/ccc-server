import {GraphQLID, GraphQLNonNull, GraphQLObjectType, GraphQLString} from 'graphql'
import {toGlobalId} from 'graphql-relay'
import {z} from 'zod'
import {get} from '../../../ccc-lib/http.js'
import {GH_PAGES} from '../../../ccci-stolaf-college/v1/gh-pages.js'
import DataLoader from 'dataloader'
import {nodeInterface, type NodeTypeInfo} from '../utils/node-interface.js'

const DictionaryDefinitionSchema = z.object({
	word: z.string(),
	definition: z.string(),
})

type DictionaryDefinition = z.infer<typeof DictionaryDefinitionSchema>

interface DictionaryDefinitionResponse {
	data: DictionaryDefinition[]
}

export const dictionaryLoader = new DataLoader<string, DictionaryDefinition[]>(async (keys) => {
	const dictionary = await Promise.all(
		keys.map((key) => get(GH_PAGES(key)).json<DictionaryDefinitionResponse>()),
	)
	return dictionary.map((entry) => entry.data)
})

export const DictionaryDefinitionType = new GraphQLObjectType<DictionaryDefinition, unknown>({
	name: 'DictionaryDefinition',
	fields: {
		id: {
			type: new GraphQLNonNull(GraphQLID),
			resolve: (def) => toGlobalId('DictionaryDefinition', def.word),
		},
		word: {type: new GraphQLNonNull(GraphQLString)},
		definition: {type: new GraphQLNonNull(GraphQLString)},
	},
	interfaces: [nodeInterface],
})

export const dictionaryTypeInfo: NodeTypeInfo<typeof DictionaryDefinitionSchema> = {
	schema: DictionaryDefinitionSchema,
	fetcher: async (id: string) => {
		const definitions = await dictionaryLoader.load('dictionary.json')
		return definitions.find((d) => d.word === id) ?? null
	},
}
