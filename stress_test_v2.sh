#!/bin/bash
URL="https://main.bc-charge.com"
CONCURRENCY=$1
TOTAL_REQUESTS=$2
RESULTS_FILE="results_v2_$(date +%s).txt"

do_request() {
    # Capture: HTTP code, time_starttransfer, time_total
    curl -o /dev/null -s -w "%{http_code} %{time_starttransfer} %{time_total}\n" "$URL"
}
export -f do_request
export URL

seq $TOTAL_REQUESTS | xargs -I{} -P $CONCURRENCY bash -c "do_request" > "$RESULTS_FILE"
echo "$RESULTS_FILE"
