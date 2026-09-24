#!/bin/bash

# exit the script if any command exits
set -e -o pipefail

INSTITUTION="${1:?usage: smoke-test.sh <stolaf-college|carleton-college>}"
echo "running live smoke-test for $INSTITUTION"

trap "exit" INT TERM
trap "kill 0" EXIT

PORT=3000
npx wrangler dev --env "$INSTITUTION" --port $PORT &

# wait while the server starts up
until curl -s "localhost:$PORT/ping" >/dev/null; do
	sleep 0.5
done

# assert that the /ping endpoint responded with "pong"
if [[ $(curl -s "localhost:$PORT/ping") != "pong" ]]; then
	exit 1
fi

for route in $(curl -s "localhost:$PORT/v1/routes" | node scripts/testable-routes.ts); do
	echo "validating $route"
	curl --silent --fail "localhost:$PORT$route" >/dev/null
done
