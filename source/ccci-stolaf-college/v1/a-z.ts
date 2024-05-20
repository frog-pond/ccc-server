import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'
import {z} from 'zod'
import {Api} from '../../database/Api.js'
import {supabase, type TablesInsert} from '../../database/supabase.js'
import assert from 'node:assert/strict'
import {groupBy} from 'lodash-es'

const GET = mem(get, {maxAge: ONE_DAY})

type StOlafAzResponseType = z.infer<typeof StOlafAzResponseSchema>
const StOlafAzResponseSchema = z.object({
	az_nav: z.object({
		menu_items: z.array(
			z.object({
				letter: z.string(),
				values: z.array(z.object({label: z.string(), url: z.string().url()})),
			}),
		),
	}),
})

type AllAboutOlafExtraAzResponseType = z.infer<typeof AllAboutOlafExtraAzResponseSchema>
const AllAboutOlafExtraAzResponseSchema = z.object({
	data: z.array(
		z.object({
			letter: z.string(),
			values: z.array(z.object({label: z.string(), url: z.string().url()})),
		}),
	),
})

async function getOlafAtoZ() {
	let url = 'https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z'
	return StOlafAzResponseSchema.parse(await GET(url).json())
}

async function getPagesAtoZ() {
	return AllAboutOlafExtraAzResponseSchema.parse(await GET(GH_PAGES('a-to-z.json')).json())
}

// merge custom entries defined on GH pages with the fetched WP-JSON
function combineResponses(
	pagesResponse: AllAboutOlafExtraAzResponseType,
	olafResponse: StOlafAzResponseType,
) {
	let olafData = olafResponse.az_nav.menu_items

	pagesResponse.data.forEach(({letter, values}) => {
		// find the matching keyed letter to add our own values to
		let targetIndex = olafData.findIndex((entry) => entry.letter === letter)
		let targetData = olafData[targetIndex]

		if (targetData) {
			// add our custom values and only resort the impacted indices
			targetData.values.push(...values)
			targetData.values.sort((a, b) => a.label.localeCompare(b.label))
		}
	})

	return olafData.map(({letter, values}) => ({
		title: letter[0],
		data: values,
	}))
}

export async function atoz(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	let pagesResponse = await getPagesAtoZ()
	let olafResponse = await getOlafAtoZ()

	ctx.body = combineResponses(pagesResponse, olafResponse)
}

export async function atozSupabase(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	// let pagesResponse = await getPagesAtoZ()
	// let olafResponse = await getOlafAtoZ()
	// type=eq.a-z&order=sort_group.asc,sort_title.asc&select=uri,title,sort_group
	let {data: links} = await supabase
		.from('link')
		.select()
		.eq('type', 'a-z')
		.order('sort_group', {ascending: true})
		.order('sort_title', {ascending: false})
		.select('uri,title,sort_group')
		.throwOnError()
	assert(links)

	ctx.body = Object.entries(groupBy(links, (link) => link.sort_group)).map(([title, data]) => ({
		title,
		data: data.map(({uri, title}) => ({url: uri, label: title})),
	}))
}

export async function ingest(ctx: Context) {
	let pagesResponse = await getPagesAtoZ()

	await supabase.from('data_source').upsert({id: 'manual', type: 'manual'})

	// let client = new Api()
	// await client.dataSource.dataSourceCreate()
	await supabase.from('link').upsert(
		pagesResponse.data.flatMap(({values}) => {
			return values.map(
				(item) =>
					({
						source: 'manual',
						type: 'a-z',
						title: item.label,
						uri: new URL(item.url).toString(),
						sort_title: item.label.toLocaleLowerCase(),
						sort_group: item.label.toLocaleUpperCase().at(0) ?? '?',
					}) satisfies TablesInsert<'link'>,
			)
		}),
	)

	let olafResponse = await getOlafAtoZ()
	await supabase.from('data_source').upsert({
		id: 'edu.stolaf/sidebar/a-z',
		type: 'automated-scrape',
		uri: 'https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z',
	})

	await supabase.from('link').upsert(
		olafResponse.az_nav.menu_items.flatMap(({values}) => {
			return values.map(
				(item) =>
					({
						source: 'edu.stolaf/sidebar/a-z',
						type: 'a-z',
						title: item.label,
						uri: new URL(item.url).toString(),
						sort_title: item.label.toLocaleLowerCase(),
						sort_group: item.label.toLocaleUpperCase().at(0) ?? '?',
					}) satisfies TablesInsert<'link'>,
			)
		}),
	)

	ctx.body = 'ok'
}
