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
	async backfill() {
		let convos = JSON.parse(JSON.stringify(allConvosFrom(await readPodcast()))) as Convo[]
		return {items: convos, next: null}
	},
})
