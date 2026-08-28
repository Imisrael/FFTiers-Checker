#!/bin/bash

today=$(date '+%Y-%m-%d')
SEASON_START_DATE="2026-09-08"
CURRENT_SECONDS=$(date +%s)
START_SECONDS=$(date -d "$SEASON_START_DATE" +%s)
SECONDS_IN_A_WEEK=$((7 * 24 * 60 * 60))

if (( CURRENT_SECONDS < START_SECONDS )); then
    # preseason, file it under week 1
    CURRENT_WEEK=1
else
    CURRENT_WEEK=$(( (CURRENT_SECONDS - START_SECONDS) / SECONDS_IN_A_WEEK + 1 ))
    (( CURRENT_WEEK > 18 )) && CURRENT_WEEK=18
fi

CURRENT_MONTH=$(date +%-m)
CURRENT_YEAR=$(date +%Y)
(( CURRENT_MONTH < 3 )) && CURRENT_YEAR=$(( CURRENT_YEAR - 1 ))

TARGET_FILE="${today}_tiers.json"


echo "Checking for new data for Year: $CURRENT_YEAR, Week: $CURRENT_WEEK"

# Change to the backend directory
cd /home/israel/development/FFTiers-Checker/backend

# Run the Go program and check its exit code
if ./update; then
    # This block only runs if ./update exits with 0 (success)
    echo "New data found. Updating database..."
    cd ../files
    ln -sfn "$TARGET_FILE" tiers.json
    cd ../backend/ingest
    node upsert.js --week=$CURRENT_WEEK --year=$CURRENT_YEAR
else
    # This block runs if ./update exits with a non-zero code
    echo "No new data. Skipping database update."
fi
