import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveCiscoNexusFinalFaceplate} from "./static/js/faceplate-cisco-nexus-final-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["Nexus 7000 family","Nexus 9000 family"];

/** Reproduce the56-port2U inventory executed with checkpoint438's actual constructor. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:2,inventoryRevision:0,groups:[{zone:"uplink",count:48,type:"SFP28_25G",speed:25000,prefix:"SFP28"},{zone:"uplink",count:6,type:"QSFP28_100G",speed:100000,prefix:"QSFP28"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},{zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE"}]};
  const device=instantiateProfile(row,"Saved Nexus",{x:14,y:18});device.id="saved-nexus-final";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}return device;
}

/** Exercise the actual production dispatcher with the saved device allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Check interior overlap while allowing coincident floating-point edges. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects its documented installed hardware and canonical endpoint order`,()=>{
    const device=deviceFor(model),profile=resolveCiscoNexusFinalFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear");
    assert.equal(profile.sku,index?"N9K-C93180YC-FX3":"N7K-C7009");assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.equal(device.faceplate.unitsU,index?1:14);assert.equal(device.ports.length,index?56:50);assert.equal(front.ports.length,index?54:50);assert.equal(rear.ports.length,index?2:0);
    assert.equal(front.unmappedPorts.length,0);assert.equal(rear.unmappedPorts.length,0);
    assert.ok(Math.abs(front.chassis.height/front.chassis.width-(index?1.72:24.5)/17.3)<1e-10);
    assert.deepEqual(device.ports.slice(-2).map(p=>[p.portIndex,p.type,p.label]),index?[[55,"Console","CONSOLE"],[56,"RJ45_1G","MGMT"]]:[[49,"RJ45_1G","MGMT"],[50,"Console","CONSOLE"]]);
    if(!index){assert.equal(profile.faces.front.components.filter(c=>c.variant==="nexus-final-fabric").length,5);assert.equal(profile.faces.front.components.filter(c=>c.variant==="nexus-final-blank").length,7);assert.equal(profile.faces.rear.components.filter(c=>c.variant==="nexus-final-6kw").length,2);assert.equal(profile.faces.rear.components.filter(c=>c.variant==="nexus-final-fan-cover").length,1);}
  });
  test(`${model} preserves historical IDs, edited settings, cables, sparse order and allocated rack units`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,56);assert.deepEqual(old.ports.slice(-2).map(p=>[p.portIndex,p.type,p.label]),[[55,"RJ45_1G","MGMT"],[56,"Console","CONSOLE"]]);
    delete old.faceplate.inventoryRevision;old.ports.reverse();for(const port of old.ports){port.label="Edited customer description";port.speedMbps=123;port.nativeVlan=41;port.allowedVlans=[41,42];port.group="Customer";}
    const topology={devices:[old],links:[{id:"management",sourcePortId:"saved-55",targetPortId:"outside"},{id:"unsupported",sourcePortId:"saved-54",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:2}]}]},before=structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology),false);const front=sceneFor(old),rear=sceneFor(old,"rear"),all=[...front.ports,...rear.ports];assert.equal(all.length,index?56:50);
    assert.deepEqual(front.unmappedPorts.map(p=>p.portIndex).sort((a,b)=>a-b),index?[]:[49,50,51,52,53,54]);
    assert.equal(all.find(p=>p.port.portIndex===55).displayLabel,"Edited customer description");assert.deepEqual(topology,before);
    const fresh=sceneFor(deviceFor(model));assert.ok(Math.abs(front.chassis.height/front.chassis.width-fresh.chassis.height/fresh.chassis.width)<1e-10,"saved body keeps native aspect");
    old.ports=old.ports.filter(p=>[1,2,31,48,49,54,55,56].includes(p.portIndex));const sparse=structuredClone(old);assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,index?8:6);assert.deepEqual(old,sparse);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){const scene=sceneFor(old,face);assert.equal(scene.ports.length,0);assert.equal(scene.unmappedPorts.length,8);}
    const wrong=deviceFor(model);wrong.ports[0].type="Console";const wrongBefore=structuredClone(wrong);assert.ok(sceneFor(wrong).unmappedPorts.some(p=>p.portIndex===1));assert.deepEqual(wrong,wrongBefore);
  });
}

test("Nexus final native/saved captions, ports and exact primitives remain bounded460/690",()=>{
  for(const [index,model]of models.entries())for(const legacy of [false,true])for(const width of [460,690])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.ports.reverse();for(const port of device.ports)port.label="Very long customer description";const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(c=>c.variant?.startsWith("nexus-final-")))for(const primitive of hardwarePrimitives(component)){
      const points=primitive.kind==="polygon"?primitive.points:primitive.kind==="rect"?[[primitive.x,primitive.y],[primitive.x+primitive.width,primitive.y+primitive.height]]:primitive.kind==="circle"?[[primitive.cx-primitive.r,primitive.cy-primitive.r],[primitive.cx+primitive.r,primitive.cy+primitive.r]]:primitive.kind==="line"?[[primitive.x1,primitive.y1],[primitive.x2,primitive.y2]]:[];
      for(const [x,y]of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${model} ${component.variant} ${primitive.kind} primitive bounds`);
    }
    for(const slot of scene.ports){const label=slot.labelPlacement;if(label.hidden)continue;const w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6),box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001&&box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} caption bounds`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(!overlap(box,other),`${model} ${legacy?"old":"new"} ${width} ${face} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);captions.push(box);
    }
    assert.deepEqual(device,before);
  }
});

test("7009 fan cover and dual-input6kW supplies produce shared SVG source details",()=>{
  for(const variant of ["nexus-final-fan-cover","nexus-final-6kw","nexus-final-fabric"]){const component={kind:"module-bay",variant,x:12,y:10,width:180,height:variant.endsWith("cover")?270:65,label:"MODULE"},art=hardwarePrimitives(component),svg=hardwareComponentSVG(component);assert.ok(art.length>=8);assert.ok(!svg.includes("NaN"));if(variant.endsWith("6kw"))assert.equal(art.filter(p=>p.kind==="rect"&&p.fill==="#c8d5d6").length,6);}
});
