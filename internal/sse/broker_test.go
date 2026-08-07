package sse

import (
	"sync"
	"testing"
)

func TestBrokerPublishAndCancel(t *testing.T) {
	t.Parallel()
	broker := NewBroker()
	events, cancel := broker.Subscribe("topology")
	if err := broker.Publish("topology", "changed", map[string]string{"id": "one"}); err != nil {
		t.Fatal(err)
	}
	event := <-events
	if event.Type != "changed" {
		t.Fatalf("event type = %q, want changed", event.Type)
	}
	cancel()
	if _, open := <-events; open {
		t.Fatal("subscriber channel remains open after cancel")
	}
	broker.Close()
}

func TestBrokerBoundsSlowSubscribersAndIsolatesTopologies(t *testing.T) {
	t.Parallel()
	broker := NewBroker()
	slow, cancelSlow := broker.Subscribe("topology-a")
	isolated, cancelIsolated := broker.Subscribe("topology-b")
	defer cancelIsolated()

	for sequence := range subscriberBuffer * 4 {
		if err := broker.Publish("topology-a", "changed", map[string]int{"sequence": sequence}); err != nil {
			t.Fatal(err)
		}
	}
	if buffered := len(slow); buffered != subscriberBuffer {
		t.Fatalf("slow subscriber buffered events = %d, want bounded capacity %d", buffered, subscriberBuffer)
	}
	if buffered := len(isolated); buffered != 0 {
		t.Fatalf("unrelated topology received %d events", buffered)
	}

	cancelSlow()
	cancelSlow()
	drained := 0
	for range slow {
		drained++
	}
	if drained != subscriberBuffer {
		t.Fatalf("cancelled slow subscriber drained %d events, want %d", drained, subscriberBuffer)
	}
	broker.Close()
	broker.Close()
	closed, cancelClosed := broker.Subscribe("topology-a")
	defer cancelClosed()
	if _, open := <-closed; open {
		t.Fatal("subscription created after broker close must be closed")
	}
}

func TestBrokerConcurrentPublishSubscribeAndCancel(t *testing.T) {
	t.Parallel()
	broker := NewBroker()
	const workers = 24
	const iterations = 100
	var wait sync.WaitGroup
	wait.Add(workers)
	for worker := range workers {
		go func() {
			defer wait.Done()
			for sequence := range iterations {
				events, cancel := broker.Subscribe("shared")
				if err := broker.Publish("shared", "changed", map[string]int{
					"worker": worker, "sequence": sequence,
				}); err != nil {
					t.Errorf("publish: %v", err)
				}
				select {
				case <-events:
				default:
				}
				cancel()
			}
		}()
	}
	wait.Wait()
	broker.Close()
}
