package fftiers

// Scoring format identifiers. These are the values used as keys throughout
// the package and as the JSON field selectors on ScoringFormats.
const (
	FormatStandard = "Standard"
	FormatHalf     = "HALF"
	FormatPPR      = "PPR"
)

// Tiers is an ordered list of tier strings, one entry per tier.
type Tiers []string

// ScoringFormats holds one position's tiers across the three scoring formats.
type ScoringFormats struct {
	Standard Tiers `json:"Standard,omitempty"`
	PPR      Tiers `json:"PPR,omitempty"`
	HalfPPR  Tiers `json:"HalfPPR,omitempty"`
}

// Rankings is the full weekly output, one ScoringFormats per position.
type Rankings struct {
	QB   ScoringFormats `json:"QB"`
	RB   ScoringFormats `json:"RB"`
	WR   ScoringFormats `json:"WR"`
	TE   ScoringFormats `json:"TE"`
	Flex ScoringFormats `json:"Flex"`
	DST  ScoringFormats `json:"DST"`
	K    ScoringFormats `json:"K"`
}

// addTier replaces the tiers for the given format.
func (sf *ScoringFormats) addTier(format string, tier Tiers) {
	switch format {
	case FormatStandard:
		sf.Standard = tier
	case FormatHalf:
		sf.HalfPPR = tier
	case FormatPPR:
		sf.PPR = tier
	}
}

// appendTier extends the tiers for the given format. Used by the big board,
// where one format's list is assembled from several source files.
func (sf *ScoringFormats) appendTier(format string, tier Tiers) {
	switch format {
	case FormatStandard:
		sf.Standard = append(sf.Standard, tier...)
	case FormatHalf:
		sf.HalfPPR = append(sf.HalfPPR, tier...)
	case FormatPPR:
		sf.PPR = append(sf.PPR, tier...)
	}
}

func (r *Rankings) addScoringFormat(format, position string, tier Tiers) {
	switch position {
	case "QB":
		r.QB.addTier(format, tier)
	case "DST":
		r.DST.addTier(format, tier)
	case "RB":
		r.RB.addTier(format, tier)
	case "WR":
		r.WR.addTier(format, tier)
	case "TE":
		r.TE.addTier(format, tier)
	case "FLX":
		r.Flex.addTier(format, tier)
	case "K":
		r.K.addTier(format, tier)
	}
}
