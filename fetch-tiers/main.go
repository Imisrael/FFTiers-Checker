package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	All      Tiers `json:"All,omitempty"`
}

type Rankings struct {
	QB   ScoringFormats `json:"QB"`
	RB   ScoringFormats `json:"RB"`
	WR   ScoringFormats `json:"WR"`
	TE   ScoringFormats `json:"TE"`
	Flex ScoringFormats `json:"Flex"`
	DST  ScoringFormats `json:"DST"`
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

// https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE-PPR.txt
func worker(uri string, wg *sync.WaitGroup) {

	formatPosition := parseURL(uri)

	checkIfSpecialScoring := strings.Split(formatPosition, "-")
	if len(checkIfSpecialScoring) > 1 {

		fmt.Println("special scoring!")
		fmt.Println(checkIfSpecialScoring)
	} else {

		fmt.Println("standard")
		fmt.Println(formatPosition)
	}

	var tiers = make(Tiers)
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

	// u, err := url.Parse(uri)
	// if err != nil {
	// 	fmt.Println("Paning url", err)
	// }
	// paths := strings.Split(u.Path, "/")

	// Remove the word 'TIER' from each row
	re := regexp.MustCompile(`[0-9]+\:\s`)
	stringWithoutTier := strings.Split(sb, "Tier")

	teRankings := Rankings{}
	pprFormat := ScoringFormats{}
	for idx, val := range stringWithoutTier {
		tier := re.ReplaceAllString(val, "")
		//	totalString.WriteString((strconv.Itoa(idx) + " " + tier))
		tiers[idx] = tier
	}
	pprFormat.PPR = tiers
	teRankings.TE = pprFormat

	//fmt.Println(teRankings)

}

func main() {

	mUrls := make(mapOfUrls)
	mUrls.getLists()

	//	fmt.Printf("list of urls: %s \n", mUrls)

	var wg sync.WaitGroup

	for _, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			wg.Add(1)
			go worker(u, &wg)
		}
	}
	wg.Wait()
}
