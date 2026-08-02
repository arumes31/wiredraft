// Package web embeds the browser application into the server binary.
package web

import "embed"

// Static contains the complete zero-build frontend.
//
//go:embed static
var Static embed.FS
