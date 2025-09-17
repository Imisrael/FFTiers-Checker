#!/bin/bash

today=$(date '+%Y-%-m-%d')
SEASON_START_DATE="2025-09-02"
CURRENT_SECONDS=$(date +%s)
START_SECONDS=$(date -d "$SEASON_START_DATE" +%s)
SECONDS_IN_A_WEEK=$((7 * 24 * 60 * 60))
WEEKS_PASSED=$(( (CURRENT_SECONDS - START_SECONDS) / SECONDS_IN_A_WEEK ))
CURRENT_WEEK=$(( WEEKS_PASSED + 1 ))
CURRENT_YEAR=$(date +%Y)
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