// Command loadtest exercises API reads and long-lived SSE connections.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

type topologySummary struct {
	ID string `json:"id"`
}

func main() {
	baseURL := flag.String("url", "http://127.0.0.1:8080", "netdiagram base URL")
	duration := flag.Duration("duration", 10*time.Second, "load duration")
	workers := flag.Int("workers", 16, "concurrent API workers")
	sseClients := flag.Int("sse", 64, "concurrent SSE connections")
	flag.Parse()
	if *workers < 1 || *sseClients < 0 || *duration <= 0 {
		fmt.Fprintln(os.Stderr, "workers and duration must be positive; SSE clients may be zero")
		os.Exit(2)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	topologyID, err := firstTopologyID(client, *baseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
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
		os.Exit(1)
	}
}

func firstTopologyID(client *http.Client, baseURL string) (string, error) {
	response, err := client.Get(baseURL + "/api/v1/topologies")
	if err != nil {
		return "", fmt.Errorf("listing topologies: %w", err)
	}
	defer response.Body.Close()
	var summaries []topologySummary
	if err := json.NewDecoder(response.Body).Decode(&summaries); err != nil {
		return "", fmt.Errorf("decoding topology list: %w", err)
	}
	if response.StatusCode != http.StatusOK || len(summaries) == 0 {
		return "", fmt.Errorf("topology list returned status %d and %d entries", response.StatusCode, len(summaries))
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
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		failures.Add(1)
		return
	}
	successes.Add(1)
	_, _ = io.Copy(io.Discard, response.Body)
}
