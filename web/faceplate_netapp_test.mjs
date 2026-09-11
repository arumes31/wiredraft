import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveNetAppFaceplate} from "./static/js/faceplate-netapp-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

/** Independently reconstruct the former ten-port 4U FAS constructor for migration regressions. */
function deviceFor(legacy=false) {
  const p=hardwareCatalog.find(p=>p.vendor==="NetApp"&&p.model==="FAS family");
  const catalog=legacy?{...p,units:4,inventoryRevision:0,groups:[{zone:"uplink",count:8,type:"SFP28_25G",speed:25000,prefix:"DATA"},{zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]}:p;
  const d=instantiateProfile(catalog,"custom FAS",{x:11,y:22});d.id="saved-fas";d.rackId="rack-a";d.rackPosition=7;
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Detect positive-area intersections without flagging shared component edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

test("FAS8300 selects the sourced controller-only chassis and preserves exact constructor index ordering",()=>{
  const d=deviceFor(),p=resolveNetAppFaceplate(d);assert.equal(p.sku,"FAS8300");assert.equal(p.inventoryRevision,1);assert.equal(p.fidelity,"model");
  assert.equal(d.ports.length,22);assert.equal(p.faces.rear.ports.length,22);assert.equal(p.faces.front.ports.length,0);
  assert.deepEqual(d.ports.map(p=>p.type),[...Array(8).fill("SFP28_25G"),...Array(2).fill("RJ45_1G"),...Array(4).fill("SFP28_25G"),...Array(4).fill("QSFP28_100G"),...Array(2).fill("Console"),...Array(2).fill("USB_MICRO_CONSOLE")]);
  assert.equal(p.faces.front.components.filter(c=>c.kind==="fan").length,8);assert.equal(p.faces.front.components.filter(c=>c.kind==="drive-carrier").length,0);
  assert.equal(p.faces.rear.components.filter(c=>c.kind==="psu").length,4);assert.equal(p.faces.rear.components.filter(c=>c.kind==="fan").length,0);
  assert.equal(p.faces.rear.components.filter(c=>c.variant==="fas8300-slot-cover").length,10);
  assert.equal(p.faces.rear.components.filter(c=>c.variant==="fas8300-sas").length,8);
});

test("FAS inventories retain complete saved topologies, labels, settings and rack allocation",()=>{
  for(const legacy of [false,true]) {
    const d=deviceFor(legacy);if(legacy)delete d.faceplate.inventoryRevision;
    d.ports.forEach(p=>Object.assign(p,{label:`renamed-${p.portIndex}`,speedMbps:100,nativeVlan:33,allowedVlans:[33,44],isPoe:true,group:"custom"}));d.ports.reverse();
    const topology={devices:[d],links:d.ports.map(p=>({id:`link-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,color:"#aabbcc",label:"keep cable",points:[{x:9,y:8}]}))};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const s=buildFaceplateScene(d,{x:0,y:0,width:690,height:400},{face:"rear"});assert.equal(s.ports.length,legacy?10:22);assert.equal(s.unmappedPorts.length,0);assert.deepEqual(topology,before);
    d.ports=d.ports.filter(p=>[2,7,9,10,12].includes(p.portIndex));
    const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:400},{face:"rear"});assert.ok(sparse.ports.every(p=>p.port.id===`saved-${p.port.portIndex}`));
    d.ports[0].type="USB_C_CONSOLE";
    const unsupported=buildFaceplateScene(d,{x:0,y:0,width:460,height:400},{face:"rear"});assert.equal(unsupported.unmappedPorts.length,1);assert.equal(unsupported.unmappedPorts[0].id,d.ports[0].id);
    d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:400},{face:"rear"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
  }
});

test("FAS8300 preserves proportions, socket bounds and caption separation at460/690 and2/4/6U",()=>{
  for(const width of [460,690])for(const face of ["front","rear"]) {
    const d=deviceFor(),native=buildFaceplateScene(d,{x:0,y:0,width,height:400},{face});
    for(const units of [2,4,6]) {
      d.faceplate.unitsU=units;const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
      assert.ok(Math.abs(s.chassis.width/s.chassis.height-native.chassis.width/native.chassis.height)<1e-8);
      for(const p of [...s.ports,...s.components.filter(p=>!p.applicationOverlay)]) {
        assert.ok(p.x>=s.chassis.x-1e-6&&p.y>=s.chassis.y-1e-6);
        assert.ok(p.x+p.width<=s.chassis.x+s.chassis.width+1e-6&&p.y+p.height<=s.chassis.y+s.chassis.height+1e-6);
      }
      for(const box of s.ports) {
        const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6));
        const label={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
        assert.ok(label.y>=s.chassis.y&&label.y+label.height<=s.chassis.y+s.chassis.height);
        for(const p of [...s.ports,...s.components.filter(a=>a.kind!=="text")]) {
          assert.ok(!overlap(label,p),`${box.displayLabel} caption overlaps ${p.role||"socket"} at${units}U/${width}`);
          if(p!==box)assert.ok(!overlap(box,p),`${box.displayLabel} overlaps ${p.role||"socket"}`);
        }
      }
    }
  }
});

test("FAS8300 controller orientation and source-specific PSU/fan artwork are concrete",()=>{
  const p=resolveNetAppFaceplate(deviceFor()),ports=new Map(p.faces.rear.ports.map(p=>[p.portIndex,p]));
  assert.ok(ports.get(1).y<ports.get(5).y);assert.ok(ports.get(1).x<ports.get(4).x);assert.ok(ports.get(5).x<ports.get(8).x);
  assert.equal(ports.get(1).physicalLabel,"A e0e");assert.equal(ports.get(11).physicalLabel,"A e0a");assert.equal(ports.get(15).physicalLabel,"A e0c");
  assert.equal(ports.get(19).connectorKind,"rj45");assert.equal(ports.get(21).connectorKind,"usb-micro");
  const psu=hardwarePrimitives({kind:"psu",variant:"fas8300-1600w-platinum",x:0,y:0,width:120,height:80});
  assert.equal(psu.filter(p=>p.kind==="rect"&&p.fill==="#d0d6d8").length,3);
  const fan=hardwarePrimitives({kind:"fan",variant:"fas8300-fan-module",x:0,y:0,width:120,height:80});
  assert.equal(fan.filter(p=>p.kind==="circle").length,1,"Opaque front fan covers must not invent exposed rotors");
  const cover=hardwarePrimitives({kind:"module-bay",variant:"fas8300-slot-cover",text:"3",x:0,y:0,width:150,height:26});
  assert.ok(cover.some(p=>p.kind==="text"&&p.text==="3"&&p.fontSize>=6),"Source slot numbers must remain readable in the hardware artwork");
});
