import assert from "node:assert/strict";
import test from "node:test";

import { ToastQueue } from "./static/js/toast-queue.js";
import { renderTopologyTree } from "./static/js/topology-tree.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.parentElement = null;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (this.tagName !== "div") return;
    this.children = ["i", "span", "button"].map((tag) => {
      const child = new FakeElement(tag);
      child.parentElement = this;
      return child;
    });
  }

  get innerHTML() { return this._innerHTML || ""; }
  get isConnected() { return this.parentElement !== null; }
  get lastElementChild() { return this.children.at(-1) || null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) { return this.children.find((child) => child.tagName === selector) || null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
  prepend(child) { child.parentElement = this; this.children.unshift(child); }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
}

test("toast queue caps visible notices and supports manual and timed dismissal", () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const originalSetTimeout = globalThis.setTimeout;
  const animationFrames = [];
  const timers = [];
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
  globalThis.requestAnimationFrame = (callback) => animationFrames.push(callback);
  globalThis.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
  try {
    const container = new FakeElement("section");
    const queue = new ToastQueue(container, { duration: 50, maximum: 2 });
    assert.equal(queue.push("First"), 1);
    queue.push("Second", "error");
    queue.push("Third");
    assert.equal(container.children.length, 2);
    const newest = container.children[0];
    assert.equal(newest.querySelector("span").textContent, "Third");
    assert.equal(container.children[1].attributes.role, "alert");
    animationFrames.forEach((callback) => callback());
    assert.equal(newest.dataset.visible, "true");

    newest.querySelector("button").click();
    assert.equal(newest.dataset.visible, "false");
    timers.find(({ delay }) => delay === 220).callback();
    assert.equal(container.children.includes(newest), false);

    const remaining = container.children[0];
    timers.filter(({ delay }) => delay === 50).forEach(({ callback }) => callback());
    timers.filter(({ delay }) => delay === 220).forEach(({ callback }) => callback());
    queue.remove(remaining);
    assert.equal(container.children.length, 0);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("topology tree groups devices, escapes labels, and emits selections", () => {
  const buttons = [];
  const container = {
    _html: "",
    set innerHTML(value) {
      this._html = value;
      buttons.length = 0;
      for (const match of value.matchAll(/data-tree-type="([^"]+)" data-tree-id="([^"]+)"/g)) {
        const listeners = new Map();
        buttons.push({
          dataset: { treeType: match[1], treeId: match[2] },
          addEventListener: (type, listener) => listeners.set(type, listener),
          click: () => listeners.get("click")?.(),
        });
      }
    },
    get innerHTML() { return this._html; },
    querySelectorAll: () => buttons,
  };
  const selections = [];
  renderTopologyTree(container, {
    racks: [{ id: "rack-1", name: "Rack <Primary>" }],
    devices: [
      { id: "device-1", rackId: "rack-1", name: "Core & Edge", hostname: "core.example", model: "Model > One", ports: [{}, {}] },
      { id: "device-2", rackId: "missing", name: "Free", hostname: "", model: "Loose", ports: [] },
    ],
    vlans: [{ id: 20, name: "Users & Voice", colorHex: "#12ab34" }],
  }, { type: "device", id: "device-1" }, (type, id) => selections.push([type, id]));

  assert.match(container.innerHTML, /Rack &lt;Primary&gt;/);
  assert.match(container.innerHTML, /Core &amp; Edge/);
  assert.match(container.innerHTML, /Model &gt; One/);
  assert.match(container.innerHTML, /FREE CANVAS/);
  assert.match(container.innerHTML, /tree-device is-selected/);
  assert.match(container.innerHTML, /Users &amp; Voice/);
  buttons[0].click();
  buttons.at(-1).click();
  assert.deepEqual(selections, [["device", "device-1"], ["vlan", "20"]]);

  renderTopologyTree(container, null, null, () => {});
  assert.match(container.innerHTML, /VLAN NETWORKS/);
  assert.match(container.innerHTML, /<small>0<\/small>/);
});
