package logger

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestNewConfiguresLevelsAndFormats(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		level      string
		format     string
		wantJSON   bool
		wantError  bool
		debugShown bool
	}{
		{name: "defaults", level: "", format: "", wantJSON: true},
		{name: "debug json", level: "DEBUG", format: "json", wantJSON: true, debugShown: true},
		{name: "warning text", level: "warning", format: "TEXT"},
		{name: "error text", level: "error", format: "text"},
		{name: "invalid level", level: "verbose", format: "json", wantError: true},
		{name: "invalid format", level: "info", format: "xml", wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			var output bytes.Buffer
			logger, err := New(&output, test.level, test.format)
			if (err != nil) != test.wantError {
				t.Fatalf("New() error = %v, wantError = %v", err, test.wantError)
			}
			if test.wantError {
				return
			}
			logger.Debug("debug message")
			logger.LogAttrs(t.Context(), slog.LevelError, "error message", slog.String("component", "test"))
			text := output.String()
			if strings.Contains(text, "debug message") != test.debugShown {
				t.Fatalf("debug visibility in %q = %v, want %v", text, strings.Contains(text, "debug message"), test.debugShown)
			}
			if !strings.Contains(text, "error message") || !strings.Contains(text, "component") {
				t.Fatalf("structured error output = %q", text)
			}
			if strings.HasPrefix(strings.TrimSpace(text), "{") != test.wantJSON {
				t.Fatalf("JSON output = %v, want %v; output = %q", strings.HasPrefix(strings.TrimSpace(text), "{"), test.wantJSON, text)
			}
		})
	}
}
