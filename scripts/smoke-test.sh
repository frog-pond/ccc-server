#!/bin/bash

# exit the script if any command exits
set -e
set -o pipefail

if [[ ! $CI ]]; then
	trap "exit" INT TERM
	trap "kill 0" EXIT
fi

#for institution in stolaf-college carleton-college; do
# check that the server can launch properly, but don't bind to a port
env SMOKE_TEST=1 npm run stolaf-college

# launch and background the server, so we can test it
PORT=3000
env NODE_PORT=$PORT npm run stolaf-college &

# wait while the server starts up
until nc -z -w5 localhost $PORT; do
	sleep 0.1
done

# run the test
TEST=$(curl -s localhost:3000/ping)

# assert that the /ping endpoint responded with "pong"
if [[ $TEST != "pong" ]]; then
	exit 1
fi

for route in $(curl -s localhost:3000/v1/routes | jq -r '.[].path'); do
  echo "validating $route"

  case $route in
    "/v1/calendar/"*)
      echo "skip because we don't have authorization during smoke tests"
      continue
      ;;

    # skip any with placeholders
    *"/:"*)
      echo "skip because of parameter placeholders"
      continue
      ;;

    *)
      # do nothing
      ;;
  esac

  # TODO: add --fail to the below once we fix the remaining endpoints
  curl --silent "localhost:3000$route" >/dev/null
done
