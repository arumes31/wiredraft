package sse

import (
	"errors"
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

func TestBrokerEnforcesSubscriberLimits(t *testing.T) {
	t.Parallel()
	broker := NewBroker()
	defer broker.Close()
	cancels := make([]func(), 0, maxTopologySubscribers)
	for range maxTopologySubscribers {
		_, cancel, err := broker.TrySubscribe("topology")
		if err != nil {
			t.Fatalf("subscription within limit failed: %v", err)
		}
		cancels = append(cancels, cancel)
	}
	rejected, _, err := broker.TrySubscribe("topology")
	if !errors.Is(err, ErrSubscriberLimit) {
		t.Fatalf("subscription over topology limit error = %v, want ErrSubscriberLimit", err)
	}
	if _, open := <-rejected; open {
		t.Fatal("rejected subscription channel is open")
	}
	if _, cancel, err := broker.TrySubscribe("other-topology"); err != nil {
		t.Fatalf("other topology subscription failed: %v", err)
	} else {
		cancel()
	}
	cancels[0]()
	_, cancel, err := broker.TrySubscribe("topology")
	if err != nil {
		t.Fatalf("subscription after cancel failed: %v", err)
	}
	cancel()
	for _, cancel := range cancels[1:] {
		cancel()
	}
	if broker.total != 0 {
		t.Fatalf("subscriber count after cancellation = %d, want 0", broker.total)
	}
}
