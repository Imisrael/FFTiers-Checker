package fftiers

import (
	"fmt"
	"os"
)

// readETag returns the cached ETag for key, or "" if there is none. A missing
// cache file is the normal cold-start case, not an error.
func readETag(key string) string {
	b, err := os.ReadFile(etagPath(key))
	if err != nil {
		return ""
	}
	return string(b)
}

func writeETag(key, etag string) error {
	if err := os.WriteFile(etagPath(key), []byte(etag), 0o644); err != nil {
		return fmt.Errorf("writing etag for %s: %w", key, err)
	}
	return nil
}
