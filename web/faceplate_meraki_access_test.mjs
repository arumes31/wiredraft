import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveMerakiAccessFaceplate} from "./static/js/faceplate-meraki-access-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["Meraki MS120","Meraki MS210","Meraki MS225"];

/** Independently reconstruct the actual43853-port Meraki alias constructor, including its original optical speeds. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:1,inventoryRevision:0,groups:[{zone:"access",count:48,type:"RJ45_1G",speed:1000,poe:true,prefix:""},{zone:"uplink",count:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]};
  const device=instantiateProfile(row,"Saved Meraki",{x:14,y:18});device.id="saved-meraki";device.ports.forEach(port=>{port.id=`saved-${port.portIndex}`;port.deviceId=device.id;});return device;
}

/** Exercise production resolution, physical geometry and the actual saved allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect visible intersections while permitting floating-point coincident edges. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects the documented48FP hardware and exact physical inventory`,()=>{
    const device=deviceFor(model),profile=resolveMerakiAccessFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear");
    assert.equal(profile.sku,`MS${[120,210,225][index]}-48FP`);assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);assert.equal(device.ports.length,index?55:53);assert.equal(front.ports.length,52);assert.equal(rear.ports.length,index?3:1);assert.equal(front.unmappedPorts.length,0);assert.equal(rear.unmappedPorts.length,0);
    assert.equal(device.ports[48].type,index===2?"SFP_PLUS_10G":"SFP_1G");assert.equal(device.ports.at(-1).label,"MGMT");assert.ok(!device.ports.some(port=>port.type==="Console"));
    assert.equal(profile.faces.rear.components.filter(c=>c.variant==="meraki-access-grille").length,1);assert.equal(profile.faces.rear.components.filter(c=>c.variant==="meraki-access-rps").length,index?1:0);assert.ok(!profile.faces.rear.components.some(c=>c.kind==="psu"||c.kind==="fan"));
    for(const slot of front.ports.filter(slot=>slot.port.portIndex<=48))assert.equal(slot.connectorKind,slot.port.portIndex%2?"rj45-inverted":"rj45");
    assert.equal(rear.ports.find(slot=>slot.port.label==="MGMT").connectorKind,"rj45-inverted");
    if(index)assert.deepEqual(rear.ports.filter(slot=>slot.port.type==="Stack").map(slot=>[slot.port.portIndex,slot.port.label,slot.connectorKind]),[[53,"STACK 1","qsfp"],[54,"STACK 2","qsfp"]]);
    assert.ok(Math.abs(front.chassis.height/front.chassis.width-(index?1.72/19:1.73/17.32))<1e-10,"manufacturer native body aspect");
  });
  test(`${model} preserves old53endpoint inventory, settings, cables, sparse order and units`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,53);assert.deepEqual(old.ports.slice(48).map(p=>[p.portIndex,p.type,p.label]),[...[49,50,51,52].map(i=>[i,"SFP_PLUS_10G",String(i)]),[53,"RJ45_1G","MGMT"]]);delete old.faceplate.inventoryRevision;
    old.ports.reverse();old.ports.forEach(port=>{port.label="Edited customer interface";port.speedMbps=123;port.nativeVlan=41;port.allowedVlans=[41,42];port.group="Customer";});
    const topology={devices:[old],links:[{id:"cable",sourcePortId:"saved-53",targetPortId:"outside"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:1}]}]},before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const front=sceneFor(old),rear=sceneFor(old,"rear");assert.equal(front.ports.length,52);assert.equal(rear.ports.length,1);assert.equal(front.unmappedPorts.length,0);assert.equal(rear.ports[0].port.portIndex,53);assert.equal(rear.ports[0].displayLabel,"Edited customer interface");assert.equal(front.ports.find(slot=>slot.port.portIndex===49).port.type,"SFP_PLUS_10G");assert.deepEqual(topology,before);
    old.ports=old.ports.filter(p=>[1,2,24,25,48,49,52,53].includes(p.portIndex));const sparse=structuredClone(old);assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,8);assert.deepEqual(old,sparse);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,8);}
    const wrong=deviceFor(model);wrong.ports[48].type="QSFP28_100G";const wrongBefore=structuredClone(wrong);assert.ok(sceneFor(wrong).unmappedPorts.some(p=>p.portIndex===49));assert.deepEqual(wrong,wrongBefore);
  });
}

test("Meraki access captions, source hardware and native body remain bounded460/690 with saved edits",()=>{
  for(const model of models)for(const legacy of [false,true])for(const width of [460,690])for(const units of [1,2,4])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();device.ports.forEach(port=>{port.label="Very long customer description";});const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(c=>c.variant?.startsWith("meraki-access-")))for(const primitive of hardwarePrimitives(component)){
      const points=primitive.kind==="polygon"?primitive.points:primitive.kind==="rect"?[[primitive.x,primitive.y],[primitive.x+primitive.width,primitive.y+primitive.height]]:primitive.kind==="circle"?[[primitive.cx-primitive.r,primitive.cy-primitive.r],[primitive.cx+primitive.r,primitive.cy+primitive.r]]:[];
      for(const [x,y]of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${model} ${component.variant} primitive bounds`);
    }
    for(const slot of scene.ports){const label=slot.labelPlacement,w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6),box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001&&box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} caption bounds`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(!overlap(box,other),`${model} ${units}U ${width} ${face} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);captions.push(box);
    }
    const fresh=sceneFor(deviceFor(model),face,width);assert.ok(Math.abs(scene.chassis.height-fresh.chassis.height)<1e-10);assert.equal(scene.chassis.width,fresh.chassis.width);assert.deepEqual(device,before);
  }
});

test("Meraki fixedRPS connector contains exactly22contact cavities in the shared SVG pipeline",()=>{
  const component={kind:"power",variant:"meraki-access-rps",x:4,y:10,width:125,height:27},parts=hardwarePrimitives(component),svg=hardwareComponentSVG(component);assert.equal(parts.filter(p=>p.kind==="rect"&&p.fill==="#253d4a").length,22);assert.ok(!svg.includes("NaN"));assert.ok(svg.includes("rect"));
});
