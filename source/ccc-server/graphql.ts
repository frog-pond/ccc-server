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
import {URLScalar} from './url-scalar.js'

interface Contact {
	title: string
	phoneNumber: string
	buttonText: string
	category: string
	image?: string
	synopsis: string
	text: string
}

interface ContactResponse {
	data: Contact[]
}

const contactLoader = new DataLoader<string, Contact[]>(async (keys) => {
	const contacts = await Promise.all(
		keys.map((key) => get(GH_PAGES(key)).json<ContactResponse>()),
	)
	return contacts.map((contact) => contact.data)
})

const {nodeInterface, nodeField} = nodeDefinitions(
	(globalId) => {
		const {type, id} = fromGlobalId(globalId)
		if (type === 'Contact') {
			return contactLoader
				.load('contact-info.json')
				.then((contacts) => contacts.find((c) => c.title === id))
		}
		return null
	},
	(obj: object): string | undefined => {
		if ('phoneNumber' in obj) {
			return 'Contact'
		}
		return undefined
	},
)

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

const {connectionType: ContactConnection} = connectionDefinitions({
	name: 'Contact',
	nodeType: ContactType,
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
		},
	}),
})

export const graphql = createHandler({schema})