import {GraphQLID, GraphQLNonNull, GraphQLObjectType, GraphQLString} from 'graphql'
import {toGlobalId} from 'graphql-relay'
import {z} from 'zod'
import {get} from '../../../ccc-lib/http.js'
import {GH_PAGES} from '../../../ccci-stolaf-college/v1/gh-pages.js'
import DataLoader from 'dataloader'
import {type NodeTypeInfo, nodeInterface} from '../utils/node-interface.js'
import {URLScalar} from '../utils/url-scalar.js'

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

export const contactLoader = new DataLoader<string, Contact[]>(async (keys) => {
	const contacts = await Promise.all(keys.map((key) => get(GH_PAGES(key)).json<ContactResponse>()))
	return contacts.map((contact) => contact.data)
})

export const ContactType = new GraphQLObjectType<Contact, unknown>({
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

export const contactTypeInfo: NodeTypeInfo<typeof ContactSchema> = {
	schema: ContactSchema,
	fetcher: async (id: string) => {
		const contacts = await contactLoader.load('contact-info.json')
		return contacts.find((c) => c.title === id) ?? null
	},
}
