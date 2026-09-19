import {test} from 'node:test'
import {mergeWithLiveData, type Score} from './index.ts'

function makeScore(overrides: Partial<Score> = {}): Score {
	return {
		id: '12345',
		sport: "Women's Soccer",
		sport_abbrev: 'WSOC',
		date: '9/19/2026',
		dateFormatted: 'Fri, Sep 19',
		date_utc: '2026-09-19T18:00:00.000Z',
		date_end_utc: '2026-09-19T20:00:00.000Z',
		time: '1:00 PM',
		timestamp: 1789909200,
		location: {location: 'Home', homeAway: 'H', facility: 'Stadium'},
		status: {indicator: 'A', value: 'Final'},
		hometeam: 'Oles',
		hometeam_logo: '',
		opponent: "Saint Mary's University",
		opponent_logo: '',
		team_score: '7',
		opponent_score: '0',
		result: 'W',
		ip_time: '',
		prescore_info: '',
		postscore_info: '',
		links: {},
		coverage: {},
		...overrides,
	}
}

function makeLiveGame(
	overrides: Partial<
		Parameters<typeof mergeWithLiveData>[1] extends Map<string, infer T> ? T : never
	> = {},
) {
	return {
		GameId: 12345,
		Path: '/path',
		FullPath: '/full/path',
		Link: 'https://example.com',
		SportTitle: "Women's Soccer",
		Opponent: "Saint Mary's University",
		Location: 'Home',
		Time: '1:00 PM',
		HasStarted: true,
		IsComplete: false,
		ClockSeconds: 0,
		ShowExtraPeriodsAsOT: false,
		PeriodsRegulation: 2,
		Period: 2,
		PeriodName: '2nd Half',
		HomeTeam: {Id: '1', Name: 'Oles', Score: 7},
		VisitingTeam: {Id: '2', Name: "Saint Mary's", Score: 0},
		...overrides,
	}
}

void test('mergeWithLiveData does not mark game as ongoing when scores endpoint already has a W result', (t) => {
	const score = makeScore({result: 'W', status: {indicator: 'A', value: 'Final'}})
	const livestats = new Map([['12345', makeLiveGame({IsComplete: false})]])

	const merged = mergeWithLiveData(score, livestats)

	t.assert.equal(merged.status.indicator, 'A', 'should keep original status, not override to O')
})

void test('mergeWithLiveData does not mark game as ongoing when scores endpoint already has an L result', (t) => {
	const score = makeScore({result: 'L', status: {indicator: 'A', value: 'Final'}})
	const livestats = new Map([['12345', makeLiveGame({IsComplete: false})]])

	const merged = mergeWithLiveData(score, livestats)

	t.assert.equal(merged.status.indicator, 'A', 'should keep original status, not override to O')
})

void test('mergeWithLiveData marks game as ongoing when in progress with no final result', (t) => {
	const score = makeScore({result: '', status: {indicator: 'A', value: 'In Progress'}})
	const livestats = new Map([['12345', makeLiveGame({HasStarted: true, IsComplete: false})]])

	const merged = mergeWithLiveData(score, livestats)

	t.assert.equal(merged.status.indicator, 'O', 'should mark as ongoing')
})

void test('mergeWithLiveData returns original score when livestats says game is complete', (t) => {
	const score = makeScore({result: 'W'})
	const livestats = new Map([['12345', makeLiveGame({IsComplete: true})]])

	const merged = mergeWithLiveData(score, livestats)

	t.assert.equal(merged.status.indicator, 'A', 'should keep original status')
})

void test('mergeWithLiveData returns original score when no matching livestats entry', (t) => {
	const score = makeScore({result: ''})
	const livestats = new Map<string, ReturnType<typeof makeLiveGame>>()

	const merged = mergeWithLiveData(score, livestats)

	t.assert.equal(merged, score, 'should return original score unchanged')
})
