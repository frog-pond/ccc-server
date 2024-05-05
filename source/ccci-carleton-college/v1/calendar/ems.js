import {get as got} from '../../../ccc-lib/index.js'
import moment from 'moment'

export async function emsCalendar(now = moment()) {
	let url = 'https://ems.ads.carleton.edu/WebApp/ServerApi.aspx/BrowseEvents'
	let startDate = now.format('YYYY-MM-D hh:mm:ss')
	let endDate = now.add(30, 'days').format('YYYY-MM-D hh:mm:ss')
	let payload = {
		filterData: {
			filters: [
				{
					filterName: 'StartDate',
					value: startDate,
					displayValue: 3,
					filterType: 3,
				},
				{
					filterName: 'EndDate',
					value: endDate,
					filterType: 3,
					displayValue: '',
				},
				{
					filterName: 'TimeZone',
					value: '64',
					displayValue: '',
					filterType: 2,
				},
				{
					filterName: 'RollupEventsToReservation',
					value: 'false',
					displayValue: '',
				},
				{
					filterName: 'ResultType',
					value: 'Monthly',
					displayValue: '',
				},
			],
		},
	}

	let body = await got(url, {json: payload}).json()

	let data = JSON.parse(body.d)

	let holidays = data.Holidays
	let results = data.MonthlyBookingResults

	results = results.map((ev) => {
		let {
			GmtStart: gmtStart,
			GmtEnd: gmtEnd,
			Name: name,
			GroupName: groupName,
			Location: location,
			Building: building,
			BuildingId: buildingId,
			Room: room,
			RoomType: roomType,
			RoomCode: roomCode,
			IsAllDayEvent: isAllDayEvent,
			Id: id,
			RoomId: roomId,
		} = ev

		return {
			eventStart: gmtStart + 'Z',
			eventEnd: gmtEnd + 'Z',
			name,
			groupName,
			location,
			building,
			buildingId,
			room,
			roomType,
			roomCode,
			isAllDayEvent,
			id,
			roomId,
		}
	})

	return {holidays, results}
}
