#!/bin/bash

CACHE_DIR="/home/israel/development/FFTiers-Checker/backend/fetchTiers/cache"
find "$CACHE_DIR" -type f -name "*.txt" -exec sh -c '> "$1"' _ {} \;
