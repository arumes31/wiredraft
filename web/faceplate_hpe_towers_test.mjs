import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveHPETowerFaceplate } from "./static/js/faceplate-hpe-tower-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

const cases = [
  { model: "ProLiant ML30", units: 5, count: 6, sku: "P65090-B21", drives: 0 },
  { model: "ProLiant ML110", units: 6, count: 3, sku: "P51518-B21", drives: 8 },
  { model: "ProLiant ML350", units: 5, count: 5, sku: "P48405-B21", drives: 8 },
];

/** Reconstruct the real former constructor's five ports and2U allocation independently of revised catalog values. */
function deviceFor(model, legacy = false) {
  const current = hardwareCatalog.find((item) => item.vendor === "HPE" && item.model === model);
  const catalog = legacy ? { ...current, units: 2, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_10G", speed: 10000, prefix: "NIC", poe: false },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "iLO", poe: false },
  ] } : current;
  const device = instantiateProfile(catalog, model, { x: 31, y: 47 });
  device.id = "saved-device"; device.rackId = "rack-a"; device.rackPosition = 9;
  device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; port.deviceId = device.id; });
  return device;
}

test("tower sources retain individual cage, rear fan and optional expansion populations", () => {
  const [small,medium,large]=cases.map(({model})=>resolveHPETowerFaceplate(deviceFor(model)));
  assert.ok(small.faces.front.components.some((p)=>p.role==="nhp-drive-cage-grille"));
  assert.ok(medium.faces.front.components.some((p)=>p.role==="front-system-fan"));
  assert.ok(!large.faces.front.components.some((p)=>p.kind==="fan"));
  assert.ok(!large.faces.rear.components.some((p)=>p.kind==="fan"));
  assert.equal(large.faces.rear.components.filter((p)=>/^pcie-slot-/.test(p.role)).length,4);
  assert.equal(medium.faces.rear.components.filter((p)=>/^pcie-slot-/.test(p.role)).length,2);
  assert.equal(small.faces.rear.ports.at(-1).connectorKind,"db9");
  assert.ok(large.faces.rear.components.some((p)=>p.role==="serial-blank"));
  assert.notDeepEqual(small.faces.rear,medium.faces.rear); assert.notDeepEqual(medium.faces.rear,large.faces.rear);
  assert.deepEqual(large.evidence.physicalDimensions,{chassisWidthMm:445,chassisHeightMm:174,trayHeightMm:44.45});
});

test("the selectedP38995 supply retains its photographed pink upper latch and visible three-blade inlet", () => {
  const component={kind:"psu",variant:"hpe-flexslot-p38995",x:0,y:0,width:100,height:60,active:false};
  const parts=hardwarePrimitives(component);
  const contacts=parts.filter((p)=>p.kind==="rect"&&p.fill==="#d0d6d8");
  assert.equal(contacts.length,3);
  const latch=parts.find((p)=>p.kind==="rect"&&p.fill==="#b36582");
  assert.ok(latch && latch.y < component.height*.3);
  assert.ok(parts.some((p)=>p.kind==="polygon"&&p.fill==="#172125"));
});

/** Reject positive-area intersections while permitting shared panel edges. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 &&
    a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}

test("ML30 retains the exact serial kit position as ancillary hardware in old inventories", () => {
  for (const width of [460,690]) for (const units of [2,5]) {
    const saved=deviceFor("ProLiant ML30",true),fresh=deviceFor("ProLiant ML30");
    saved.faceplate.unitsU=units;fresh.faceplate.unitsU=units;
    const before=structuredClone(saved),bounds={x:0,y:0,width,height:units*100};
    const legacy=buildFaceplateScene(saved,bounds,{face:"rear"}),current=buildFaceplateScene(fresh,bounds,{face:"rear"});
    const serial=current.ports.find((p)=>p.port.portIndex===6);assert.ok(serial);
    assert.deepEqual(legacy.components.filter((p)=>p.ancillarySocket),[{kind:"db9",x:serial.x,y:serial.y,width:serial.width,height:serial.height,
      role:"unclaimed-physical-socket",physicalSlotIndex:6,physicalFace:"rear",ancillarySocket:true}]);
    assert.deepEqual(legacy.components.filter((p)=>!p.applicationOverlay&&!p.ancillarySocket),current.components.filter((p)=>!p.applicationOverlay&&!p.ancillarySocket));
    const ilo=legacy.ports.find((p)=>p.port.portIndex===5),label=ilo.labelPlacement;
    assert.ok(label.y+label.boxHeight/2<ilo.y,"the relocated caption sits above the unchanged iLO socket");
    assert.deepEqual(saved,before);assert.equal(saved.ports.length,5);assert.equal(legacy.ports.length,5);
  }
});

for (const expected of cases) {
  test(`${expected.model} discloses its individual Gen11 rack conversion and network population`, () => {
    const device = deviceFor(expected.model); const profile = resolveHPETowerFaceplate(device);
    assert.equal(profile.fidelity, "model"); assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.evidence.sku, expected.sku); assert.equal(device.faceplate.unitsU, expected.units);
    assert.equal(device.ports.length, expected.count); assert.equal(profile.faces.rear.ports.length, expected.count);
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.equal(profile.faces.front.components.filter((p) => p.kind === "drive-carrier").length, expected.drives);
    assert.ok(profile.note.includes("Gen11") && profile.note.includes("tray") && profile.note.includes("SATA"));
    assert.equal(profile.faces.front.ports.length, 0);
  });

  test(`${expected.model} retains true old IDs, cables, names, settings and sparse inventory`, () => {
    for (const legacy of [false, true]) {
      const device = deviceFor(expected.model, legacy);
      if (legacy) delete device.faceplate.inventoryRevision;
      device.ports.forEach((port) => Object.assign(port, { speedMbps: 100, nativeVlan: 51, allowedVlans: [51,75], isPoe: true, group: "custom" }));
      device.ports[0].label = "MGMT1"; device.ports[1].label = "iLO1"; device.ports.reverse();
      const topology = { devices: [device], links: device.ports.map((port) => ({ id: `cable-${port.id}`, fromDeviceId: device.id, fromPortId: port.id,
        toDeviceId: "peer", toPortId: `peer-${port.id}`, color: "#ff0000", label: "keep", points: [{x:9,y:8}] })) };
      const before = structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology), false);
      const scene = buildFaceplateScene(device, { x:0,y:0,width:690,height:device.faceplate.unitsU*100 }, {face:"rear"});
      assert.equal(scene.unmappedPorts.length, legacy && expected.count === 3 ? 2 : 0);
      assert.deepEqual(topology, before);
      device.ports = device.ports.filter((port) => [2,4,5].includes(port.portIndex));
      const sparse = buildFaceplateScene(device, {x:0,y:0,width:460,height:device.faceplate.unitsU*100}, {face:"rear"});
      assert.ok(sparse.ports.every((box) => box.port.id === `saved-${box.port.portIndex}`));
      device.faceplate.inventoryRevision = 99;
      const unknown = buildFaceplateScene(device, {x:0,y:0,width:460,height:200}, {face:"rear"});
      assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, device.ports.length);
    }
  });

  test(`${expected.model} preserves fitted body proportions and clear captions at460/690`, () => {
    for (const width of [460,690]) for (const face of ["front","rear"]) {
      const fresh = deviceFor(expected.model);
      const original = buildFaceplateScene(fresh, {x:0,y:0,width,height:expected.units*100}, {face});
      for (const units of [2, expected.units, 8]) {
        const device = deviceFor(expected.model, units === 2); device.faceplate.unitsU = units;
        const scene = buildFaceplateScene(device, {x:0,y:0,width,height:units*100}, {face});
        assert.ok(Math.abs(scene.chassis.width/scene.chassis.height-original.chassis.width/original.chassis.height)<1e-8);
        for (const box of scene.ports) {
          for (const other of scene.ports) if (other!==box) assert.ok(!overlaps(box,other),`${box.displayLabel} overlaps socket ${other.displayLabel}`);
          const label = box.labelPlacement;
          const textWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, box.displayLabel.length * label.fontSize) + 6));
          const caption = {x:label.x-textWidth/2,y:label.y-label.boxHeight/2,width:textWidth,height:label.boxHeight};
          assert.ok(caption.y >= scene.chassis.y && caption.y+caption.height<=scene.chassis.y+scene.chassis.height);
          for (const part of [...scene.ports,...scene.components.filter((item)=>item.kind!=="text")]) {
            assert.ok(!overlaps(caption,part), `${box.displayLabel} caption overlaps ${part.role||part.kind||"socket"} in${units}U`);
            if (part!==box && !scene.ports.includes(part)) assert.ok(!overlaps(box,part),`${box.displayLabel} socket overlaps ${part.role||part.kind}`);
          }
        }
      }
    }
  });
}
