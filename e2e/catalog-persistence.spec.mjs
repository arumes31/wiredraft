import { expect, test } from "@playwright/test";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { defaultCableProperties } from "../web/static/js/cable-defaults.js";

/** Select actual catalog devices whose combined inventories cover every connector type. */
function connectorCoverageDevices() {
  const candidates = hardwareCatalog.map((profile) => instantiateProfile(profile, profile.model, { x: 0, y: 0 }));
  const uncovered = new Set(candidates.flatMap((device) => device.ports.map((port) => port.type)));
  const devices = [];
  while (uncovered.size) {
    const ranked = candidates.map((device) => ({ device,
      added: new Set(device.ports.map((port) => port.type).filter((type) => uncovered.has(type))).size,
    })).sort((left, right) => right.added - left.added);
    const selected = ranked[0].device;
    devices.push(selected);
    for (const port of selected.ports) uncovered.delete(port.type);
  }
  return devices;
}

test("catalog connector types preserve their inventory through device creation and reload", async ({ request }, testInfo) => {
  const session = await request.post("/api/v1/auth/guest", { data: {} });
  expect(session.ok()).toBe(true);
  const created = await request.post("/api/v1/topologies", {
    data: { name: `E2E ${testInfo.project.name} CATALOG CONNECTORS`, template: "blank" },
  });
  expect(created.status()).toBe(201);
  let topology = await created.json();
  const path = `/api/v1/topologies/${topology.id}`;
  const devices = connectorCoverageDevices();
  try {
    for (const device of devices) {
      const response = await request.post(`${path}/devices`, {
        headers: { "If-Match": `"rev-${topology.revision}"` }, data: device,
      });
      const body = await response.text();
      expect(response.status(), `${device.faceplate.vendor} ${device.model}: ${body}`).toBe(201);
      topology = JSON.parse(body);
      const saved = topology.devices.find((entry) => entry.model === device.model && entry.faceplate.vendor === device.faceplate.vendor);
      expect(saved, device.model).toBeTruthy();
      expect(saved.faceplate.inventoryRevision ?? 0, device.model).toBe(device.faceplate.inventoryRevision);
      expect(saved.ports.map(({ portIndex, type, speedMbps, label }) => ({ portIndex, type, speedMbps, label })), device.model)
        .toEqual(device.ports.map(({ portIndex, type, speedMbps, label }) => ({ portIndex, type, speedMbps, label })));
      expect(new Set(saved.ports.map((port) => port.id)).size, device.model).toBe(device.ports.length);
      expect(saved.ports.every((port) => port.id && port.deviceId === saved.id), device.model).toBe(true);
      for (const port of saved.ports.filter((entry) => entry.type === "POTS_RJ11")) {
        expect({ mode: port.mode, speed: port.speedMbps, isPoe: port.isPoe, nativeVlan: port.nativeVlan, allowedVlans: port.allowedVlans })
          .toEqual({ mode: "Unconfigured", speed: 0, isPoe: false, nativeVlan: 0, allowedVlans: [] });
      }
    }
    // Exercise telephone defaults through real create/save/reload endpoints, using
    // the same helper as the app's cable action and two actual catalog modems.
    const modemDevice = topology.devices.find((device) => device.ports.some((port) => port.type === "POTS_RJ11"));
    expect(modemDevice, "the catalog coverage set must include the Raritan telephone modem").toBeTruthy();
    const modemPort = modemDevice.ports.find((port) => port.type === "POTS_RJ11");
    const originalModemPort = structuredClone(modemPort);
    const peerInput = structuredClone(devices.find((device) => device.ports.some((port) => port.type === "POTS_RJ11")));
    peerInput.name = "CATALOG POTS PEER";
    const peerResponse = await request.post(`${path}/devices`, {
      headers: { "If-Match": `"rev-${topology.revision}"` }, data: peerInput,
    });
    expect(peerResponse.status()).toBe(201);
    topology = await peerResponse.json();
    const peer = topology.devices.find((device) => device.name === peerInput.name);
    const peerPort = peer.ports.find((port) => port.type === "POTS_RJ11");
    const cable = { id: "", sourceDeviceId: modemDevice.id, sourcePortId: modemPort.id,
      targetDeviceId: peer.id, targetPortId: peerPort.id, ...defaultCableProperties(modemPort, peerPort), notes: "" };
    const cableResponse = await request.post(`${path}/links`, {
      headers: { "If-Match": `"rev-${topology.revision}"` }, data: cable,
    });
    expect(cableResponse.status(), await cableResponse.text()).toBe(201);
    topology = await cableResponse.json();
    const savedCable = topology.links.find((link) => link.sourcePortId === modemPort.id && link.targetPortId === peerPort.id);
    expect(savedCable).toMatchObject({ cableType: "TELEPHONE", primaryVlan: 0, vlanIds: [] });
    expect(topology.devices.find((device) => device.id === modemDevice.id).ports.find((port) => port.id === modemPort.id))
      .toEqual({ ...originalModemPort, status: "up" });
    const reloaded = await request.get(path);
    expect(reloaded.ok()).toBe(true);
    const persisted = await reloaded.json();
    expect(persisted.devices).toEqual(topology.devices);
    expect(persisted.links).toEqual(topology.links);
    const types = [...new Set(devices.flatMap((device) => device.ports.map((port) => port.type)))].sort();
    await testInfo.attach("catalog-connector-persistence.json", {
      body: JSON.stringify({ models: devices.map((device) => `${device.faceplate.vendor} ${device.model}`), types }, null, 2),
      contentType: "application/json",
    });
  } finally {
    const current = await request.get(path);
    expect(current.ok()).toBe(true);
    const latest = await current.json();
    const removed = await request.delete(path, { headers: { "If-Match": `"rev-${latest.revision}"` } });
    expect(removed.ok()).toBe(true);
  }
});
