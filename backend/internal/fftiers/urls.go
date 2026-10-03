package fftiers

import "strconv"

// Weekly tier source URLs. Positions with per-format variants are stored as
// prefixes; the suffix is appended in getLists.
const (
	Qb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt"
	Dst  = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_DST.txt"
	Rb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_RB"
	Wr   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_WR"
	Te   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE"
	Flex = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_FLX"
	K    = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_K.txt"
)

var weeklyUrls = []string{Qb, Dst, Rb, Wr, Te, Flex, K}

// Big board sources. Each base URL is split across bigBoardChunks numbered
// files that must be concatenated in order to reconstruct the full list.
var bigBoardUrls = []string{
	"https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-adjust",
	"https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-HALF-PPR-adjust",
	"https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-PPR-adjust",
}

const bigBoardChunks = 3

// mapOfUrls keys. The key carries the scoring format for big board fetches.
const (
	keyStandard = "standard"
	keyHalf     = "half"
	keyPPR      = "ppr"
	keyQB       = "qb"
	keyDST      = "dst"
	keyK        = "k"
)

// bigBoardKeys maps each entry of bigBoardUrls to its scoring format key,
// positionally.
var bigBoardKeys = []string{keyStandard, keyHalf, keyPPR}

type mapOfUrls map[string][]string

func (m mapOfUrls) getLists() {
	for _, u := range weeklyUrls {
		switch u {
		case Qb:
			m[keyQB] = append(m[keyQB], u)
		case Dst:
			m[keyDST] = append(m[keyDST], u)
		case K:
			m[keyK] = append(m[keyK], u)
		default:
			m[keyStandard] = append(m[keyStandard], u+".txt")
			m[keyHalf] = append(m[keyHalf], u+"-HALF.txt")
			m[keyPPR] = append(m[keyPPR], u+"-PPR.txt")
		}
	}
}

func (m mapOfUrls) getBigBoardLists() {
	for i, base := range bigBoardUrls {
		key := bigBoardKeys[i]
		for j := 0; j < bigBoardChunks; j++ {
			m[key] = append(m[key], base+strconv.Itoa(j)+".txt")
		}
	}
}

// formatFromKey resolves a mapOfUrls key to a scoring format.
func formatFromKey(key string) string {
	switch key {
	case keyHalf:
		return FormatHalf
	case keyPPR:
		return FormatPPR
	default:
		return FormatStandard
	}
}
