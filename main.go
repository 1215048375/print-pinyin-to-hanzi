package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed index.html styles.css app.js libs/*
var assets embed.FS

func main() {
	err := wails.Run(&options.App{
		Title:     "田字格拼音练习生成器",
		Width:     1280,
		Height:    900,
		MinWidth:  960,
		MinHeight: 720,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 245, G: 247, B: 251, A: 1},
	})
	if err != nil {
		log.Fatal(err)
	}
}
