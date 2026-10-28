package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"wiredraft/internal/model"
)

const maxRequestBody = 2 << 20

type errorResponse struct {
	Error string `json:"error"`
	Code  int    `json:"code"`
}

func decodeJSON(w http.ResponseWriter, request *http.Request, destination any) error {
	request.Body = http.MaxBytesReader(w, request.Body, maxRequestBody)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("decoding json body: %w", err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return fmt.Errorf("checking json body: %w", err)
	}
	return errors.New("request body contains multiple json values")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	if topology, ok := value.(model.Topology); ok {
		value = publicTopology(topology)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(http.ErrAbortHandler)
	}
}

// publicTopology removes share-grant token digests from a topology before it
// leaves the server. Clients list shares through the shares endpoint, so the
// digests never need to reach browsers, event streams or exported files.
func publicTopology(topology model.Topology) model.Topology {
	topology.ShareGrants = nil
	return topology
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message, Code: status})
}
