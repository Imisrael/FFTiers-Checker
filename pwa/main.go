package main

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
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

type mapOfMaps map[string]map[int]string

func (m mapOfMaps) makeRequests(position, url string) {
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("Error: %s", err)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error for body read: %s", err)
	}
	re := regexp.MustCompile(`[0-9]+\:\s`)
	sb := string(body)
	newString := strings.Split(sb, "Tier")
	for idx, val := range newString {
		tier := re.ReplaceAllString(val, "")
		theMap := map[int]string{idx: tier}
		m[position] = theMap
	}

}

func main() {
	mUrls := make(mapOfUrls)
	mUrls.getLists()
	m := make(mapOfMaps)
	for k, v := range mUrls {
		m.makeRequests(k, v)
	}
	fmt.Println(m)
}
