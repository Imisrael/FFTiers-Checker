package fftiers

import (
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// fetchTiers retrieves and parses one tiers file. The big board sources are
// not ETag-cached, unlike the weekly ones.
func fetchTiers(uri string) (Tiers, error) {
	resp, err := http.Get(uri)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", uri, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get %s: status %d", uri, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", uri, err)
	}
	return parseTiers(string(body)), nil
}

type bigBoardJob struct {
	key string
	idx int
	uri string
}

// GetBigBoard fetches the big board for every scoring format and writes the
// dated output file.
//
// Each format's board is split across several numbered source files whose
// order is significant, so results are written into a fixed slot per URL and
// concatenated only after every fetch has finished. Appending straight from
// the goroutines would scramble the ranking.
func GetBigBoard() error {
	if err := ensureDirs(); err != nil {
		return err
	}

	dateString := time.Now().Format("2006-01-02")

	mUrls := make(mapOfUrls)
	mUrls.getBigBoardLists()

	var jobs []bigBoardJob
	results := make(map[string][]Tiers, len(mUrls))
	for key, sliceUrls := range mUrls {
		results[key] = make([]Tiers, len(sliceUrls))
		for i, u := range sliceUrls {
			jobs = append(jobs, bigBoardJob{key: key, idx: i, uri: u})
		}
	}

	// results is only read concurrently below; each goroutine writes to its
	// own slice slot, so no lock is needed.
	var wg sync.WaitGroup
	for _, j := range jobs {
		wg.Add(1)
		go func(j bigBoardJob) {
			defer wg.Done()

			fmt.Println("fetching " + j.uri)
			tiers, err := fetchTiers(j.uri)
			if err != nil {
				fmt.Println(err)
				return
			}
			results[j.key][j.idx] = tiers
		}(j)
	}
	wg.Wait()

	var bigBoardRankings ScoringFormats
	for key, chunks := range results {
		format := formatFromKey(key)
		for _, tiers := range chunks {
			bigBoardRankings.appendTier(format, tiers)
		}
	}

	return writeJSON(outPath(dateString, "_bigBoard"), bigBoardRankings)
}
