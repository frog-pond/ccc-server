import {createHandler} from 'graphql-http/lib/use/koa'
import {GraphQLObjectType, GraphQLSchema, GraphQLString} from 'graphql'
import {
	type ConnectionArguments,
	connectionArgs,
	connectionDefinitions,
	connectionFromArray,
} from 'graphql-relay'
import {registerType, nodeField} from './utils/node-interface.js'
import {contactTypeInfo, ContactType, contactLoader} from './types/contact.js'
import {dictionaryTypeInfo, DictionaryDefinitionType, dictionaryLoader} from './types/dictionary.js'

registerType('Contact', contactTypeInfo)
registerType('DictionaryDefinition', dictionaryTypeInfo)

const {connectionType: ContactConnection} = connectionDefinitions({
	name: 'Contact',
	nodeType: ContactType,
})

const {connectionType: DictionaryDefinitionConnection} = connectionDefinitions({
	name: 'DictionaryDefinition',
	nodeType: DictionaryDefinitionType,
})

const schema = new GraphQLSchema({
	query: new GraphQLObjectType({
		name: 'Query',
		fields: {
			node: nodeField,
			hello: {
				type: GraphQLString,
				resolve: () => 'world',
			},
			contacts: {
				type: ContactConnection,
				args: connectionArgs,
				resolve: async (_, args: ConnectionArguments) => {
					const contacts = await contactLoader.load('contact-info.json')
					return connectionFromArray(contacts, args)
				},
			},
			dictionary: {
				type: DictionaryDefinitionConnection,
				args: connectionArgs,
				resolve: async (_, args: ConnectionArguments) => {
					const definitions = await dictionaryLoader.load('dictionary.json')
					return connectionFromArray(definitions, args)
				},
			},
		},
	}),
})

export const graphql = createHandler({schema})
