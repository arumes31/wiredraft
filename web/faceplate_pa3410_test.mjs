import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveModelFaceplate} from "./static/js/faceplate-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const row = () => hardwareCatalog.find(p => p.vendor === "Palo Alto" && p.model === "PA-3400 family");
/** Reconstruct the original catalog independently of the corrected inventory. */
function deviceFor(legacy = false) {
  const profile = legacy ? {...row(), units: 2, inventoryRevision: 0, groups: [
    {zone:"access",count:16,type:"RJ45_1G",speed:1000,prefix:"",poe:false},
    {zone:"uplink",count:8,type:"SFP28_25G",speed:25000,prefix:"SFP28",poe:false},
    {zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT",poe:false},
    {zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE",poe:false},
  ]} : row();
  return instantiateProfile(profile, "PA-3410 selected", {x:0,y:0});
}
/** Compare rectangles while permitting shared edges. */
function overlap(a,b) {return a.x < b.x+b.width-1e-8 && a.x+a.width > b.x+1e-8 && a.y < b.y+b.height-1e-8 && a.y+a.height > b.y+1e-8;}

test("PA-3400 alias selects PA-3410's specific 32-socket front and redundant AC rear", () => {
  const d=deviceFor(),p=resolveModelFaceplate(d);
  assert.equal(p.fidelity,"model");assert.equal(p.evidence.selectedModel,"PA-3410");
  assert.equal(d.faceplate.unitsU,1);assert.equal(d.ports.length,32);
  assert.equal(d.ports.filter(p=>p.type==="RJ45_MGIG"&&p.speedMbps===10000).length,12);
  assert.equal(d.ports.filter(p=>p.type==="SFP_PLUS_10G").length,11);
  assert.equal(d.ports.filter(p=>p.type==="SFP28_25G").length,4);
  assert.equal(d.ports.filter(p=>p.type.startsWith("QSFP")).length,0);
  assert.equal(p.faces.front.ports.length,32);assert.equal(p.faces.rear.ports.length,0);
  assert.equal(p.faces.rear.components.filter(c=>c.role==="ac-supply").length,2);
  assert.equal(p.faces.rear.components.filter(c=>c.kind==="fan").length,0);
  assert.equal(p.faces.front.components.filter(c=>c.role==="status-indicator").length,8);
});

test("PA-3410 preserves the actual original 27-endpoint topology without guessing unsupported sockets", () => {
  for(const sparse of [false,true]) {
    const d=deviceFor(true);d.id="saved";d.rackId="rack";d.rackPosition=7;
    for(const p of d.ports){p.id=`saved-${p.portIndex}`;p.deviceId=d.id;p.label="Edited interface";p.nativeVlan=17;p.speedMbps=100;}
    d.ports.reverse();if(sparse)d.ports.splice(5,2);
    const topology={devices:[d],racks:[{id:"rack",units:42}],links:[{id:"link",sourceDeviceId:d.id,sourcePortId:d.ports[0].id,targetDeviceId:"peer",targetPortId:"peer-1",vlanIds:[17]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"front"});
    const supported = new Set([1,2,3,4,5,6,7,8,9,10,11,12,17,18,19,20,25,27]);
    assert.deepEqual(scene.ports.map(p=>p.port.portIndex),d.ports.filter(p=>supported.has(p.portIndex)).map(p=>p.portIndex));
    assert.equal(scene.unmappedPorts.length,d.ports.filter(p=>!supported.has(p.portIndex)).length);
    assert.equal(scene.components.filter(c=>c.ancillarySocket).length,32-scene.ports.length);
    assert.deepEqual(topology,before);
    d.faceplate.inventoryRevision=999;
    assert.equal(buildFaceplateScene(d,{x:0,y:0,width:690,height:200}).ports.length,0);
  }
});

test("PA-3410 keeps its native 1U body and clear captions inside saved allocations", () => {
  for(const width of [460,690])for(const legacy of [false,true])for(const units of [1,2,4]) {
    const d=deviceFor(legacy);d.faceplate.unitsU=units;
    const native=deviceFor();const nativeScene=buildFaceplateScene(native,{x:10,y:20,width,height:100},{face:"front"});
    for(const face of ["front","rear"]) {
      const s=buildFaceplateScene(d,{x:10,y:20,width,height:units*100},{face});
      assert.ok(Math.abs(s.chassis.height-nativeScene.chassis.height)<1e-8);
      assert.ok(Math.abs(s.chassis.width-nativeScene.chassis.width)<1e-8);
      for(const box of [...s.ports,...s.components.filter(c=>!c.applicationOverlay)]) {
        assert.ok(box.x>=s.chassis.x-1e-8 && box.y>=s.chassis.y-1e-8);
        assert.ok(box.x+box.width<=s.chassis.x+s.chassis.width+1e-8 && box.y+box.height<=s.chassis.y+s.chassis.height+1e-8);
      }
      for(const p of s.ports) {
        const l=p.labelPlacement,b={x:l.x-l.boxMaxWidth/2,y:l.y-l.boxHeight/2,width:l.boxMaxWidth,height:l.boxHeight};
        for(const other of [...s.ports,...s.components.filter(c=>!c.applicationOverlay&&c.kind!=="text")]) assert.ok(!overlap(b,other),`${p.displayLabel} caption overlaps ${other.role||"socket"} at ${width}/${units}/${legacy}`);
      }
    }
    if(width===690)assert.ok(Math.abs(nativeScene.chassis.height/nativeScene.chassis.width-43.2/434.9)<1e-8);
  }
});

test("PA-3410 AC supplies expose three correctly arranged C14 blades without fictional live status", () => {
  const p=resolveModelFaceplate(deviceFor());
  for(const c of p.faces.rear.components.filter(c=>c.role==="ac-supply")) {
    const primitives=hardwarePrimitives({...c,x:0,y:0,width:90,height:60});
    assert.equal(primitives.filter(p=>p.fill==="#d0d6d8").length,3);
    assert.ok(!primitives.some(p=>p.fill==="#00ff00"));
  }
  assert.equal(p.faces.rear.components.filter(c=>c.role==="ac-supply").length,2);
});

test("PA-3410 custom hardware strokes remain inside source components at460/690 and1x/2x", () => {
  let checked=0;
  for(const width of [460,690])for(const scale of [1,2])for(const face of ["front","rear"]) {
    const scene=buildFaceplateScene(deviceFor(),{x:0,y:0,width,height:100},{face});
    for(const c of scene.components.filter(c=>c.variant?.startsWith("pa3410-"))) {
      const box={...c,x:c.x*scale,y:c.y*scale,width:c.width*scale,height:c.height*scale};
      for(const p of hardwarePrimitives(box)) {
        const points=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:
          p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:[];
        const margin=p.stroke?(p.strokeWidth||0)/2:0;
        for(const [x,y] of points)assert.ok(x-margin>=box.x-1e-8&&x+margin<=box.x+box.width+1e-8&&y-margin>=box.y-1e-8&&y+margin<=box.y+box.height+1e-8,`${face} ${c.variant} ${p.kind} bounds`);
        checked++;
      }
    }
  }
  assert.ok(checked>100);
});
