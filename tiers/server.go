package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	fetchtiers "israelimru.com/cli/fetchTiers"
)

func readFile() fetchtiers.Rankings {
	b, err := os.ReadFile("../files/tiers.json")
	if err != nil {
		fmt.Println("Error Reading local file", err)
	}
	var jsonTiers = fetchtiers.Rankings{}
	err = json.Unmarshal(b, &jsonTiers)
	if err != nil {
		fmt.Println("Error unmarshaling", err)
	}

	return jsonTiers
}

func serveJSON(c *gin.Context) {
	jsonTiers := readFile()
	c.JSON(http.StatusOK, jsonTiers)
}

func main() {
	router := gin.Default()

	router.GET("/json", serveJSON)

	router.Run()
}
