package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
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

	fmt.Println("Make requests")
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
		fmt.Println("kicking off go routine")
		tier := re.ReplaceAllString(val, "")
		f, err := os.Create(url)
		if err != nil {
			fmt.Println("Errpr in creating url file name", err)
			panic(err)
		}
		defer f.Close()

		f.WriteString(strconv.Itoa(idx) + tier)
		f.Sync()

	}
}

func requests(position, url string, contents chan bool) {

}

func writeToFile(contents chan string) {

}

func main() {

	mUrls := make(mapOfUrls)
	mUrls.getLists()
	fmt.Printf("list of urls: %s \n", mUrls)
	m := make(mapOfMaps)
	for formatType, sliceUrls := range mUrls {
		for _, u := range sliceUrls {
			fmt.Println("Before we start the go routine")
			go func() {
				fmt.Println("Kicking off the party")
				m.makeRequests(formatType, u)
			}()
		}
	}
}
