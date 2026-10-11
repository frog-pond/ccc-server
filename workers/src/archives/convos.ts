import {allConvosFrom} from '../../../source/ccci-carleton-college/v1/convos-shape.ts'
import {registerArchive} from '../archive.ts'
import {readPodcast} from '../sources/convos.ts'

/// A convocation as the archived route answers it, its date as JSON has it.
export type Convo = {
	title: string
	description: string
	pubDate: string
	enclosure: {type: string; url: string; length: string} | null
}

/// Every convocation in the podcast feed, kept by its recording's address (or,
/// without one, its title and date). The feed lists them all, so its history
/// is one read of it.
export const convosArchive = registerArchive({
	name: 'convos',
	key: () => 'carleton',
	id: (convo: Convo) => convo.enclosure?.url || `${convo.title} ${convo.pubDate}`,
	at: (convo: Convo) => Date.parse(convo.pubDate),
	columns: {
		title: 'TEXT NOT NULL',
		description: 'TEXT NOT NULL',
		pub_date: 'TEXT NOT NULL',
		enclosure_type: 'TEXT',
		enclosure_url: 'TEXT',
		enclosure_length: 'TEXT',
	},
	toRow: (convo: Convo) => ({
		title: convo.title,
		description: convo.description,
		pub_date: convo.pubDate,
		enclosure_type: convo.enclosure?.type ?? null,
		enclosure_url: convo.enclosure?.url ?? null,
		enclosure_length: convo.enclosure?.length ?? null,
	}),
	fromRow: (row): Convo => ({
		title: row['title'] as string,
		description: row['description'] as string,
		pubDate: row['pub_date'] as string,
		enclosure:
			row['enclosure_url'] === null
				? null
				: {
						type: row['enclosure_type'] as string,
						url: row['enclosure_url'] as string,
						length: row['enclosure_length'] as string,
					},
	}),
	async backfill() {
		let convos = JSON.parse(JSON.stringify(allConvosFrom(await readPodcast()))) as Convo[]
		return {items: convos, next: null}
	},
})
