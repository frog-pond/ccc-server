import {test} from 'node:test'
import {readdirSync, readFileSync} from 'node:fs'
import {
	gameState,
	needsFrequentRefresh,
	ScoreSchema,
	scoresFromFeeds,
	type FeedScore,
	type GameState,
	type LiveGame,
	type School,
	type Score,
	withYesterday,
	yesterdaysGames,
} from './index.ts'

function readFixture(path: string): unknown {
	return JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'))
}

void test("ScoreSchema carries the feed's HAN through as location.homeAway", (t) => {
	const feed = readFixture('2026-09-23-away-games/20260924T013855Z-scores.json') as {
		scores: unknown[]
	}

	const score = ScoreSchema.parse(feed.scores[0])

	t.assert.deepEqual(score.location, {
		location: 'Decorah, Iowa / Luther Soccer Field',
		facility: '',
		homeAway: 'A',
	})
})

/** Kickoff for the games built below. */
const KICKOFF = '2026-09-19T18:00:00.000Z'
const BEFORE_KICKOFF = new Date('2026-09-19T17:00:00.000Z')
const AFTER_KICKOFF = new Date('2026-09-19T19:00:00.000Z')

function makeFeedScore(overrides: Partial<FeedScore> = {}): FeedScore {
	return {
		id: '12345',
		sport: "Women's Soccer",
		sport_abbrev: 'WSOC',
		date: '9/19/2026',
		dateFormatted: 'Sat, Sep 19',
		date_utc: KICKOFF,
		date_end_utc: '2026-09-19T20:00:00.000Z',
		time: '1:00 PM',
		timestamp: 1789909200,
		location: {location: 'Northfield, Minn.', facility: 'Stadium', homeAway: 'H'},
		status: {indicator: 'A', value: ''},
		hometeam: 'Oles',
		hometeam_logo: '',
		opponent: "Saint Mary's University",
		opponent_logo: '',
		team_score: '',
		opponent_score: '',
		result: '',
		ip_time: '',
		prescore_info: '',
		postscore_info: '',
		links: {},
		coverage: {},
		...overrides,
	}
}

function makeLiveGame(overrides: Partial<LiveGame> = {}): LiveGame {
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
		HomeTeam: {Id: '1', Name: 'Oles', Score: 3},
		VisitingTeam: {Id: '2', Name: "Saint Mary's", Score: 1},
		...overrides,
	}
}

void test('gameState: a posted result is final, even while livestats says the game is on', (t) => {
	const score = makeFeedScore({result: 'W', team_score: '7', opponent_score: '0'})

	const game = gameState(score, makeLiveGame(), AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'final')
	t.assert.deepEqual([game.team_score, game.opponent_score], ['7', '0'])
})

void test('gameState: a no-decision result is final', (t) => {
	const game = gameState(makeFeedScore({result: 'N'}), undefined, AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'final')
})

void test('gameState: a game livestats reports complete, with no result yet, is an unofficial final', (t) => {
	const game = gameState(makeFeedScore(), makeLiveGame({IsComplete: true}), AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'unofficial-final')
	t.assert.equal(game.result, '')
	t.assert.deepEqual([game.team_score, game.opponent_score], ['3', '1'])
})

void test('gameState: livestats reporting complete is enough for an unofficial final', (t) => {
	const liveGame = makeLiveGame({HasStarted: false, IsComplete: true})

	t.assert.equal(
		gameState(makeFeedScore(), liveGame, AFTER_KICKOFF).status.indicator,
		'unofficial-final',
	)
})

void test('gameState: a game livestats reports started is live, home score first', (t) => {
	const game = gameState(makeFeedScore(), makeLiveGame(), AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'live')
	t.assert.deepEqual([game.team_score, game.opponent_score], ['3', '1'])
})

void test('gameState: past kickoff with no live data and no result is started, without a score', (t) => {
	const score = makeFeedScore({team_score: '1', opponent_score: '0'})

	const game = gameState(score, undefined, AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'started')
	t.assert.deepEqual([game.team_score, game.opponent_score], ['', ''])
})

void test('gameState: past kickoff with livestats not yet started is started', (t) => {
	const game = gameState(makeFeedScore(), makeLiveGame({HasStarted: false}), AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'started')
})

void test('gameState: kickoff exactly now is started', (t) => {
	const game = gameState(makeFeedScore(), undefined, new Date(KICKOFF))

	t.assert.equal(game.status.indicator, 'started')
})

void test('gameState: before kickoff is scheduled', (t) => {
	const game = gameState(makeFeedScore(), makeLiveGame({HasStarted: false}), BEFORE_KICKOFF)

	t.assert.equal(game.status.indicator, 'scheduled')
})

void test("gameState: ignores the feed's 'O' when there is no result", (t) => {
	const score = makeFeedScore({status: {indicator: 'O', value: ''}})

	t.assert.equal(gameState(score, undefined, BEFORE_KICKOFF).status.indicator, 'scheduled')
})

void test('gameState: an all-day event stays scheduled until it has a result', (t) => {
	const game = gameState(makeFeedScore({date_utc: '9/19/2026'}), undefined, AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'scheduled')
})

void test('gameState: an unreadable date stays scheduled', (t) => {
	const game = gameState(makeFeedScore({date_utc: 'TBA'}), undefined, AFTER_KICKOFF)

	t.assert.equal(game.status.indicator, 'scheduled')
})

void test("gameState: keeps the feed's status text", (t) => {
	const score = makeFeedScore({status: {indicator: 'A', value: 'Weather delay'}})

	t.assert.equal(gameState(score, undefined, AFTER_KICKOFF).status.value, 'Weather delay')
})

void test('scoresFromFeeds takes live scores from livestats by game id', (t) => {
	const scores = scoresFromFeeds(
		readFixture('2026-09-26-home-games/20260926T180249Z-scores.json'),
		readFixture('2026-09-26-home-games/20260926T180249Z-livestats.json'),
		new Date('2026-09-26T18:02:49Z'),
	)

	const womensSoccer = scores.find((score) => score.id === '21076')
	t.assert.equal(womensSoccer?.team_score, '1')
	t.assert.equal(womensSoccer?.opponent_score, '0')
})

void test('scoresFromFeeds treats an unreadable livestats body as empty', (t) => {
	const scoresJson = readFixture('2026-09-26-home-games/20260926T180249Z-scores.json')
	const now = new Date('2026-09-26T18:02:49Z')

	t.assert.deepEqual(
		scoresFromFeeds(scoresJson, {Games: 'not a list'}, now),
		scoresFromFeeds(scoresJson, {Games: []}, now),
	)
	t.assert.deepEqual(
		scoresFromFeeds(scoresJson, null, now),
		scoresFromFeeds(scoresJson, {Games: []}, now),
	)
})

/** Carleton's feed sent this for a cancelled game on 2026-10-04. */
void test('scoresFromFeeds leaves out a cancelled game, and keeps the rest', (t) => {
	const cancelled = makeFeedScore({id: '10764', status: {indicator: 'C', value: 'Cancelled'}})
	const played = makeFeedScore({id: '10765'})

	const scores = scoresFromFeeds(
		{timestamp: null, status: null, scores: [cancelled, played]},
		null,
		AFTER_KICKOFF,
	)

	t.assert.deepEqual(
		scores.map((score) => score.id),
		['10765'],
	)
})

void test('scoresFromFeeds: a game in progress reads as started when livestats is unavailable', (t) => {
	const scores = scoresFromFeeds(
		readFixture('2026-09-26-home-games/20260926T180249Z-scores.json'),
		null,
		new Date('2026-09-26T18:02:49Z'),
	)

	t.assert.equal(scores.find((score) => score.id === '21076')?.status.indicator, 'started')
})

const STATE_ORDER: GameState[] = ['scheduled', 'started', 'live', 'unofficial-final', 'final']

type Timeline = {time: Date; score: Score}[]

/** Every recorded minute of a fixture, run through scoresFromFeeds, per game id. */
function replay(dir: string): Map<string, Timeline> {
	const folder = new URL(`./fixtures/${dir}/`, import.meta.url)
	const stamps = [
		...new Set(
			readdirSync(folder)
				.filter((name) => name.endsWith('-scores.json'))
				.map((name) => name.slice(0, 16)),
		),
	].sort()

	const games = new Map<string, Timeline>()
	for (const stamp of stamps) {
		const time = new Date(
			stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u, '$1-$2-$3T$4:$5:$6Z'),
		)
		const read = (name: string): unknown =>
			JSON.parse(readFileSync(new URL(`${stamp}-${name}.json`, folder), 'utf8'))
		for (const score of scoresFromFeeds(read('scores'), read('livestats'), time)) {
			games.set(score.id, [...(games.get(score.id) ?? []), {time, score}])
		}
	}
	return games
}

for (const dir of ['2026-09-23-away-games', '2026-09-26-home-games']) {
	void test(`${dir}: no game's state moves backwards`, (t) => {
		for (const [id, timeline] of replay(dir)) {
			const ranks = timeline.map(({score}) => STATE_ORDER.indexOf(score.status.indicator))
			t.assert.equal(
				ranks.includes(-1),
				false,
				`game ${id} has an unknown state: ${ranks.join(',')}`,
			)
			t.assert.deepEqual(
				ranks,
				ranks.toSorted((a, b) => a - b),
				`game ${id}`,
			)
		}
	})

	void test(`${dir}: every game starts scheduled and ends final`, (t) => {
		for (const [id, timeline] of replay(dir)) {
			t.assert.equal(timeline[0]?.score.status.indicator, 'scheduled', `game ${id}`)
			t.assert.equal(timeline.at(-1)?.score.status.indicator, 'final', `game ${id}`)
		}
	})

	void test(`${dir}: no game past kickoff reads as scheduled`, (t) => {
		for (const [id, timeline] of replay(dir)) {
			for (const {time, score} of timeline) {
				if (new Date(score.date_utc).getTime() <= time.getTime()) {
					t.assert.notEqual(
						score.status.indicator,
						'scheduled',
						`game ${id} at ${time.toISOString()}`,
					)
				}
			}
		}
	})

	void test(`${dir}: an unofficial final score matches the official one`, (t) => {
		for (const [id, timeline] of replay(dir)) {
			const final = timeline.at(-1)?.score
			for (const {time, score} of timeline) {
				if (score.status.indicator === 'unofficial-final') {
					t.assert.deepEqual(
						[score.team_score, score.opponent_score],
						[final?.team_score, final?.opponent_score],
						`game ${id} at ${time.toISOString()}`,
					)
				}
			}
		}
	})
}

void test('2026-09-26: every home game reads as an unofficial final before its result posts', (t) => {
	for (const [id, timeline] of replay('2026-09-26-home-games')) {
		const states = timeline.map(({score}) => score.status.indicator)
		t.assert.equal(states.includes('unofficial-final'), true, `game ${id}: ${states.join(' → ')}`)
	}
})

void test('2026-09-23: an away game reads as started while its result is pending', (t) => {
	const states = [...replay('2026-09-23-away-games').values()].flatMap((timeline) =>
		timeline.map(({score}) => score.status.indicator),
	)
	t.assert.equal(states.includes('started'), true, states.join(', '))
})

/** A game in the given state, kicking off at `kickoff`. */
function makeGame(indicator: GameState, kickoff = KICKOFF): Score {
	const game = gameState(makeFeedScore({date_utc: kickoff}), undefined, AFTER_KICKOFF)
	return {...game, status: {indicator, value: ''}}
}

for (const indicator of ['started', 'live', 'unofficial-final'] as const) {
	void test(`needsFrequentRefresh: true while a game is ${indicator}`, (t) => {
		t.assert.equal(
			needsFrequentRefresh([makeGame('final'), makeGame(indicator)], AFTER_KICKOFF),
			true,
		)
	})
}

void test('needsFrequentRefresh: true when a game kicks off within five minutes', (t) => {
	const now = new Date('2026-09-19T17:56:00.000Z')

	t.assert.equal(needsFrequentRefresh([makeGame('scheduled')], now), true)
})

void test('needsFrequentRefresh: false for games further off and finished games', (t) => {
	const now = new Date('2026-09-19T17:50:00.000Z')

	t.assert.equal(needsFrequentRefresh([makeGame('scheduled'), makeGame('final')], now), false)
})

void test('needsFrequentRefresh: false once every game past kickoff is final', (t) => {
	t.assert.equal(needsFrequentRefresh([makeGame('final')], AFTER_KICKOFF), false)
})

void test('needsFrequentRefresh: false for an all-day event', (t) => {
	// Four minutes before the instant a bare date would parse to, in any
	// time zone: were the date read as a kickoff, the game would count.
	const now = new Date(new Date('9/19/2026').getTime() - 4 * 60 * 1000)

	t.assert.equal(needsFrequentRefresh([makeGame('scheduled', '9/19/2026')], now), false)
})

void test('needsFrequentRefresh: false for an unreadable date', (t) => {
	t.assert.equal(needsFrequentRefresh([makeGame('scheduled', 'TBA')], AFTER_KICKOFF), false)
})

// ── Yesterday, from the calendar ─────────────────────────────────────────────

const STOLAF: School = {origin: 'https://athletics.stolaf.edu', teamName: 'Oles'}

/** 2:54 a.m. Central on Sunday, October 4: yesterday is Saturday the 3rd. */
const SUNDAY_NIGHT = new Date('2026-10-04T07:54:00.000Z')

void test("yesterdaysGames lists the calendar's finished games for the school's yesterday", (t) => {
	const games = yesterdaysGames(
		readFixture('calendar/2026-10-03-stolaf.json'),
		SUNDAY_NIGHT,
		STOLAF,
	)

	t.assert.deepEqual(
		games.map((game) => `${game.sport} ${game.result} ${game.team_score}-${game.opponent_score}`),
		[
			"Women's Cross Country N -",
			"Women's Golf N -",
			"Men's Cross Country N -",
			"Women's Soccer W 5-0",
			'Football W 23-21',
			"Men's Soccer W 4-0",
			"Men's Swimming and Diving N -",
			"Women's Swimming and Diving N -",
		],
	)
	for (const game of games) {
		t.assert.equal(game.status.indicator, 'final', game.sport)
		t.assert.equal(
			ScoreSchema.safeParse({...game, status: {indicator: 'O', value: ''}}).success,
			true,
		)
	}
})

void test('yesterdaysGames reads Central wall-clock times as instants', (t) => {
	const football = yesterdaysGames(
		readFixture('calendar/2026-10-03-stolaf.json'),
		SUNDAY_NIGHT,
		STOLAF,
	).find((game) => game.id === '21038')

	t.assert.equal(football?.date_utc, '2026-10-03T18:00:00.000Z')
	t.assert.equal(football?.timestamp, Date.parse('2026-10-03T18:00:00.000Z') / 1000)
	t.assert.equal(football?.time, '1 p.m.')
})

void test('yesterdaysGames writes a home game school first, as the scores feed does', (t) => {
	const football = yesterdaysGames(
		readFixture('calendar/2026-10-03-stolaf.json'),
		SUNDAY_NIGHT,
		STOLAF,
	).find((game) => game.id === '21038')

	t.assert.deepEqual(
		{
			hometeam: football?.hometeam,
			hometeam_logo: football?.hometeam_logo,
			opponent: football?.opponent,
			opponent_logo: football?.opponent_logo,
			location: football?.location,
			links: football?.links,
		},
		{
			hometeam: 'Oles',
			hometeam_logo: 'https://athletics.stolaf.edu/images/logos/site/site.png',
			opponent: 'Augsburg University',
			opponent_logo: 'https://athletics.stolaf.edu/images/logos/Augsburg-Spirit-Logo.png',
			location: {location: 'Northfield, Minn.', facility: 'Klein Field at Manitou', homeAway: 'H'},
			links: {
				boxscore: {url: 'https://athletics.stolaf.edu/boxscore.aspx?id=21038', text: 'Box'},
				postgame: {
					url: 'https://athletics.stolaf.edu/news/2026/10/3/football-gardners-last-second-field-goal-gives-football-first-win-of-season.aspx',
					text: 'Recap',
				},
			},
		},
	)
})

void test('yesterdaysGames writes an away game home side first, matching the scores feed', (t) => {
	const games = yesterdaysGames(
		readFixture('calendar/2026-09-23-stolaf.json'),
		new Date('2026-09-24T15:00:00.000Z'),
		STOLAF,
	)
	const fromFeed = readFixture('2026-09-23-away-games/20260924T020713Z-scores.json') as {
		scores: FeedScore[]
	}

	for (const feedGame of fromFeed.scores) {
		const game = games.find((g) => g.id === feedGame.id)
		t.assert.deepEqual(
			[game?.hometeam, game?.opponent, game?.team_score, game?.opponent_score, game?.result],
			[
				feedGame.hometeam,
				feedGame.opponent,
				feedGame.team_score,
				feedGame.opponent_score,
				feedGame.result,
			],
			feedGame.id,
		)
	}
})

void test('yesterdaysGames treats an unreadable calendar body as no games', (t) => {
	t.assert.deepEqual(yesterdaysGames(null, SUNDAY_NIGHT, STOLAF), [])
	t.assert.deepEqual(yesterdaysGames({days: []}, SUNDAY_NIGHT, STOLAF), [])
})

void test('yesterdaysGames skips a fixture that does not parse and keeps the rest', (t) => {
	const calendar = readFixture('calendar/2026-10-03-stolaf.json') as {events: unknown[]}[]
	const [first] = calendar
	const broken = [{...first, events: [{id: 'not a number'}, ...(first?.events ?? [])]}]

	t.assert.equal(yesterdaysGames(broken, SUNDAY_NIGHT, STOLAF).length, 8)
})

void test('yesterdaysGames is empty when the calendar does not list yesterday', (t) => {
	const mondayNight = new Date('2026-10-06T07:54:00.000Z')

	t.assert.deepEqual(
		yesterdaysGames(readFixture('calendar/2026-10-03-stolaf.json'), mondayNight, STOLAF).map(
			(game) => game.id,
		),
		[],
	)
})

void test('withYesterday prefers the scores feed for a game both list', (t) => {
	const feedGame = makeGame('final')
	const calendarGame = {...makeGame('final'), sport: 'from the calendar'}
	const other = {...makeGame('final'), id: '99999'}

	t.assert.deepEqual(withYesterday([feedGame], [calendarGame, other]), [other, feedGame])
})
