import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import moment from 'moment-timezone'

export async function getStreams({streamClass, sort, dateFrom, dateTo}) {
	const params = {
		class: streamClass,
		sort,
		date_from: dateFrom,
		date_to: dateTo,
	}

	const url = 'https://www.stolaf.edu/multimedia/api/collection'
	const data = await get(url, {searchParams: params}).json()
	return data.results.map((stream) => {
		let {starttime} = stream
		return {
			...stream,
			starttime: moment
				.tz(starttime, 'YYYY-MM-DD HH:mm', 'America/Chicago')
				.toISOString(),
		}
	})
}

export async function upcoming(ctx) {
	ctx.cacheControl(ONE_HOUR)

	const {
		dateFrom = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		dateTo = moment()
			.add(2, 'month')
			.tz('America/Chicago')
			.format('YYYY-MM-DD'),
		sort = 'ascending',
	} = ctx.query

	ctx.body = await getStreams({
		streamClass: 'current',
		dateFrom,
		dateTo,
		sort,
	})
}

export async function archived(ctx) {
	ctx.cacheControl(ONE_HOUR)

	const {
		dateFrom = moment()
			.subtract(2, 'month')
			.tz('America/Chicago')
			.format('YYYY-MM-DD'),
		dateTo = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		sort = 'ascending',
	} = ctx.query

	ctx.body = await getStreams({
		streamClass: 'archived',
		dateFrom,
		dateTo,
		sort,
	})
}
