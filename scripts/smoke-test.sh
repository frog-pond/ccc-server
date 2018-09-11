#!/bin/bash

# exit the script if any command exits
set -e
set -o pipefail

if [[ ! $CI ]]; then
	trap "exit" INT TERM
	trap "kill 0" EXIT
fi

# check that the server can launch properly, but don't bind to a port
env SMOKE_TEST=1 npm run stolaf

# launch and background the server, so we can test it
PORT=3000
env NODE_PORT=$PORT npm run stolaf &

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
