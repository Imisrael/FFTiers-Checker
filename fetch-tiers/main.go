package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
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

func worker(uri string, wg *sync.WaitGroup) {
	resp, err := http.Get(uri)
	if err != nil {
		fmt.Println("Error!: ", err)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("ERROR: ", err)
	}
	sb := string(body)

	var totalString strings.Builder

	re := regexp.MustCompile(`[0-9]+\:\s`)
	stringWithoutTier := strings.Split(sb, "Tier")
	for idx, val := range stringWithoutTier {
		tier := re.ReplaceAllString(val, "")
		totalString.WriteString((strconv.Itoa(idx) + " " + tier))
	}

	u, err := url.Parse(uri)
	if err != nil {
		fmt.Println("Paning url", err)
	}
	paths := strings.Split(u.Path, "/")

	filename := paths[len(paths)-1]
	f, err := os.Create(filename)
	if err != nil {
		fmt.Println("error creating file: ", err)
		panic(err)
	}
	defer f.Close()
	f.WriteString(totalString.String())

	f.Sync()
	defer wg.Done()
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
