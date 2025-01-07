package main

import (
	"log"
	"net/http"
	"os"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

type hello struct {
	app.Compo
}

func (h *hello) Render() app.UI {

	dat, err := os.ReadFile("testing.txt")
	if err != nil {
		panic(err)
	}

	return app.H1().Text(string(dat))
}

func main() {
	app.Route("/", func() app.Composer { return &hello{} })

	app.RunWhenOnBrowser()

	http.Handle("/", &app.Handler{
		Name:        "Hello",
		Description: "An Hello World! example",
	})

	if err := http.ListenAndServe(":8000", nil); err != nil {
		log.Fatal(err)
	}
}
