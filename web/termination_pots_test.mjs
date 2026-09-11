import assert from "node:assert/strict";
import test from "node:test";
import { connectorKind, connectorSize, faceplateConnectorSize } from "./static/js/termination.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

test("POTS telephone endpoints retain their own RJ11 kind while historical DSL remains unchanged", () => {
  assert.equal(connectorKind("POTS_RJ11"), "rj11");
  assert.deepEqual(connectorSize("POTS_RJ11"), { width: 14, height: 11 });
  assert.deepEqual(faceplateConnectorSize({ type: "POTS_RJ11", group: "MODEM" }, {
    ports: [{ type: "POTS_RJ11", group: "MODEM" }],
  }), { width: 14, height: 11 });
  assert.equal(connectorKind("DSL_RJ11"), "dsl");
  assert.deepEqual(connectorSize("DSL_RJ11"), { width: 14, height: 11 });
  const parts = (type) => hardwarePrimitives({ kind: connectorKind(type), x: 0, y: 0, ...connectorSize(type) });
  assert.equal(parts("POTS_RJ11").filter((part) => part.fill === "#d7b76c").length, 0);
  assert.equal(parts("DSL_RJ11").filter((part) => part.fill === "#d7b76c").length, 6);
});
