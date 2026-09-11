import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveRemainingUPSFaceplate} from "./static/js/faceplate-ups-remaining-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const cases=[{vendor:"CyberPower",model:"Smart App UPS family",sku:"PR1500LCDRT2U",prefix:"RMCARD",input:"cyberpower-captive-input",outlet:"pr1500-nema15"},
  {vendor:"Vertiv",model:"Liebert UPS family",sku:"GXT5-1500IRT2UXL",prefix:"UNITY",input:"gxt5-c14",outlet:"gxt5-c13"}];

/** Reconstruct the real former two-endpoint constructor independently of current catalog groups. */
function deviceFor(c,legacy=false) {
  const p=hardwareCatalog.find(p=>p.vendor===c.vendor&&p.model===c.model),catalog=legacy?{...p,units:2,inventoryRevision:0,groups:[
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:c.prefix},{zone:"management",count:1,type:"Power",speed:0,prefix:"AC"}]}:p;
  const d=instantiateProfile(catalog,"custom UPS",{x:11,y:22});d.id="saved-ups";d.rackId="rack-a";d.rackPosition=7;
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Detect genuine area intersections while allowing adjacent frame edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.vendor} selects exact SKU, installed card and three-endpoint new inventory`,()=>{
    const d=deviceFor(c),p=resolveRemainingUPSFaceplate(d);assert.equal(p.sku,c.sku);assert.equal(p.fidelity,"model");assert.equal(p.inventoryRevision,1);
    assert.deepEqual(d.ports.map(p=>p.type),["RJ45_1G","Power","Console"]);assert.equal(d.ports[0].speedMbps,100);
    assert.equal(p.faces.rear.ports.length,3);assert.equal(p.faces.front.ports.length,0);
    assert.equal(p.faces.rear.components.filter(p=>p.variant===c.outlet).length,8);
    assert.equal(p.faces.rear.components.filter(p=>p.kind==="psu").length,0);
    assert.equal(p.faces.rear.components.filter(p=>p.kind==="fan").length,c.vendor==="CyberPower"?1:0);
    assert.equal(p.faces.rear.ports.find(p=>p.portIndex===2).connectorKind,c.input);
    assert.ok(p.faces.rear.components.some(p=>p.role.includes("usb-monitor")));
    assert.ok(p.faces.rear.components.every(p=>p.active===false));
  });
  test(`${c.vendor} preserves full saved topology, explicit legacy identity and unsupported ports`,()=>{
    for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      d.ports.forEach(p=>Object.assign(p,{label:`renamed-${p.portIndex}`,nativeVlan:33,allowedVlans:[33,44],isPoe:true,group:"custom"}));d.ports.reverse();
      const topology={devices:[d],links:d.ports.map(p=>({id:`link-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,color:"#aabbcc",label:"keep cable",points:[{x:9,y:8}]}))};
      const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const s=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"rear"});assert.equal(s.ports.length,legacy?2:3);assert.equal(s.unmappedPorts.length,0);assert.deepEqual(topology,before);
      if(legacy)assert.equal(d.ports.find(p=>p.portIndex===1).speedMbps,1000);
      d.ports=d.ports.filter(p=>p.portIndex===1);const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});assert.equal(sparse.ports[0].port.id,"saved-1");
      d.ports[0].type="USB_C_CONSOLE";const unsupported=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});assert.equal(unsupported.unmappedPorts.length,1);
      d.ports[0].type="RJ45_1G";d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,1);
    }
  });
  test(`${c.vendor} geometry and captions remain bounded at460/690 and1/2/4U`,()=>{
    for(const width of [460,690])for(const face of ["front","rear"]) {
      const d=deviceFor(c),native=buildFaceplateScene(d,{x:0,y:0,width,height:200},{face});
      for(const units of [1,2,4]) {
        d.faceplate.unitsU=units;const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
        assert.ok(Math.abs(s.chassis.width/s.chassis.height-native.chassis.width/native.chassis.height)<1e-8);
        for(const p of [...s.ports,...s.components.filter(p=>!p.applicationOverlay)]) {
          assert.ok(p.x>=s.chassis.x-1e-6&&p.y>=s.chassis.y-1e-6);assert.ok(p.x+p.width<=s.chassis.x+s.chassis.width+1e-6&&p.y+p.height<=s.chassis.y+s.chassis.height+1e-6);
        }
        for(const box of s.ports) {
          const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6)),label={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
          assert.ok(label.y>=s.chassis.y&&label.y+label.height<=s.chassis.y+s.chassis.height);
          for(const p of [...s.ports,...s.components.filter(a=>a.kind!=="text")]) {
            assert.ok(!overlap(label,p),`${box.displayLabel} caption overlaps ${p.role||"socket"} at${units}U/${width}`);
            if(p!==box)assert.ok(!overlap(box,p),`${box.displayLabel} overlaps ${p.role||"socket"}`);
          }
        }
      }
    }
  });
}

test("UPS source-specific power contacts, inactive displays and card roles remain distinct",()=>{
  for(const variant of ["pr1500-nema15","gxt5-c13"]) {
    const art=hardwarePrimitives({kind:"power",variant,x:0,y:0,width:42,height:35});
    assert.equal(art.filter(p=>p.fill==="#05090b").length,3,`${variant} has three receptacle apertures`);
  }
  const inlet=hardwarePrimitives({kind:"gxt5-c14",x:0,y:0,width:35,height:50});assert.equal(inlet.filter(p=>p.fill==="#d0d6d8").length,3);
  const cord=hardwarePrimitives({kind:"cyberpower-captive-input",x:0,y:0,width:32,height:22});assert.ok(cord.some(p=>p.kind==="circle"));assert.equal(cord.filter(p=>p.fill==="#d0d6d8").length,0);
  for(const c of cases) {
    const p=resolveRemainingUPSFaceplate(deviceFor(c)),front=p.faces.front.components.flatMap(a=>hardwarePrimitives({...a,x:0,y:0,width:690*a.width,height:127*a.height}));
    assert.ok(front.some(p=>p.kind==="rect"&&p.fill==="#0b171b"));assert.ok(!front.some(p=>p.kind==="text"&&/\d+[VWA]|on line/i.test(p.text)));
  }
  const cyber=resolveRemainingUPSFaceplate(deviceFor(cases[0])),vertiv=resolveRemainingUPSFaceplate(deviceFor(cases[1]));
  assert.equal(cyber.faces.rear.components.filter(p=>p.kind==="db9").length,2);
  assert.ok(cyber.faces.rear.ports.find(p=>p.portIndex===3).physicalLabel.includes("CARD"));
  assert.ok(vertiv.faces.rear.components.some(p=>p.role==="rdu101-sensor"));assert.ok(vertiv.faces.rear.components.some(p=>p.role==="rdu101-usb-storage"));
  const status=hardwarePrimitives({...vertiv.faces.rear.components.find(p=>p.role==="rdu101-status"),x:0,y:0,width:21,height:4});
  assert.equal(status.length,1);assert.equal(status[0].kind,"rect");assert.equal(status[0].fill,"#6b757a","Inactive RDU101 status lens must not render as an extra RJ45 socket");
});
