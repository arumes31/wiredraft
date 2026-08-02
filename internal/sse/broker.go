// Package sse provides bounded, cancellable server-sent event fan-out.
package sse

import (
	"encoding/json"
	"sync"
)

const subscriberBuffer = 32

// Event is an immutable SSE message.
type Event struct {
	Type string
	Data []byte
}

// Broker owns subscribers grouped by topology ID.
type Broker struct {
	mu          sync.Mutex
	subscribers map[string]map[chan Event]struct{}
	isClosed    bool
}

// NewBroker creates an empty broker.
func NewBroker() *Broker {
	return &Broker{subscribers: make(map[string]map[chan Event]struct{})}
}

// Subscribe returns a bounded stream and an idempotent cancellation function.
func (b *Broker) Subscribe(topologyID string) (<-chan Event, func()) {
	channel := make(chan Event, subscriberBuffer)
	b.mu.Lock()
	if b.isClosed {
		close(channel)
		b.mu.Unlock()
		return channel, func() {}
	}
	if b.subscribers[topologyID] == nil {
		b.subscribers[topologyID] = make(map[chan Event]struct{})
	}
	b.subscribers[topologyID][channel] = struct{}{}
	b.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			b.mu.Lock()
			if subscribers := b.subscribers[topologyID]; subscribers != nil {
				if _, exists := subscribers[channel]; exists {
					delete(subscribers, channel)
					close(channel)
				}
				if len(subscribers) == 0 {
					delete(b.subscribers, topologyID)
				}
			}
			b.mu.Unlock()
		})
	}
	return channel, cancel
}

// Publish sends an event without allowing a slow subscriber to block a mutation.
func (b *Broker) Publish(topologyID, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	event := Event{Type: eventType, Data: data}
	b.mu.Lock()
	defer b.mu.Unlock()
	for channel := range b.subscribers[topologyID] {
		select {
		case channel <- event:
		default:
		}
	}
	return nil
}

// Close disconnects every subscriber and prevents new subscriptions.
func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.isClosed {
		return
	}
	b.isClosed = true
	for _, subscribers := range b.subscribers {
		for channel := range subscribers {
			close(channel)
		}
	}
	b.subscribers = make(map[string]map[chan Event]struct{})
}
