package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	Qb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt"
	Dst  = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_DST.txt"
	Rb   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_RB"
	Wr   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_WR"
	Te   = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE"
	Flex = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_FLX"
)

const (
	Standard int = iota
	Half
	Full
)

type tier struct {
	rulesFormat int
	url         string
	players     map[int][]string
	date        time.Time
}

func (t *tier) GetUrl() {

	if !(t.url == Qb || t.url == Dst) {
		switch t.rulesFormat {
		case 1:
			t.url = t.url + "-HALF.txt"
		case 2:
			t.url = t.url + "-PPR.txt"
		default:
			t.url = t.url + ".txt"
		}
	}
}

func (t *tier) getUrlBasedOnPos(pos string) {
	switch pos {
	case "FLEX":
		t.url = Flex
	case "QB":
		t.url = Qb
	case "WR":
		t.url = Wr
	case "RB":
		t.url = Rb
	case "TE":
		t.url = Te
	case "DST":
		t.url = Dst
	default:
		t.url = Flex
	}
}

func (t *tier) formatGetter(rulesFormat string) {

	switch rulesFormat {
	case "STANDARD":
		t.rulesFormat = 0
	case "HALF":
		t.rulesFormat = 1
	case "PPR":
		t.rulesFormat = 2
	default:
		t.rulesFormat = 0
	}

}

func initObj(playerPosition string, rulesFormat int) *tier {
	obj := tier{0, "", make(map[int][]string), time.Now()}
	obj.getUrlBasedOnPos(playerPosition)
	obj.formatGetter(rulesFormat)
	obj.GetUrl()
	return &obj
}

func main() {
	playerPosition := strings.ToUpper(os.Args[1])
	rulesFormat := strings.ToUpper(os.Args[2])

	obj := initObj(playerPosition, rulesFormat)
	resp, err := http.Get(obj.url)
	if err != nil {
		log.Fatalln(err)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln(err)
	}

	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		panic(err)
	}
	lastUpdated := resp.Header["Last-Modified"][0]
	date, err := time.Parse(time.RFC1123, lastUpdated)
	if err != nil {
		panic(err)
	}
	localTime := date.In(location)
	obj.date = localTime

	re := regexp.MustCompile(`[0-9]+\:\s`)
	player := os.Args[3]
	findPlayerRe := regexp.MustCompile(`(?i)([A-Za-z]+\s)?` + player + `(\s[A-Za-z]+)?`)
	mapOfTiers := make((map[int]string))
	sb := string(body)
	newString := strings.Split(sb, "Tier")
	for idx, val := range newString {
		tier := re.ReplaceAllString(val, "")
		mapOfTiers[idx] = tier
	}

	var tier int
	for ti, val := range mapOfTiers {
		testing := strings.Split(val, ",")
		tier = ti
		for _, t := range testing {
			st := findPlayerRe.FindString(t)
			if st != "" {
				//fmt.Println(tier, st)
				obj.players[tier] = append(obj.players[tier], st)
			}
		}
	}

	fmt.Println(obj.players)
	fmt.Println(obj.date)
}
