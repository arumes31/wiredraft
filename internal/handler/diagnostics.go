package handler

import (
	"net/http"
	"runtime"
	"runtime/debug"
)

// BuildRevision may be set by release builds that do not include Git metadata.
var BuildRevision = ""

func (s *Server) diagnostics(w http.ResponseWriter, _ *http.Request) {
	result := map[string]string{
		"application": "WireDraft", "revision": "development", "modified": "unknown",
		"goVersion": runtime.Version(),
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			switch setting.Key {
			case "vcs.revision":
				result["revision"] = setting.Value
			case "vcs.modified":
				result["modified"] = setting.Value
			}
		}
	}
	if BuildRevision != "" {
		result["revision"] = BuildRevision
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}
