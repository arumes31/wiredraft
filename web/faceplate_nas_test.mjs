import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveNASFaceplate } from "./static/js/faceplate-nas-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

const cases = [
  {vendor:"Synology",model:"RackStation family",sku:"RS3621RPxs",count:4,speed:1000,trays:12},
  {vendor:"QNAP",model:"Rackmount NAS family",sku:"TS-873AeU-RP-4G",count:2,speed:2500,trays:8},
];

/** Recreate the former five-port constructor independently of the revised NAS catalog. */
function makeDevice(c, legacy=false) {
  const original=hardwareCatalog.find((p)=>p.vendor===c.vendor&&p.model===c.model);
  const catalog=legacy?{...original,units:2,inventoryRevision:0,groups:[
    {zone:"access",count:4,type:"RJ45_10G",speed:10000,prefix:"LAN",poe:false},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT",poe:false}]}:original;
  const d=instantiateProfile(catalog,"unchanged NAS",{x:29,y:47});
  d.id="saved-nas";d.rackId="saved-rack";d.rackPosition=11;
  d.ports.forEach((p)=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});
  return d;
}

/** Test positive-area intersections, allowing touching panel boundaries. */
function overlaps(a,b) {
  return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;
}

for(const c of cases) {
  test(`${c.vendor} declares the exact diskless SKU and physical network inventory`,()=>{
    const d=makeDevice(c),p=resolveNASFaceplate(d);
    assert.equal(p.evidence.sku,c.sku);assert.equal(p.fidelity,"model");assert.equal(p.inventoryRevision,1);
    assert.equal(d.faceplate.unitsU,2);assert.equal(d.ports.length,c.count);assert.ok(d.ports.every((port)=>port.speedMbps===c.speed));
    assert.equal(p.faces.front.components.filter((a)=>a.kind==="drive-carrier").length,c.trays);
    assert.equal(p.faces.rear.components.filter((a)=>a.kind==="psu").length,2);
    assert.equal(p.faces.front.ports.length,0);assert.equal(p.faces.rear.ports.length,c.count);
    assert.ok(p.evidence.configuration.includes("diskless"));
    assert.ok(p.faces.rear.ports.every((port)=>port.connectorKind==="rj45"));
  });

  test(`${c.vendor} preserves full saved topology, sparse/reordered IDs and unsupported historical sockets`,()=>{
    for(const legacy of [false,true]) {
      const d=makeDevice(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      d.ports.forEach((p)=>Object.assign(p,{speedMbps:100,label:`custom-${p.portIndex}`,nativeVlan:88,allowedVlans:[88,90],isPoe:true,group:"custom"}));
      d.ports.reverse();
      const topology={devices:[d],links:d.ports.map((p)=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,label:"custom cable",color:"#123456",points:[{x:10,y:20}]}))};
      const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"rear"});
      assert.equal(scene.unmappedPorts.length,legacy?5-c.count:0);assert.deepEqual(topology,before);
      assert.deepEqual(scene.ports.map((p)=>p.port.id).sort(),Array.from({length:c.count},(_,i)=>`saved-${i+1}`).sort());
      d.ports=d.ports.filter((p)=>[2,4,5].includes(p.portIndex));
      const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});
      assert.ok(sparse.ports.every((box)=>box.port.id===`saved-${box.port.portIndex}`&&box.port.portIndex<=c.count));
      d.faceplate.inventoryRevision=99;
      const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});
      assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });

  test(`${c.vendor} keeps artwork, ports and captions in bounds at460/690 and saved1/2/4U`,()=>{
    for(const width of [460,690])for(const face of ["front","rear"]) {
      const d=makeDevice(c);const native=buildFaceplateScene(d,{x:0,y:0,width,height:200},{face});
      for(const units of [1,2,4]) {
        d.faceplate.unitsU=units;
        const scene=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
        assert.ok(Math.abs(scene.chassis.width/scene.chassis.height-native.chassis.width/native.chassis.height)<1e-8);
        for(const part of [...scene.components.filter((a)=>!a.applicationOverlay),...scene.ports]) {
          assert.ok(part.x>=scene.chassis.x-1e-6&&part.y>=scene.chassis.y-1e-6);
          assert.ok(part.x+part.width<=scene.chassis.x+scene.chassis.width+1e-6);
          assert.ok(part.y+part.height<=scene.chassis.y+scene.chassis.height+1e-6);
        }
        for(const box of scene.ports) {
          const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6));
          const caption={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
          assert.ok(caption.y>=scene.chassis.y&&caption.y+caption.height<=scene.chassis.y+scene.chassis.height);
          for(const part of [...scene.ports,...scene.components.filter((a)=>a.kind!=="text")]) {
            assert.ok(!overlaps(caption,part),`${box.displayLabel} caption overlaps ${part.role||"port"} at${units}U`);
            if(part!==box)assert.ok(!overlaps(box,part),`${box.displayLabel} overlaps ${part.role||"port"}`);
          }
        }
      }
    }
  });
}

test("the two manufacturer panels retain distinct tray order, supply orientation and documented ancillary sockets",()=>{
  const [s,q]=cases.map((c)=>resolveNASFaceplate(makeDevice(c)));
  assert.deepEqual(s.faces.front.components.filter((p)=>p.kind==="drive-carrier").map((p)=>p.driveNumber),[1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(q.faces.front.components.filter((p)=>p.kind==="drive-carrier").map((p)=>p.driveNumber),[7,8,4,5,6,1,2,3]);
  assert.equal(s.faces.rear.components.filter((p)=>p.kind==="fan").length,0);
  assert.equal(q.faces.rear.components.filter((p)=>p.kind==="fan").length,3);
  assert.equal(s.faces.rear.components.filter((p)=>p.variant==="synology-infiniband").length,2);
  assert.ok(s.faces.rear.components.some((p)=>p.role==="manufacturing-only-com"));
  assert.ok(!q.faces.rear.components.some((p)=>/console|vga|management/.test(p.role)));
  for(const [variant,side] of [["synology-delta-500w","left"],["qnap-300w-rp","right"]]) {
    const parts=hardwarePrimitives({kind:"psu",variant,x:0,y:0,width:120,height:50});
    const contacts=parts.filter((p)=>p.kind==="rect"&&p.fill==="#d0d6d8");
    assert.equal(contacts.length,3);
    assert.ok(contacts.every((p)=>side==="left"?p.x<60:p.x>60));
  }
});
