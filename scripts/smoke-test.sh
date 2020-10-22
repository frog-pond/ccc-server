#!/bin/bash

# exit the script if any command exits
set -e
set -o pipefail

if [[ ! $CI ]]; then
	trap "exit" INT TERM
	trap "kill 0" EXIT
fi

# check that the server can launch properly, but don't bind to a port
env SMOKE_TEST=1 yarn run stolaf-college

# launch and background the server, so we can test it
PORT=3000
env NODE_PORT=$PORT yarn run stolaf-college &

# wait while the server starts up
until nc -z -w5 localhost $PORT; do
	sleep 0.1
done

# run the test
TEST=$(curl -s localhost:3000/ping)

# assert that the /ping endpoint responded with "pong"
if [[ ! $TEST -eq pong ]]; then
	exit 1
fi

for route in "/v1/food/item/5394752" \
             "/v1/food/menu/34" \
             "/v1/food/menu/35" \
             "/v1/food/menu/36" \
             "/v1/food/menu/261" \
             "/v1/food/menu/262" \
             "/v1/food/menu/263" \
             "/v1/food/menu/458" \
             "/v1/food/cafe/34" \
             "/v1/food/cafe/35" \
             "/v1/food/cafe/36" \
             "/v1/food/cafe/261" \
             "/v1/food/cafe/262" \
             "/v1/food/cafe/263" \
             "/v1/food/cafe/458" \
             "/v1/food/named/menu/the-pause" \
             "/v1/food/named/cafe/stav-hall" \
             "/v1/food/named/menu/stav-hall" \
             "/v1/food/named/cafe/the-cage" \
             "/v1/food/named/menu/the-cage" \
             "/v1/food/named/cafe/kings-room" \
             "/v1/food/named/menu/kings-room" \
             "/v1/food/named/cafe/burton" \
             "/v1/food/named/menu/burton" \
             "/v1/food/named/cafe/ldc" \
             "/v1/food/named/menu/ldc" \
             "/v1/food/named/cafe/sayles" \
             "/v1/food/named/menu/sayles" \
             "/v1/food/named/cafe/weitz" \
             "/v1/food/named/menu/weitz" \
             "/v1/calendar/named/stolaf" \
             "/v1/calendar/named/oleville" \
             "/v1/calendar/named/northfield" \
             "/v1/calendar/named/krlx-schedule" \
             "/v1/calendar/named/ksto-schedule" \
             "/v1/dictionary" \
             "/v1/directory/departments" \
             "/v1/directory/majors" \
             "/v1/contacts" \
             "/v1/tools/help" \
             "/v1/faqs" \
             "/v1/webcams" \
             "/v1/jobs" \
             "/v1/orgs" \
						 "/v1/news/wpjson?url=https://oleville.com/wp-json/wp/v2/posts/" \
             "/v1/news/named/stolaf" \
             "/v1/news/named/oleville" \
             "/v1/news/named/politicole" \
             "/v1/news/named/mess" \
             "/v1/news/named/ksto" \
             "/v1/news/named/krlx" \
             "/v1/spaces/hours" \
             "/v1/transit/bus" \
             "/v1/transit/modes" \
             "/v1/streams/archived" \
             "/v1/streams/upcoming" \
             "/v1/printing/color-printers"
do
	echo "Testing route {$route}"

	if echo "$route" | grep -q "calendar" && ! test -n "$GOOGLE_CALENDAR_API_KEY";
	then
		>&2 echo "Google Calendar API key is missing! Can't test calendars, now can we?!"
		continue
	fi

	VALUE=$(curl -sf "localhost:3000${route}" 2>&1)
	if ! [ $? -eq 0 ];
	then
		>&2 echo "Request failed: $VALUE"
		exit 1
	fi
done
