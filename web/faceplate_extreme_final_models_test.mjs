import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";
import { resolveExtremeFinalFaceplate } from "./static/js/faceplate-extreme-final-models.js";

const cases = [["X695","X695-48Y-8C",58,58,0,1,43.4,439.6,6,2],["X870","X870-32c",35,35,0,1,44.5,431.8,6,2]];

/** Reproduce the separately executed frozen438 constructor without importing private audit snapshots into committed tests. */
function fixture(model, legacy = false) {
  let profile = hardwareCatalog.find((entry) => entry.vendor === "Extreme" && entry.model === model);
  if (legacy) profile = { ...profile, units: 1, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_MGIG", speed: 2500, poe: true, prefix: "" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, poe: false, prefix: "STACK" },
  ] };
  const device = instantiateProfile(profile, model, { x: 17, y: 34 }); device.id = model;
  device.ports.forEach((port) => { port.id = `${model}-${port.portIndex}`; port.deviceId = model; });
  return device;
}

/** Build the actual physical face within the retained rack reservation. */
function scene(device, width = 460, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect overlapping areas while permitting touching outlines. */
function overlaps(a, b) { return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8; }

/** Compute conservative primitive bounds including stroke thickness. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}



for (const [model,sku,total,frontCount,rearCount,mapped,heightMM,bodyWidth,fans,supplies] of cases) {
  test(`${model} exact source configuration and current inventory`,()=>{
    const device=fixture(model),front=scene(device),rear=scene(device,460,"rear");
    assert.equal(device.ports.length,total);assert.equal(front.profile.sku,sku);assert.equal(front.profile.fidelity,"model");
    assert.deepEqual(front.profile.evidence.models,[sku]);assert.equal(front.profile.evidence.selectedModel,sku);
    assert.equal(front.profile.rearHardwareVerified,true);assert.equal(front.ports.length,frontCount);assert.equal(rear.ports.length,rearCount);
    assert.equal(rear.components.filter(p=>p.kind==="fan").length,fans);assert.equal(rear.components.filter(p=>p.kind==="psu").length,supplies);
    assert.ok(rear.components.filter(p=>p.kind==="fan").every(p=>p.model===(model==="X695"?"XN-FAN-001-F":"17115")));
    assert.ok(rear.components.filter(p=>p.kind==="psu").every(p=>p.model===(model==="X695"?"XN-ACPWR-750W-F":"10960")&&p.inlet==="IEC C14"));
    assert.equal(device.ports.filter(p=>p.type==="Stack").length,0);
    assert.equal(device.ports.filter(p=>p.type==="SFP28_25G").length,model==="X695"?48:0);
    assert.equal(device.ports.filter(p=>p.type==="QSFP28_100G").length,model==="X695"?8:32);
    assert.deepEqual(front.profile.legacyLayouts[0].portIndexMap,{59:model==="X695"?57:33});
  });
  test(`${model} true438 compatibility leaves all stored data unchanged`,()=>{
    const device=fixture(model,true); assert.equal(device.ports.length,59);
    assert.deepEqual(device.ports.slice(56).map(p=>[p.portIndex,p.type,p.label]),[[57,"Stack","STACK1"],[58,"Stack","STACK2"],[59,"RJ45_1G","MGMT"]]);
    device.ports.reverse(); device.rackId="saved"; device.rackPosition=27;
    device.ports.forEach(p=>{p.label=`Custom saved ${p.portIndex}`;p.speedMbps=2500;p.isPoe=true;p.nativeVlan=29;p.allowedVlans=[29,70];});
    const topology={devices:[device],links:[{sourceDeviceId:device.id,sourcePortId:`${model}-57`,targetDeviceId:"peer",targetPortId:"retained"}]},before=structuredClone(topology);
    const faces=[scene(device),scene(device,690,"rear")];
    assert.equal(faces.flatMap(f=>f.ports).length,mapped);assert.equal(faces[0].unmappedPorts.length,59-mapped);
    assert.equal(faces.flatMap(f=>f.components.filter(p=>p.ancillarySocket)).length,total-mapped);
    assert.deepEqual(faces.flatMap(f=>f.ports).map(p=>p.port.portIndex).sort((a,b)=>a-b),[59]);
    assert.equal(upgradeInstalledPhysicalPorts(device),false);assert.deepEqual(topology,before);
    const sparse=structuredClone(device);sparse.ports=sparse.ports.filter(p=>[1,49,57,59].includes(p.portIndex));const sm=1;
    assert.equal(scene(sparse).ports.length+scene(sparse,690,"rear").ports.length,sm);
    sparse.ports.push({...sparse.ports.find(p=>p.portIndex===59),id:"duplicate"});assert.equal(scene(sparse).unmappedPorts.length,5-sm);
    for(const mode of ["type","unknown"]) {
      const rejected=structuredClone(device);if(mode==="type") rejected.ports.forEach(p=>{p.type="QSFP_PLUS_40G";});else rejected.faceplate.inventoryRevision=98;
      assert.equal(scene(rejected).ports.length+scene(rejected,690,"rear").ports.length,0);assert.equal(scene(rejected).unmappedPorts.length,59);
    }
  });
  test(`${model} fits manufacturer native aspect at460 and retains the same body in edited2U allocations`, () => {
    const current = fixture(model), old = fixture(model, true), larger = structuredClone(old); larger.faceplate.unitsU = 2;
    assert.ok(Math.abs(scene(current).chassis.height / scene(current).chassis.width - heightMM / bodyWidth) < 1e-9);
    for (const width of [460, 690]) {
      assert.deepEqual(scene(current, width).chassis, scene(old, width).chassis);
      assert.deepEqual(scene(current, width).chassis, scene(larger, width).chassis);
      assert.equal(larger.faceplate.unitsU, 2); assert.equal(larger.ports.length, 59);
    }
  });

  test(`${model} finite native and saved captions clear all source hardware at460/690`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const custom of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(model, legacy); if (custom) device.ports.forEach((port) => { port.label = `Long saved service label ${port.portIndex}`; });
      const result = scene(device, width, face);
      for (const port of result.ports) {
        const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
        assert.ok([label.x, label.y, label.maxWidth, label.boxMaxWidth].every(Number.isFinite));
        if (!custom && /^\d{2}$/.test(port.displayLabel)) assert.ok(label.maxWidth >= 6.6, `${model} caption${port.displayLabel} native text budget`);
        for (const component of result.components) {
          assert.ok(!overlaps(port, component), `${model} ${width} ${face} socket${port.port.portIndex}/${component.role || component.kind}`);
          assert.ok(!overlaps(caption, component), `${model} ${width} ${face} caption${port.port.portIndex}/${component.role || component.kind}`);
        }
        for (const other of result.ports) assert.ok(!overlaps(caption, other), `${model} caption${port.port.portIndex}/socket${other.port.portIndex}`);
      }
      for (const socket of result.components.filter((part) => part.ancillarySocket || part.comboAlternative)) for (const component of result.components.filter((part) => !part.ancillarySocket && !part.comboAlternative)) assert.ok(!overlaps(socket, component), `${model} physical alternative/${component.role || component.kind}`);
    }
  });

  test(`${model} component and connector primitives stay inside physical bounds at460/6901x/2x`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const face of ["front", "rear"]) for (const scale of [1, 2]) {
      const result = scene(fixture(model, legacy), width, face);
      for (const part of [...result.components, ...result.ports.map((port) => ({ ...port, kind: port.connectorKind }))]) {
        const component = { ...part, x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale };
        const primitives = hardwarePrimitives(component); assert.ok(primitives.length > 0); assert.ok(primitives.every(p => p.fill !== "none"));
        for (const primitive of primitives) {
          const box = bounds(primitive); assert.ok(box.every(Number.isFinite));
          assert.ok(box[0] >= component.x - 1e-5 && box[1] >= component.y - 1e-5 && box[2] <= component.x + component.width + 1e-5 && box[3] <= component.y + component.height + 1e-5,
            `${model} ${width} ${legacy} ${scale} ${part.role || part.kind} ${JSON.stringify(primitive)}`);
        }
      }
    }
  });
}
test("Extreme final hardware uses identical primitives for Canvas and SVG and preserves sparse current inventories", () => {
  for (const [model, , total] of cases) {
    for (const face of ["front", "rear"]) for (const component of scene(fixture(model), 460, face).components) {
      const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component), calls = [];
      const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, component);
      assert.deepEqual(calls.filter(([name]) => name === "arc").map(([, x, y, radius]) => [x, y, radius]), primitives.filter((part) => part.kind === "circle").map((part) => [part.cx, part.cy, part.r]));
      assert.equal((svg.match(/<polygon\b/g) || []).length, primitives.filter((part) => part.kind === "polygon").length);
    }
    const sparse = fixture(model); sparse.ports = sparse.ports.filter((port) => [1, 2, total].includes(port.portIndex)).reverse();
    const before = structuredClone(sparse), faces = [scene(sparse), scene(sparse, 690, "rear")];
    assert.equal(faces.flatMap((face) => face.ports).length, 3); assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total - 3); assert.deepEqual(sparse, before);
    for (const revision of [1, 98]) {
      const empty = fixture(model); empty.ports = []; empty.faceplate.inventoryRevision = revision;
      const emptyFaces = [scene(empty), scene(empty, 690, "rear")];
      assert.equal(emptyFaces.flatMap((face) => face.ports).length, 0); assert.equal(emptyFaces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total);
    }
  }
});



test("physical labels, key directions, unsupported timing and palette follow exact sources",()=>{
 const a=scene(fixture("X695")),b=scene(fixture("X870"));
 assert.deepEqual(a.profile.faces.front.ports.filter(p=>p.portIndex>=49&&p.portIndex<=56).map(p=>p.physicalLabel),["49","50","51","55","56","60","61","62"]);
 assert.deepEqual(b.profile.faces.front.ports.filter(p=>p.portIndex<=32).map(p=>p.physicalLabel),Array.from({length:32},(_,i)=>String(1+i*4)));
 for(const [profile,limit,upper,lower] of [[a.profile,48,"sfp","extreme-next-sfp-inverted"],[b.profile,32,"qsfp","extreme-next-qsfp-inverted"]]) {
   for(const port of profile.faces.front.ports.filter(p=>p.portIndex<=limit)) assert.equal(port.connectorKind,port.portIndex%2?upper:lower);
 }
 const consoles=b.profile.faces.front.ports.filter(p=>[33,34].includes(p.portIndex));assert.ok(consoles.find(p=>p.portIndex===34).x<consoles.find(p=>p.portIndex===33).x);
 const timing=b.components.filter(p=>p.supported===false);assert.equal(timing.length,2);assert.deepEqual(timing.map(p=>p.signal),["1PPS","10MHz"]);
 assert.ok(timing.every(p=>!p.port&&!p.portIndex));assert.equal(b.components.filter(p=>p.kind==="extreme-final-micro-a").length,1);
 assert.equal(resolveFaceplateTemplate(fixture("X695")).surface,"#30216d");assert.equal(resolveFaceplateTemplate(fixture("X870")).surface,"#756497");
});
test("X870 reuses the exact source-verified17115 and10960 primitive contracts unchanged",()=>{
 const existing=fixture("X690"),selected=fixture("X870");
 for(const kind of ["fan","psu"]) {
   const old=scene(existing,460,"rear").components.find(p=>p.kind===kind),next=scene(selected,460,"rear").components.find(p=>p.kind===kind);
   const box={x:0,y:0,width:70,height:43};
   assert.equal(next.variant,old.variant);assert.equal(next.model,old.model);
   assert.deepEqual(hardwarePrimitives({...next,...box}),hardwarePrimitives({...old,...box}));
 }
});

test("unsupported timing guard outlines are truly unfilled in both renderers",()=>{
 const timing=scene(fixture("X870")).components.find(p=>p.role==="unsupported-1pps"),primitives=hardwarePrimitives(timing);
 assert.equal(primitives.filter(p=>p.kind==="circle"&&p.fill===undefined).length,1);
 assert.equal((hardwareComponentSVG(timing).match(/<circle[^>]*fill="none"/g)||[]).length,1);
 const calls=[],context=new Proxy({},{get:(_object,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
 drawHardwareComponent(context,timing);assert.equal(calls.filter(([name])=>name==="fill").length,3);
});

test("final Extreme resolver rejects neighboring names and another vendor",()=>{
 const device=fixture("X695");device.model="X695-other";assert.equal(resolveExtremeFinalFaceplate(device),null);
 device.model="X695";device.faceplate.vendor="Cisco";assert.equal(resolveExtremeFinalFaceplate(device),null);
});
