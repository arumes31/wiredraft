import assert from "node:assert/strict";

const timers = [];
globalThis.window = {
  setTimeout(callback, delay) {
    timers.push({ callback, delay });
    return timers.length;
  },
};
globalThis.clearTimeout = () => {};

const sources = [];
globalThis.EventSource = class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.listeners = new Map();
    sources.push(this);
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  close() {
    this.closed = true;
  }
};

const { TopologyEvents } = await import("./static/js/sse.js");
const statuses = [];
const events = [];
const client = new TopologyEvents((topology, type) => events.push({ topology, type }), (status) => statuses.push(status));
client.connect("topology / chaos");

assert.equal(sources[0].url, "/api/v1/topologies/topology%20%2F%20chaos/events");
assert.equal(statuses.at(-1), "connecting");
sources[0].onopen();
assert.equal(statuses.at(-1), "online");
sources[0].listeners.get("topology_updated")({ data: '{"name":"restored"}' });
assert.deepEqual(events, [{ topology: { name: "restored" }, type: "topology_updated" }]);

for (let failure = 0; failure < 8; failure += 1) {
  const current = sources.at(-1);
  current.onerror();
  assert.equal(current.closed, true, "failed transport must be closed before retry");
  assert.equal(statuses.at(-1), "offline");
  const timer = timers.shift();
  assert.ok(timer, "reconnect must be scheduled");
  assert.ok(timer.delay >= 1000 && timer.delay <= 30000, "retry must remain bounded");
  timer.callback();
  assert.equal(statuses.at(-1), "connecting");
}
assert.equal(sources.length, 9, "every simulated disconnect must construct one replacement EventSource");
assert.equal(client.retry, 30000, "exponential retry must cap at thirty seconds");

client.close();
const sourceCount = sources.length;
sources.at(-1).onerror();
assert.equal(sources.length, sourceCount, "a deliberately closed client must not reconnect");

console.log("SSE disconnect chaos and bounded reconnection checks passed");
