// Command loadtest exercises API reads and long-lived SSE connections.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sync"
	"sync/atomic"
	"time"
)

// maxTopologyListBytes caps the decompressed topology list the load test reads.
const maxTopologyListBytes = 4 << 20

var topologyIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

type topologySummary struct {
	ID string `json:"id"`
}

func main() {
	os.Exit(run())
}

func run() int {
	baseURL := flag.String("url", "http://127.0.0.1:8080", "WireDraft base URL")
	duration := flag.Duration("duration", 10*time.Second, "load duration")
	workers := flag.Int("workers", 16, "concurrent API workers")
	sseClients := flag.Int("sse", 64, "concurrent SSE connections")
	flag.Parse()
	if *workers < 1 || *sseClients < 0 || *duration <= 0 {
		fmt.Fprintln(os.Stderr, "workers and duration must be positive; SSE clients may be zero")
		return 2
	}

	client := &http.Client{Timeout: 5 * time.Second}
	topologyID, err := firstTopologyID(client, *baseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	ctx, cancel := context.WithTimeout(context.Background(), *duration)
	defer cancel()
	var successes atomic.Uint64
	var failures atomic.Uint64
	var wait sync.WaitGroup

	for range *sseClients {
		wait.Go(func() { holdSSE(ctx, client, *baseURL, topologyID, &successes, &failures) })
	}
	for range *workers {
		wait.Go(func() {
			for ctx.Err() == nil {
				request, requestErr := http.NewRequestWithContext(ctx, http.MethodGet, *baseURL+"/api/v1/topologies/"+topologyID, nil)
				if requestErr != nil {
					failures.Add(1)
					continue
				}
				response, requestErr := client.Do(request)
				if requestErr != nil {
					if ctx.Err() == nil {
						failures.Add(1)
					}
					continue
				}
				_, _ = io.Copy(io.Discard, response.Body)
				_ = response.Body.Close()
				if response.StatusCode == http.StatusOK {
					successes.Add(1)
				} else {
					failures.Add(1)
				}
			}
		})
	}
	wait.Wait()
	fmt.Printf("requests=%d failures=%d sse=%d duration=%s\n", successes.Load(), failures.Load(), *sseClients, *duration)
	if failures.Load() > 0 {
		return 1
	}
	return 0
}

func firstTopologyID(client *http.Client, baseURL string) (topologyID string, returnErr error) {
	request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, baseURL+"/api/v1/topologies", nil)
	if err != nil {
		return "", fmt.Errorf("creating topology list request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("listing topologies: %w", err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing topology list response: %w", closeErr)
		}
	}()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("topology list returned status %d", response.StatusCode)
	}
	// Bound the decompressed body so a hostile or broken peer cannot make the
	// load generator buffer an arbitrarily large document.
	body := io.LimitReader(response.Body, maxTopologyListBytes+1)
	data, err := io.ReadAll(body)
	if err != nil {
		return "", fmt.Errorf("reading topology list: %w", err)
	}
	if len(data) > maxTopologyListBytes {
		return "", fmt.Errorf("topology list exceeds %d bytes", maxTopologyListBytes)
	}
	var summaries []topologySummary
	if err := json.Unmarshal(data, &summaries); err != nil {
		return "", fmt.Errorf("decoding topology list: %w", err)
	}
	if len(summaries) == 0 {
		return "", errors.New("topology list is empty")
	}
	if !topologyIDPattern.MatchString(summaries[0].ID) {
		return "", fmt.Errorf("topology list returned invalid id %q", summaries[0].ID)
	}
	return summaries[0].ID, nil
}

func holdSSE(ctx context.Context, client *http.Client, baseURL, topologyID string, successes, failures *atomic.Uint64) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/v1/topologies/"+topologyID+"/events", nil)
	if err != nil {
		failures.Add(1)
		return
	}
	response, err := client.Do(request)
	if err != nil {
		if ctx.Err() == nil {
			failures.Add(1)
		}
		return
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		failures.Add(1)
		return
	}
	successes.Add(1)
	_, _ = io.Copy(io.Discard, response.Body)
}
