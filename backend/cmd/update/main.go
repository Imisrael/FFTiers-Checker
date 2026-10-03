package main

import (
	"log"
	"os"

	"israelimru.com/cli/internal/fftiers"
)

func main() {
	log.SetFlags(0)

	updated, err := fftiers.Get()
	if err != nil {
		log.Fatalf("weekly tiers: %v", err)
	}

	if err := fftiers.GetBigBoard(); err != nil {
		log.Fatalf("big board: %v", err)
	}

	// Exit status is the contract with the shell script: 0 means a fresh
	// weekly file was written and the DB update should run, 1 means nothing
	// changed upstream.
	if !updated {
		os.Exit(1)
	}
}
