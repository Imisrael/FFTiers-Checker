package fetchtiers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	Qb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt"
	Dst  = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_DST.txt"
	Rb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_RB"
	Wr   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_WR"
	Te   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE"
	Flex = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_FLX"
	K    = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_K.txt"
)

var urls = []string{Qb, Dst, Rb, Wr, Te, Flex, K}
var bigBoardUrls []string = []string{"https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-adjust", "https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-HALF-PPR-adjust", "https://s3-us-west-1.amazonaws.com/fftiers/out/text_ALL-PPR-adjust"}

type mapOfUrls map[string][]string

type Tiers []string

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
	K    ScoringFormats `json:"K"`
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

func (sf *ScoringFormats) appendTier(format string, tier Tiers) {
	switch format {
	case "Standard":
		sf.Standard = append(sf.Standard, tier...)
	case "HALF":
		sf.HalfPPR = append(sf.HalfPPR, tier...)
	case "PPR":
		sf.PPR = append(sf.PPR, tier...)
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
	case "K":
		r.K.addTier(format, tier)
	}
}

func (m mapOfUrls) getLists() {
	for _, u := range urls {
		if u != Qb && u != Dst && u != K {
			m["standard"] = append(m["standard"], u+".txt")
			m["half"] = append(m["half"], u+"-HALF.txt")
			m["ppr"] = append(m["ppr"], u+"-PPR.txt")
		} else if u == Qb {
			m["qb"] = append(m["qb"], u)
		} else if u == Dst {
			m["dst"] = append(m["dst"], u)
		} else {
			m["k"] = append(m["k"], u)
		}
	}
}

func (m mapOfUrls) getBigBoardLists() {
	for i, u := range bigBoardUrls {
		for j := range 3 {
			switch i {
			case 0:
				m["standard"] = append(m["standard"], u+strconv.Itoa(j)+".txt")
			case 1:
				m["half"] = append(m["half"], u+strconv.Itoa(j)+".txt")
			case 2:
				m["ppr"] = append(m["ppr"], u+strconv.Itoa(j)+".txt")
			}
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

	defer wg.Done()

	formatPosition := parseURL(uri)
	checkIfSpecialScoring := strings.Split(formatPosition, "-")
	var position string
	var format string

	if len(checkIfSpecialScoring) > 1 {
		if checkIfSpecialScoring[0] != "" {
			//		fmt.Println("cspecial scoring array?", checkIfSpecialScoring)
			position = checkIfSpecialScoring[0]
			format = checkIfSpecialScoring[1]
		}

	} else {
		//	fmt.Println("NOT", checkIfSpecialScoring)
		format = "Standard"
		position = formatPosition
	}

	req, err := http.NewRequest("GET", uri, nil)
	if err != nil {
		fmt.Println("Error with request: ", err)
	}

	etagPath := "./fetchTiers/cache/" + formatPosition + ".txt"
	oldEtag, err := os.ReadFile(etagPath)
	if err != nil {
		fmt.Println("Error reading etag file: ", err)
	}

	if len(oldEtag) > 0 {
		req.Header.Set("If-None-Match", string(oldEtag))
		fmt.Printf("Checking with ETag: %s\n", string(oldEtag))
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error!: ", err)
	}

	switch resp.StatusCode {
	case http.StatusOK:
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			fmt.Println("ERROR: ", err)
		}
		sb := string(body)

		newEtag := resp.Header.Get("Etag")
		if newEtag != "" {
			if err := os.WriteFile(etagPath, []byte(newEtag), 0644); err != nil {
				fmt.Printf("Error writing etag file: %v\n", err)
			}
			fmt.Printf("Saved new ETag: %s\n", newEtag)
		}

		// Remove the word 'TIER' from each row
		re := regexp.MustCompile(`[0-9]+\:\s`)
		stringWithoutTier := strings.Split(sb, "Tier")

		var tiers Tiers
		for idx, val := range stringWithoutTier {
			if idx != 0 {
				tier := re.ReplaceAllString(val, "")
				tier = strings.TrimSuffix(tier, "\n")
				tier = strings.TrimPrefix(tier, " ")
				tiers = append(tiers, tier)
			}

		}

		fullRankings.addScoringFormat(format, position, tiers)
	case http.StatusNotModified:
		fmt.Println("File not modified!")
	default:
		fmt.Printf("Received unexpected status code: %d\n", resp.StatusCode)
	}

}

func Get() {
	now := time.Now()
	dateString := strconv.Itoa(now.Year()) + "-" + strconv.Itoa(int(now.Month())) + "-" + strconv.Itoa(now.Day())

	var fileName = ""
	mUrls := make(mapOfUrls)
	mUrls.getLists()

	var wg sync.WaitGroup
	var fullRankings = Rankings{}

	for _, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			wg.Add(1)
			fmt.Println("Starting go routine with: " + u)
			go worker(u, &wg, &fullRankings)
		}
	}
	wg.Wait()
	// Check if struct is actually populated before trying to write file
	if !(reflect.ValueOf(fullRankings).IsZero()) {
		b, err := json.MarshalIndent(fullRankings, "", "  ")
		if err != nil {
			fmt.Println("Marshaling error!", err)
		}
		f, err := os.Create("../files/" + dateString + "_tiers" + fileName + ".json")
		if err != nil {
			fmt.Println("Error creating file")
		}
		_, err = f.WriteString(string(b))
		if err != nil {
			fmt.Println("Error writing to file")
		}

		f.Sync()
		defer f.Close()

		// Exit with 0 to indicate successful new json file
		// this indicates to the bash script to go ahead and update DB
		os.Exit(0)
	} else {
		// No Update -- don't run script!
		os.Exit(1)
	}
}

func bigBoardWorker(uri string, bigBoardRankings *ScoringFormats) {

	parsedUrl := parseURL(uri)
	parsedArr := strings.Split(parsedUrl, "-")

	var format = ""

	switch len(parsedArr) {
	case 4:
		format = "HALF"
	case 3:
		format = "PPR"
	case 2:
		format = "Standard"
	default:
		format = "Standard"
	}

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

	var tiers Tiers
	for idx, val := range stringWithoutTier {
		if idx != 0 {
			tier := re.ReplaceAllString(val, "")
			tier = strings.TrimSuffix(tier, "\n")
			tier = strings.TrimPrefix(tier, " ")
			tiers = append(tiers, tier)
		}

	}

	bigBoardRankings.appendTier(format, tiers)

}

func GetBigBoard() {
	now := time.Now()
	dateString := strconv.Itoa(now.Year()) + "-" + strconv.Itoa(int(now.Month())) + "-" + strconv.Itoa(now.Day())
	mUrls := make(mapOfUrls)
	mUrls.getBigBoardLists()
	var fileName = "_bigBoard"

	//	fmt.Printf("list of urls: %s \n", mUrls)

	var wg sync.WaitGroup
	var bigBoardRankings = ScoringFormats{}

	for _, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			bigBoardWorker(u, &bigBoardRankings)
		}
	}
	wg.Wait()
	b, err := json.MarshalIndent(bigBoardRankings, "", "  ")
	if err != nil {
		fmt.Println("Marshaling error!", err)
	}
	f, err := os.Create("../files/" + dateString + "_tiers" + fileName + ".json")
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
