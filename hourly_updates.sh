#!/bin/bash
set -uo pipefail

BACKEND=/home/israel/development/FFTiers-Checker/backend
export FFT_ROOT="$BACKEND"

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

OUT_DIR="$BACKEND/data/out"
TARGET_FILE="${today}_tiers.json"
BIGBOARD_FILE="${today}_tiers_bigBoard.json"

echo "Checking for new data for Year: $CURRENT_YEAR, Week: $CURRENT_WEEK"

cd "$BACKEND" || exit 1

if ./bin/update; then
    echo "New data found. Updating database..."

    cd "$OUT_DIR" || exit 1
    [[ -f "$TARGET_FILE" ]]   && ln -sfn "$TARGET_FILE" tiers.json
    [[ -f "$BIGBOARD_FILE" ]] && ln -sfn "$BIGBOARD_FILE" big_board_tiers.json


    cd "$BACKEND/ingest" || exit 1
    [[ -e "$OUT_DIR/tiers.json" ]] || { echo "tiers.json symlink broken"; exit 1; }
    [[ -e "$OUT_DIR/big_board_tiers.json" ]] || { echo "big_board symlink broken"; exit 1; }
    node upsert.js --week="$CURRENT_WEEK" --year="$CURRENT_YEAR"
    node bigBoardIngest.js
else
    echo "No new data. Skipping database update."
fi