import {createHandler} from 'graphql-http/lib/use/koa'
import {GraphQLID, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString} from 'graphql'
import {
	type ConnectionArguments,
	connectionArgs,
	connectionDefinitions,
	connectionFromArray,
	fromGlobalId,
	nodeDefinitions,
	toGlobalId,
} from 'graphql-relay'
import {get} from '../ccc-lib/http.js'
import {GH_PAGES} from '../ccci-stolaf-college/v1/gh-pages.js'
import DataLoader from 'dataloader'
import {z, type ZodObject, type ZodRawShape, type ZodTypeAny} from 'zod'
import {URLScalar} from './url-scalar.js'

// #region Type Definitions and Zod Schemas
// =================================================================================

type KnownGraphQLTypeNames = 'Contact' | 'DictionaryDefinition'

const ContactSchema = z.object({
	title: z.string(),
	phoneNumber: z.string(),
	buttonText: z.string(),
	category: z.string(),
	image: z.string().optional(),
	synopsis: z.string(),
	text: z.string(),
})
type Contact = z.infer<typeof ContactSchema>

interface ContactResponse {
	data: Contact[]
}

const DictionaryDefinitionSchema = z.object({
	word: z.string(),
	definition: z.string(),
})

type DictionaryDefinition = z.infer<typeof DictionaryDefinitionSchema>

interface DictionaryDefinitionResponse {
	data: DictionaryDefinition[]
}

// #endregion

// #region Data Loaders
// =================================================================================

const contactLoader = new DataLoader<string, Contact[]>(async (keys) => {
	const contacts = await Promise.all(
		keys.map((key) => get(GH_PAGES(key)).json<ContactResponse>()),
	)
	return contacts.map((contact) => contact.data)
})

const dictionaryLoader = new DataLoader<string, DictionaryDefinition[]>(
	async (keys) => {
		const dictionary = await Promise.all(
			keys.map((key) => get(GH_PAGES(key)).json<DictionaryDefinitionResponse>()),
		)
		return dictionary.map((entry) => entry.data)
	},
)

// #endregion

// #region Node Interface and Type Registry
// =================================================================================

interface NodeTypeInfo<T extends ZodTypeAny> {
	schema: T
	fetcher: (id: string) => Promise<z.infer<T> | null>
}

const typeInfoRegistry: {
	[key in KnownGraphQLTypeNames]?: NodeTypeInfo<ZodObject<ZodRawShape>>
} = {}

function registerType<T extends ZodObject<ZodRawShape>>(
	name: KnownGraphQLTypeNames,
	info: NodeTypeInfo<T>,
) {
	typeInfoRegistry[name] = info
}

registerType('Contact', {
	schema: ContactSchema,
	fetcher: async (id: string) => {
		const contacts = await contactLoader.load('contact-info.json')
		return contacts.find((c) => c.title === id) ?? null
	},
})

registerType('DictionaryDefinition', {
	schema: DictionaryDefinitionSchema,
	fetcher: async (id: string) => {
		const definitions = await dictionaryLoader.load('dictionary.json')
		return definitions.find((d) => d.word === id) ?? null
	},
})

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

const {nodeInterface, nodeField} = nodeDefinitions(getObject, resolveNodeType)

// #endregion

// #region GraphQL Object Types
// =================================================================================

const ContactType = new GraphQLObjectType<Contact, unknown>({
	name: 'Contact',
	fields: {
		id: {
			type: new GraphQLNonNull(GraphQLID),
			resolve: (contact) => toGlobalId('Contact', contact.title),
		},
		title: {type: new GraphQLNonNull(GraphQLString)},
		phoneNumber: {type: new GraphQLNonNull(GraphQLString)},
		buttonText: {type: new GraphQLNonNull(GraphQLString)},
		category: {type: new GraphQLNonNull(GraphQLString)},
		image: {
			type: URLScalar,
			resolve: (contact) => {
				if (!contact.image) {
					return null
				}
				try {
					return new URL(contact.image)
				} catch {
					return null
				}
			},
		},
		synopsis: {type: new GraphQLNonNull(GraphQLString)},
		text: {type: new GraphQLNonNull(GraphQLString)},
	},
	interfaces: [nodeInterface],
})

const DictionaryDefinitionType = new GraphQLObjectType<
	DictionaryDefinition,
	unknown
>({
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

const {connectionType: ContactConnection} = connectionDefinitions({
	name: 'Contact',
	nodeType: ContactType,
})

const {connectionType: DictionaryDefinitionConnection} = connectionDefinitions({
	name: 'DictionaryDefinition',
	nodeType: DictionaryDefinitionType,
})

// #endregion

// #region Root Query and Schema
// =================================================================================

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

// #endregion