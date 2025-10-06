#!/bin/bash

# exit the script if any command exits
set -e -o pipefail

INSTITUTION="${1:?usage: smoke-test.sh <stolaf-college|carleton-college>}"
echo "running smoke-test for $INSTITUTION"

if [[ ! $CI ]]; then
	trap "exit" INT TERM
	trap "kill 0" EXIT
fi

# check that the server can launch properly, but don't bind to a port
env SMOKE_TEST=1 npm run "$INSTITUTION"

# launch and background the server, so we can test it
PORT=3000
env NODE_PORT=$PORT npm run "$INSTITUTION" &

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
    "/v1/calendar/carleton" | "/v1/calendar/the-cave")
      # we can run these, because they're ICS, not GCal
      ;;

    "/v1/news/named/stolaf")
      # Explicitly test this endpoint to ensure WordPress JSON feed parsing works
      # This validates that optional wp:featuredmedia fields are handled correctly
      echo "validating $route with JSON structure check"
      RESPONSE=$(curl --silent --fail "localhost:3000$route")
      # Verify it's valid JSON and is an array
      echo "$RESPONSE" | jq -e 'if type == "array" then true else error("Expected array") end' >/dev/null
      # Verify each item has required fields
      echo "$RESPONSE" | jq -e '.[0] | if has("title") and has("link") and has("datePublished") then true else error("Missing required fields") end' >/dev/null
      continue
      ;;

    "/v1/calendar/"* | "/v1/convos/upcoming")
      echo "skip because we don't have authorization during smoke tests"
      continue
      ;;

    "/v1/news/rss" | "/v1/news/wpjson" | "/v1/util/html-to-md")
      echo "skip because of required query parameters"
      continue
      ;;

    "/v1/news/named/oleville")
      echo "skip because oleville tends to break often and isn't worth testing"
      continue
      ;;

    "/v1/news/named/mess")
      echo "skip because mess tends to break often and isn't worth testing"
      continue
      ;;

    "/v1/news/named/nnb")
      echo "skip because nnb is broken"
      continue
      ;;

    "/v1/jobs")
      echo "skip because jobs are currently broken endpoints"
      continue
      ;;

    *"/:"*)
      echo "skip because of parameter placeholders"
      continue
      ;;

    "/v1/orgs")
      echo "skip because presence is so slow"
      continue
      ;;

    *)
      # do nothing
      ;;
  esac

  curl --silent --fail "localhost:3000$route" >/dev/null
done
