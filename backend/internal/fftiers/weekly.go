package fftiers

import (
	"fmt"
	"io"
	"net/http"
	"reflect"
	"sync"
	"time"
)

func worker(uri string, wg *sync.WaitGroup, mu *sync.Mutex, fullRankings *Rankings) {
	defer wg.Done()

	descriptor := parseURL(uri)
	position, format := splitFormatPosition(descriptor)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		fmt.Printf("%s: building request: %v\n", descriptor, err)
		return
	}

	if oldEtag := readETag(descriptor); oldEtag != "" {
		req.Header.Set("If-None-Match", oldEtag)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("%s: request failed: %v\n", descriptor, err)
		return
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			fmt.Printf("%s: reading body: %v\n", descriptor, err)
			return
		}

		if etag := resp.Header.Get("ETag"); etag != "" {
			if err := writeETag(descriptor, etag); err != nil {
				fmt.Println(err)
			}
		}

		tiers := parseTiers(string(body))

		mu.Lock()
		fullRankings.addScoringFormat(format, position, tiers)
		mu.Unlock()

	case http.StatusNotModified:
		fmt.Printf("%s: not modified\n", descriptor)

	default:
		fmt.Printf("%s: unexpected status %d\n", descriptor, resp.StatusCode)
	}
}

// Get fetches the weekly tiers and writes them to the dated output file.
// It reports whether anything changed upstream: false means every source
// returned 304 and no file was written.
func Get() (updated bool, err error) {
	if err := ensureDirs(); err != nil {
		return false, err
	}

	dateString := time.Now().Format("2006-01-02")

	mUrls := make(mapOfUrls)
	mUrls.getLists()

	var (
		wg           sync.WaitGroup
		mu           sync.Mutex
		fullRankings Rankings
	)

	for _, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			wg.Add(1)
			fmt.Println("fetching " + u)
			go worker(u, &wg, &mu, &fullRankings)
		}
	}
	wg.Wait()

	if reflect.ValueOf(fullRankings).IsZero() {
		return false, nil
	}

	if err := writeJSON(outPath(dateString, ""), fullRankings); err != nil {
		return false, err
	}
	return true, nil
}
