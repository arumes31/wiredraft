import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveArubaRemainingFaceplate } from "./static/js/faceplate-aruba-remaining.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG } from "./static/js/hardware-components.js";

/** Recreate the old inventory with the real zone-ordered catalog constructor, including its original 4U allocation. */
function deviceFor(legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "HPE Aruba" && row.model === "CX 10000 family");
  if (legacy) entry = { ...entry, units: 4, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP_DD_400G", speed: 400000, prefix: "QSFP-DD" },
    { zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(entry, "CX 10000 family", { x: 12, y: 45 });
  device.id = "retained-device";
  for (const port of device.ports) { port.id = `retained-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Resolve the actual faceplate pipeline at native 1U height and the two supported rack widths. */
function sceneFor(device, face = "front", width = 690) {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

test("CX10000 selects the full R8P13A configuration and splits service sockets between faces", () => {
  const device = deviceFor(); const profile = resolveArubaRemainingFaceplate(device);
  assert.equal(profile.sku, "R8P13A"); assert.equal(profile.fidelity, "model");
  assert.equal(profile.rearHardwareVerified, true); assert.equal(profile.inventoryComplete, true);
  assert.equal(device.faceplate.unitsU, 1); assert.equal(device.ports.length, 57);
  assert.equal(hardwareCatalog.find((row) => row.model === device.model).preserveInstalledPorts, true);
  assert.deepEqual(device.ports.slice(54).map((port) => port.type), ["RJ45_1G", "USB_C_CONSOLE", "Console"]);
  const front = sceneFor(device); const rear = sceneFor(device, "rear");
  assert.equal(front.ports.length, 56); assert.equal(rear.ports.length, 1);
  assert.equal(front.unmappedPorts.length, 0); assert.equal(rear.unmappedPorts.length, 0);
  assert.equal(rear.ports[0].port.portIndex, 56);
  assert.equal(profile.faces.rear.components.filter((part) => part.variant === "aruba-10000-fan").length, 6);
  assert.equal(profile.faces.rear.components.filter((part) => part.variant === "aruba-10000-ac").length, 2);
  assert.match(profile.evidence.configuration, /R8R51A 800W/); assert.match(profile.evidence.configuration, /R8R53A/);
  for (const bank of [front.ports.slice(0,48), front.ports.slice(48,54)]) for (let i = 0; i < bank.length; i += 2) {
    assert.equal(bank[i].centerX, bank[i+1].centerX); assert.ok(bank[i].centerY < bank[i+1].centerY);
  }
  assert.ok(front.ports[16].centerX - front.ports[14].centerX > front.ports[14].centerX - front.ports[12].centerX);
});

test("historical CX10000 saved IDs, cables, settings and 4U allocation are unchanged by resolution or upgrades", () => {
  const old = deviceFor(true); delete old.faceplate.inventoryRevision; old.ports.reverse();
  for (const port of old.ports) {
    port.label = "1"; port.speedMbps = 100; port.nativeVlan = 33; port.allowedVlans = [33,77]; port.isPoe = true; port.group = "Saved group";
  }
  const topology = { devices:[old], links:[{id:"wire",sourcePortId:"retained-59",targetPortId:"external"}],
    racks:[{id:"rack",units:42,devices:[{deviceId:old.id,startUnit:9,units:4}]}] };
  const before = structuredClone(topology);
  assert.equal(upgradeInstalledPhysicalPorts(topology), false); assert.deepEqual(topology,before);
  const front = sceneFor(old); const rear = sceneFor(old,"rear"); const fresh = sceneFor(deviceFor());
  assert.equal(front.chassis.height,fresh.chassis.height); assert.equal(front.chassis.y,fresh.chassis.y);
  assert.deepEqual(front.unmappedPorts.map((port) => port.portIndex).sort((a,b)=>a-b),[55,56,58]);
  assert.equal(front.ports.find((slot)=>slot.port.portIndex===57).centerX,fresh.ports.find((slot)=>slot.port.portIndex===55).centerX);
  assert.equal(rear.ports[0].port.id,"retained-59"); assert.equal(rear.ports[0].displayLabel,"1");
  assert.equal(old.faceplate.unitsU,4); assert.deepEqual(topology,before);
  old.ports=old.ports.filter((port)=>[1,49,55,57,59].includes(port.portIndex));
  assert.equal(sceneFor(old).ports.length,3); assert.equal(sceneFor(old,"rear").ports.length,1);
  old.faceplate.inventoryRevision=99;
  assert.equal(sceneFor(old).ports.length,0); assert.equal(sceneFor(old).unmappedPorts.length,5);
});

test("CX10000 captions remain clear of sockets, hardware and one another at460 and690", () => {
  for (const width of [460,690]) for (const face of ["front","rear"]) {
    const scene=sceneFor(deviceFor(),face,width); const captions=[];
    for (const port of scene.ports) {
      const label=port.labelPlacement; const width=Math.min(label.boxMaxWidth,port.displayLabel.length*label.fontSize*.7+6);
      const box={x:label.x-width/2,y:label.y-label.boxHeight/2,width,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x && box.x+box.width<=scene.chassis.x+scene.chassis.width);
      assert.ok(box.y>=scene.chassis.y && box.y+box.height<=scene.chassis.y+scene.chassis.height);
      for (const other of [...captions,...scene.ports,...scene.components.filter((part)=>!part.applicationOverlay)]) {
        assert.ok(!(box.x<other.x+other.width && box.x+box.width>other.x && box.y<other.y+other.height && box.y+box.height>other.y), `${face} ${port.displayLabel} caption overlaps hardware at${scene.chassis.width}`);
      }
      captions.push(box);
    }
  }
});

test("CX10000 rear guards use dedicated honeycomb and bail primitives shared by Canvas and SVG", () => {
  for (const variant of ["aruba-10000-fan","aruba-10000-ac"]) {
    const part={kind:variant.endsWith("fan")?"fan":"psu",variant,x:10,y:20,width:65,height:62};
    const art=hardwarePrimitives(part); const svg=hardwareComponentSVG(part);
    assert.ok(art.filter((item)=>item.kind==="polygon"&&item.points.length===6).length>15);
    assert.ok(art.some((item)=>item.kind==="polygon"&&item.points.length>10),"source-specific bail silhouette");
    assert.match(svg,/<polygon/); assert.ok(!svg.includes("NaN"));
    for (const primitive of art.filter((item)=>item.kind==="polygon")) for (const [x,y] of primitive.points) {
      assert.ok(x>=part.x && x<=part.x+part.width && y>=part.y && y<=part.y+part.height);
    }
  }
});
