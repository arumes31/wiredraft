package handler

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func FuzzDecodeJSON(f *testing.F) {
	f.Add([]byte(`{"name":"fuzz","template":"demo"}`))
	f.Add([]byte(`{"name":"fuzz","unknown":true}`))
	f.Add([]byte(`{}{} `))
	f.Fuzz(func(t *testing.T, input []byte) {
		if len(input) > maxRequestBody+1 {
			t.Skip()
		}
		request := httptest.NewRequest("POST", "/", bytes.NewReader(input))
		response := httptest.NewRecorder()
		var destination struct {
			Name     string `json:"name"`
			Template string `json:"template"`
		}
		_ = decodeJSON(response, request, &destination)
	})
}
