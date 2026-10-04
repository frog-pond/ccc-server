# Athletics feed recordings

Real responses from St. Olaf's two athletics feeds and from this server's
`/v1/athletics/scores`, captured once a minute through a set of games:

- `*-scores.json` — `https://athletics.stolaf.edu/services/scores_chris.aspx?format=json`
- `*-livestats.json` — `https://athletics.stolaf.edu/services/livestats.ashx`
- `*-ccc.json` — `https://stolaf.api.frogpond.tech/v1/athletics/scores`, the
  production server's output for the same minute

Each file name starts with the UTC time of the capture. Only the minutes where
a recorded game's status, result or score changed in any of the three sources
are kept, and each file holds only the recorded games. Apart from that the
responses are as received.

## `2026-09-23-away-games`

Men's Soccer at Luther (21096) and Volleyball at Carleton (21117), both
7 p.m. Central, recorded 23:45Z to 03:00Z. livestats listed neither game, and
the scores feed went straight from a scheduled game to the final. One minute,
00:00Z, is missing: the livestats request timed out.

## `2026-09-26-home-games`

Volleyball (21147), Football (21037), Women's Soccer (21076) and Men's Soccer
(21097) against visitors at St. Olaf, recorded 13:45Z to 23:30Z. livestats
covered all four, from before kickoff until a few minutes after each final
posted to the scores feed. Between livestats reporting a game complete and the
scores feed posting its result, this server returned the game as scheduled,
with no score, for between 5 minutes and 3 hours 23 minutes.
