// Package logger configures the process-wide structured logger.
package logger

import (
	"fmt"
	"io"
	"log/slog"
	"strings"
)

// New returns a structured logger using the requested level and output format.
func New(output io.Writer, levelName, format string) (*slog.Logger, error) {
	var level slog.Level
	switch strings.ToLower(levelName) {
	case "debug":
		level = slog.LevelDebug
	case "info", "":
		level = slog.LevelInfo
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		return nil, fmt.Errorf("unknown log level %q", levelName)
	}

	options := &slog.HandlerOptions{Level: level}
	var handler slog.Handler
	switch strings.ToLower(format) {
	case "json", "":
		handler = slog.NewJSONHandler(output, options)
	case "text":
		handler = slog.NewTextHandler(output, options)
	default:
		return nil, fmt.Errorf("unknown log format %q", format)
	}
	return slog.New(handler), nil
}
