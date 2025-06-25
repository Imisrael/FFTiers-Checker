package fetchtiers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
)

const (
	Qb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt"
	Dst  = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_DST.txt"
	Rb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_RB"
	Wr   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_WR"
	Te   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE"
	Flex = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_FLX"
)

var urls = []string{Qb, Dst, Rb, Wr, Te, Flex}

type mapOfUrls map[string][]string

type Tiers map[int]string

type ScoringFormats struct {
	Standard Tiers `json:"Standard,omitempty"`
	PPR      Tiers `json:"PPR,omitempty"`
	HalfPPR  Tiers `json:"HalfPPR,omitempty"`
}

type Rankings struct {
	QB   ScoringFormats `json:"QB"`
	RB   ScoringFormats `json:"RB"`
	WR   ScoringFormats `json:"WR"`
	TE   ScoringFormats `json:"TE"`
	Flex ScoringFormats `json:"Flex"`
	DST  ScoringFormats `json:"DST"`
}

func (sf *ScoringFormats) addTier(format string, tier Tiers) {
	//	fmt.Println("Parsing Type: " + format)

	switch format {
	case "Standard":
		sf.Standard = tier
	case "HALF":
		sf.HalfPPR = tier
	case "PPR":
		sf.PPR = tier
	}
}

func (r *Rankings) addScoringFormat(format, position string, tier Tiers) {
	//fmt.Println("Adding Scoring Format " + format + " " + position)

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
	}
}

func (m mapOfUrls) getLists() {
	for _, u := range urls {
		if u != Qb && u != Dst {
			m["standard"] = append(m["standard"], u+".txt")
			m["half"] = append(m["half"], u+"-HALF.txt")
			m["ppr"] = append(m["ppr"], u+"-PPR.txt")
		} else if u == Qb {
			m["qb"] = append(m["qb"], u)
		} else {
			m["dst"] = append(m["dst"], u)
		}
	}
}

func parseURL(urlString string) string {
	u, err := url.Parse(urlString)
	if err != nil {
		fmt.Println("Paning url", err)
	}
	paths := strings.Split(u.Path, "/")
	n := len(paths)
	fileName := paths[n-1]

	stringArray := strings.Split(fileName, "_")
	s := stringArray[1]
	removeFileExt := strings.Split(s, ".")

	return removeFileExt[0]
}

func worker(uri string, wg *sync.WaitGroup, fullRankings *Rankings) {

	formatPosition := parseURL(uri)
	checkIfSpecialScoring := strings.Split(formatPosition, "-")
	var position string
	var format string

	if len(checkIfSpecialScoring) > 1 {
		if checkIfSpecialScoring[0] != "" {
			//fmt.Println("cspecial scoring array?", checkIfSpecialScoring)
			position = checkIfSpecialScoring[0]
			format = checkIfSpecialScoring[1]
		}

	} else {
		format = "Standard"
		position = formatPosition
	}

	defer wg.Done()

	resp, err := http.Get(uri)
	if err != nil {
		fmt.Println("Error!: ", err)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("ERROR: ", err)
	}
	sb := string(body)

	// Remove the word 'TIER' from each row
	re := regexp.MustCompile(`[0-9]+\:\s`)
	stringWithoutTier := strings.Split(sb, "Tier")

	var tiers = make(Tiers)
	for idx, val := range stringWithoutTier {
		if idx != 0 {
			tier := re.ReplaceAllString(val, "")
			tier = strings.TrimSuffix(tier, "\n")
			tier = strings.TrimPrefix(tier, " ")
			tiers[idx] = tier
		}

	}

	fullRankings.addScoringFormat(format, position, tiers)

}

func main() {

	mUrls := make(mapOfUrls)
	mUrls.getLists()

	//	fmt.Printf("list of urls: %s \n", mUrls)

	var wg sync.WaitGroup
	var fullRankings = Rankings{}

	for _, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			wg.Add(1)
			go worker(u, &wg, &fullRankings)
		}
	}
	wg.Wait()
	b, err := json.MarshalIndent(fullRankings, "", "  ")
	if err != nil {
		fmt.Println("Marshaling error!", err)
	}
	f, err := os.Create("../../files/tiers.json")
	if err != nil {
		fmt.Println("Error creating file")
	}
	_, err = f.WriteString(string(b))
	if err != nil {
		fmt.Println("Error writing to file")
	}
	f.Sync()
	defer f.Close()
}
