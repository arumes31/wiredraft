package sse

import "testing"

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
