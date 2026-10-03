package fftiers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// root is the anchor for every path this package touches. Set FFT_ROOT when
// running from outside the backend directory (cron, systemd, containers).
func root() string {
	if r := os.Getenv("FFT_ROOT"); r != "" {
		return r
	}
	return "."
}

func etagPath(key string) string {
	return filepath.Join(root(), "data", "cache", key+".txt")
}

func outPath(dateString, suffix string) string {
	return filepath.Join(root(), "data", "out", dateString+"_tiers"+suffix+".json")
}

// ensureDirs creates the cache and output directories if they are missing.
func ensureDirs() error {
	dirs := []string{
		filepath.Join(root(), "data", "cache"),
		filepath.Join(root(), "data", "out"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return fmt.Errorf("creating %s: %w", d, err)
		}
	}
	return nil
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling %s: %w", path, err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("creating dir for %s: %w", path, err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		return fmt.Errorf("writing %s: %w", path, err)
	}
	return nil
}
