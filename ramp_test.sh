#!/bin/bash
URL="https://main.bc-charge.com"
CONCURRENCIES=(200 500 1000 2000)
TOTAL_PER_RUN=2000

for C in "${CONCURRENCIES[@]}"; do
    echo "--- Testing Concurrency: $C ---"
    RESULTS_FILE="results_$C.txt"
    
    # Use xargs for parallel execution
    seq $TOTAL_PER_RUN | xargs -I{} -P $C curl -o /dev/null -s -w "%{http_code} %{time_starttransfer} %{time_total}\n" "$URL" > "$RESULTS_FILE"
    
    TOTAL=$(wc -l < "$RESULTS_FILE")
    OK=$(grep -c "^200" "$RESULTS_FILE")
    ERR5=$(grep -c "^5" "$RESULTS_FILE")
    TTFB=$(awk '{sum+=$2} END {print sum/NR}' "$RESULTS_FILE")
    TOTAL_T=$(awk '{sum+=$3} END {print sum/NR}' "$RESULTS_FILE")
    
    echo "Total: $TOTAL | OK: $OK | 5xx: $ERR5 | Avg TTFB: ${TTFB}s | Avg Total: ${TOTAL_T}s"
    
    # Print the distribution of codes
    echo "Distribution:"
    cut -d' ' -f1 "$RESULTS_FILE" | sort | uniq -c
    
    rm "$RESULTS_FILE"
    echo ""
done
