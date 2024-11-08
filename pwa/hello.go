package main

import (
	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

type hello struct {
	app.Compo
	name             string
	isAppInstallable bool
}

func (h *hello) OnMount(ctx app.Context) {
	h.isAppInstallable = ctx.IsAppInstallable()
}

func (h *hello) OnAppInstallChange(ctx app.Context) {
	h.isAppInstallable = ctx.IsAppInstallable()
}

func (h *hello) Render() app.UI {
	return app.Div().
		Body(
			app.H1().Body(
				app.Text("Hello, "),
				app.If(h.name != "", func() app.UI {
					return app.Text(h.name)
				}).Else(func() app.UI {
					return app.Text("World!")
				}),
			),
			app.P().Body(
				app.Input().
					Type("Text").
					Value(h.name).
					Placeholder("Whatis your naem").
					AutoFocus(true).
					OnChange(h.ValueTo(&h.name)),
			),
		)
}

func (h *hello) onInstallButtonClicked(ctx app.Context, e app.Event) {
	ctx.ShowAppInstallPrompt()
}
