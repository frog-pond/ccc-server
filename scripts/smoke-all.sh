#!/bin/bash

# exit the script if any command exits
set -ex -o pipefail

bash ./scripts/smoke-test.sh stolaf-college
bash ./scripts/smoke-test.sh carleton-college
