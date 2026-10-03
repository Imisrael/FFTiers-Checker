package fftiers

import (
	"net/url"
	"regexp"
	"strings"
)

// tierRe matches the "N: " tier number prefix. Compiled once at package level
// rather than per fetch.
var tierRe = regexp.MustCompile(`[0-9]+:\s`)

// parseURL pulls the descriptor out of a fftiers URL.
// .../text_RB-HALF.txt yields "RB-HALF"; .../text_QB.txt yields "QB".
func parseURL(urlString string) string {
	u, err := url.Parse(urlString)
	if err != nil {
		return ""
	}

	paths := strings.Split(u.Path, "/")
	fileName := paths[len(paths)-1]

	parts := strings.SplitN(fileName, "_", 2)
	if len(parts) < 2 {
		return strings.TrimSuffix(fileName, ".txt")
	}
	return strings.TrimSuffix(parts[1], ".txt")
}

// splitFormatPosition turns a descriptor into its position and scoring format.
// "RB-HALF" yields ("RB", "HALF"); "QB" yields ("QB", "Standard").
func splitFormatPosition(descriptor string) (position, format string) {
	parts := strings.SplitN(descriptor, "-", 2)
	if len(parts) == 2 && parts[0] != "" {
		return parts[0], parts[1]
	}
	return descriptor, FormatStandard
}

// parseTiers splits a raw tiers file into one entry per tier, stripping the
// leading "Tier N: " marker from each.
func parseTiers(body string) Tiers {
	var tiers Tiers
	for idx, val := range strings.Split(body, "Tier") {
		// The text before the first "Tier" marker is not a tier.
		if idx == 0 {
			continue
		}
		t := tierRe.ReplaceAllString(val, "")
		t = strings.TrimSuffix(t, "\n")
		t = strings.TrimPrefix(t, " ")
		tiers = append(tiers, t)
	}
	return tiers
}
