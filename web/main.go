package main

import (
	"log"
    "io"
    "fmt"
    "os"
    "net/http"
    "regexp"
    "strings"
    "time"
)

const (
    Qb = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt"
    Dst = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_DST.txt"
    Rb = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_RB"
    Wr = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_WR"
    Te =  "https://s3-us-west-1.amazonaws.com/fftiers/out/text_TE"
    Flex = "https://s3-us-west-1.amazonaws.com/fftiers/out/text_FLX"
)

const (
    Standard int = iota
    Half
    Full
)

type tier struct {
    rulesFormat int
    playerPosition string
    players map[int][]string
    date time.Time
}

func urlBuilder(name tier) string {
    s := ""
    if !(name.playerPosition == Qb || name.playerPosition == Dst ) {
        switch name.rulesFormat {
            case 1:
                s = "-HALF.txt"
            case 2:
             s = "-PPR.txt"
            default:
                s = ".txt"

        }
    }
    fullUrl := name.playerPosition + s
    fmt.Println(fullUrl)
    return fullUrl
}

func constGetter (playerPosition string) string {
    var retVal string
    switch playerPosition {
        case "FLEX":
            retVal = Flex
        case "QB": 
            retVal = Qb
        case "WR":
            retVal = Wr
        case "RB":
            retVal = Rb
        case "TE":
            retVal = Te
        case "DST":
            retVal = Dst
        default:
            retVal = Flex
    }
    return retVal
}

func formatGetter (rulesFormat string) int {
    var retVal int

    switch rulesFormat {
        case "STANDARD":
            retVal = 0
        case "HALF":
            retVal = 1
        case "PPR":
            retVal = 2
        default: 
            retVal = 0
    }

    return retVal
}

func main() {

    playerPosition := strings.ToUpper(os.Args[1])
    playerPosition = constGetter(playerPosition)

    rulesFormat := strings.ToUpper(os.Args[2])
    formatInt := formatGetter(rulesFormat)

    half := tier{formatInt, playerPosition, make(map[int][]string), time.Now()}
    url := urlBuilder(half)

    resp, err := http.Get(url)
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
    fmt.Println(date)
    localTime := date.In(location)
    half.date = localTime

    re := regexp.MustCompile(`[0-9]+\:\s`)
    player := os.Args[3]
    findPlayerRe := regexp.MustCompile(`(?i)([A-Za-z]+\s)?` + player  + `(\s[A-Za-z]+)?`)
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
                fmt.Println(tier, st)
                half.players[tier] = append(half.players[tier], st) 
            }
        }
    }

    fmt.Println(half)
}
