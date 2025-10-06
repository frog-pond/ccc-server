import {createHandler} from 'graphql-http/lib/use/koa'
import {GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull, GraphQLID} from 'graphql'
import {nodeDefinitions, fromGlobalId, toGlobalId, connectionDefinitions, connectionFromArray} from 'graphql-relay'
import {get} from '../ccc-lib/http.js'
import {GH_PAGES} from '../ccci-stolaf-college/v1/gh-pages.js'
import DataLoader from 'dataloader'

type Contact = {
	title: string
	phoneNumber: string
	buttonText: string
	category: string
	image?: string
	synopsis: string
	text: string
}

const contactLoader = new DataLoader<string, Contact[]>(async (keys) => {
	const contacts = await Promise.all(keys.map((key) => get(GH_PAGES(key)).json()))
	return contacts.map((contact: any) => contact.data)
})

const {nodeInterface, nodeField} = nodeDefinitions(
	(globalId) => {
		const {type, id} = fromGlobalId(globalId)
		if (type === 'Contact') {
			return contactLoader.load('contact-info.json').then((contacts) =>
				contacts.find((c) => c.title === id),
			)
		}
		return null
	},
	(obj) => {
		if (obj.hasOwnProperty('phoneNumber')) {
			return 'Contact'
		}
		return undefined
	},
)

const ContactType: GraphQLObjectType = new GraphQLObjectType({
	name: 'Contact',
	fields: {
		id: {
			type: new GraphQLNonNull(GraphQLID),
			resolve: (contact: Contact) => toGlobalId('Contact', contact.title),
		},
		title: {type: new GraphQLNonNull(GraphQLString)},
		phoneNumber: {type: new GraphQLNonNull(GraphQLString)},
		buttonText: {type: new GraphQLNonNull(GraphQLString)},
		category: {type: new GraphQLNonNull(GraphQLString)},
		image: {type: GraphQLString},
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
				resolve: async (_, args) => {
					const contacts = await contactLoader.load('contact-info.json')
					return connectionFromArray(contacts, args)
				},
			},
		},
	}),
})

export const graphql = createHandler({schema})