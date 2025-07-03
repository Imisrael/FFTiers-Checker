package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
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

	fmt.Println(jsonTiers)
	return jsonTiers
}

func getTiers(c *gin.Context) {
	log.Println("Getting new tier list!")
	fetchtiers.Get()
	c.Status(http.StatusOK)
}

func serveJSON(c *gin.Context) {
	jsonTiers := readFile()
	c.JSON(http.StatusOK, jsonTiers)
}

func main() {
	router := gin.Default()
	router.Use(cors.Default())

	router.Static("/assets", "../frontend/dist/assets")
	router.LoadHTMLFiles("../frontend/dist/index.html")
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{})
	})
	router.GET("/json", serveJSON)
	router.GET("/refresh", getTiers)

	router.Run()
}
