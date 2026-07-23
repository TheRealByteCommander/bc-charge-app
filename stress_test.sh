#!/bin/bash
URL="https://main.bc-charge.com"
CONCURRENCY=$1
TOTAL_REQUESTS=$2
SLEEP_BETWEEN=0

echo "Starting stress test: $URL | Concurrency: $CONCURRENCY | Total Requests: $TOTAL_REQUESTS"

# Create a temporary file to store results
RESULTS_FILE="results_$(date +%s).txt"
touch "$RESULTS_FILE"

# Function to perform a single request and log status and time
do_request() {
    # Measure TTFB (time to first byte)
    res=$(curl -o /dev/null -s -w "%{http_code} %{time_starttransfer}\n" "$URL")
    echo "$res" >> "$RESULTS_FILE"
}

# Export function for use in parallel
export -f do_request
export URL RESULTS_FILE

# Run requests in parallel using xargs
seq $TOTAL_REQUESTS | xargs -I{} -P $CONCURRENCY bash -c "do_request"

echo "Test complete. Results in $RESULTS_FILE"
