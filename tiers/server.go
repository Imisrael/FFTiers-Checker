package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
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

	//	fmt.Println(jsonTiers)
	return jsonTiers
}

func getTiers(e *core.RequestEvent) error {
	log.Println("Getting new tier list!")
	fetchtiers.Get()
	return e.String(http.StatusOK, "Okay cools")
}

func serveJSON(e *core.RequestEvent) error {
	jsonTiers := readFile()
	return e.JSON(http.StatusOK, jsonTiers)
}

func main() {

	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/", apis.Static(os.DirFS("../frontend/dist/"), false))
		se.Router.GET("/json", serveJSON)
		se.Router.GET("/refresh", getTiers)
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}

}
