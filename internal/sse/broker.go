// Package sse provides bounded, cancellable server-sent event fan-out.
package sse

import (
	"encoding/json"
	"errors"
	"sync"
)

const (
	subscriberBuffer = 32
	// maxTopologySubscribers and maxSubscribers bound open streams so one
	// principal cannot hold an unlimited number of connections and fan-out
	// targets on the shared process.
	maxTopologySubscribers = 256
	maxSubscribers         = 4096
)

// ErrSubscriberLimit reports that a topology or the broker has no stream capacity left.
var ErrSubscriberLimit = errors.New("sse: subscriber limit reached")

// Event is an immutable SSE message.
type Event struct {
	Type string
	Data []byte
	// OrganizationID is the organization that owned the topology when the
	// event was produced; empty when the publisher did not scope it.
	OrganizationID string
}

// Broker owns subscribers grouped by topology ID.
type Broker struct {
	mu          sync.Mutex
	subscribers map[string]map[chan Event]struct{}
	total       int
	isClosed    bool
}

// NewBroker creates an empty broker.
func NewBroker() *Broker {
	return &Broker{subscribers: make(map[string]map[chan Event]struct{})}
}

// Subscribe returns a bounded stream and an idempotent cancellation function.
// When no capacity is left the returned stream is already closed.
func (b *Broker) Subscribe(topologyID string) (<-chan Event, func()) {
	channel, cancel, _ := b.TrySubscribe(topologyID)
	return channel, cancel
}

// TrySubscribe is Subscribe that reports ErrSubscriberLimit, with an already
// closed stream, when the topology or the broker is at capacity.
func (b *Broker) TrySubscribe(topologyID string) (<-chan Event, func(), error) {
	channel := make(chan Event, subscriberBuffer)
	b.mu.Lock()
	if b.isClosed {
		close(channel)
		b.mu.Unlock()
		return channel, func() {}, nil
	}
	if b.total >= maxSubscribers || len(b.subscribers[topologyID]) >= maxTopologySubscribers {
		close(channel)
		b.mu.Unlock()
		return channel, func() {}, ErrSubscriberLimit
	}
	if b.subscribers[topologyID] == nil {
		b.subscribers[topologyID] = make(map[chan Event]struct{})
	}
	b.subscribers[topologyID][channel] = struct{}{}
	b.total++
	b.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			b.mu.Lock()
			if subscribers := b.subscribers[topologyID]; subscribers != nil {
				if _, exists := subscribers[channel]; exists {
					delete(subscribers, channel)
					b.total--
					close(channel)
				}
				if len(subscribers) == 0 {
					delete(b.subscribers, topologyID)
				}
			}
			b.mu.Unlock()
		})
	}
	return channel, cancel, nil
}

// Publish sends an event without allowing a slow subscriber to block a mutation.
func (b *Broker) Publish(topologyID, eventType string, payload any) error {
	return b.PublishScoped(topologyID, "", eventType, payload)
}

// PublishScoped is Publish for an event tagged with its owning organization.
func (b *Broker) PublishScoped(topologyID, organizationID, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	event := Event{Type: eventType, Data: data, OrganizationID: organizationID}
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
	b.total = 0
}
