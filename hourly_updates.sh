#!/bin/bash

today=$(date '+%Y-%-m-%d')
SEASON_START_DATE="2025-09-02"
CURRENT_SECONDS=$(date +%s)
START_SECONDS=$(date -d "$SEASON_START_DATE" +%s)
SECONDS_IN_A_WEEK=$((7 * 24 * 60 * 60))
WEEKS_PASSED=$(( (CURRENT_SECONDS - START_SECONDS) / SECONDS_IN_A_WEEK ))
CURRENT_WEEK=$(( WEEKS_PASSED + 1 ))
CURRENT_YEAR=$(date +%Y)

echo "Running ingest for Year: $CURRENT_YEAR, Week: $CURRENT_WEEK"

cd /home/israel/development/FFTiers-Checker/backend && ./update && cd ../files && ln -sfn "${today}_tiers.json" tiers.json && cd ../backend/ingest && node upsert.js --week=$CURRENT_WEEK --year=$CURRENT_YEAR

