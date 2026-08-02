package handler

import (
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"netdiagram/internal/sse"
	"netdiagram/internal/store"
	webassets "netdiagram/web"
)

func TestHealth(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if response.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("Content-Security-Policy header is missing")
	}
}

func TestStaticFallback(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	request := httptest.NewRequest(http.MethodGet, "/diagram/client-route", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if response.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want HTML", response.Header().Get("Content-Type"))
	}
}

func BenchmarkHealth(b *testing.B) {
	handler := newTestHandler(b)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	b.ReportAllocs()
	for b.Loop() {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
	}
}

type testingTB interface {
	TempDir() string
	Fatal(args ...any)
}

func newTestHandler(t testingTB) http.Handler {
	topologyStore, err := store.NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	return New(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static)
}
