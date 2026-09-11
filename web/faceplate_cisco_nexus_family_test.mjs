import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveCiscoNexusFamilyFaceplate} from "./static/js/faceplate-cisco-nexus-family-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["Nexus 3000 family","Nexus 5000 family"];

/** Reconstruct the56-port2U historical constructor verified against actual checkpoint438 output. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:2,inventoryRevision:0,groups:[{zone:"uplink",count:48,type:"SFP28_25G",speed:25000,prefix:"SFP28"},
    {zone:"uplink",count:6,type:"QSFP28_100G",speed:100000,prefix:"QSFP28"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE"}]};
  const device=instantiateProfile(row,"Saved Nexus",{x:14,y:18});device.id="saved-nexus";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}return device;
}

/** Exercise the production dispatcher and scene against the actual saved allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect visible intersections without treating shared floating-point edges as overlaps. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects the documented base configuration with exact physical inventory`,()=>{
    const device=deviceFor(model),profile=resolveCiscoNexusFamilyFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear"),data=index?rear:front,service=index?front:rear;
    assert.equal(profile.sku,index?"N5K-C5548UP-FA":"N3K-C3064PQ-10GX");assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.ok(Math.abs(front.chassis.height/front.chassis.width-1.72/17.3)<1e-10,"manufacturer native body aspect at690");
    assert.equal(device.faceplate.unitsU,1);assert.equal(device.ports.length,index?34:55);assert.equal(data.ports.length,index?32:52);assert.equal(service.ports.length,index?2:3);
    assert.equal(front.unmappedPorts.length,0);assert.equal(rear.unmappedPorts.length,0);assert.equal(device.ports.at(-1).type,"Console");assert.equal(device.ports.at(-1).label,"CONSOLE");
    assert.equal(service.ports.find(slot=>slot.port.label==="MGMT0").port.portIndex,index?33:53);
    assert.equal(service.ports.find(slot=>slot.port.label==="MGMT0").connectorKind,"rj45-inverted","source upper management jack has bottom contacts");
    assert.equal(data.ports[0].centerX,data.ports[1].centerX);assert.ok(data.ports[0].centerY<data.ports[1].centerY);
    assert.equal(profile.faces[index?"front":"rear"].components.filter(part=>part.variant?.includes("psu")).length,2);
    if(index){assert.equal(front.components.filter(part=>part.variant==="nexus-disabled-link").length,2);assert.equal(rear.components.filter(part=>part.variant==="nexus-gem-cover").length,1);assert.equal(front.components.filter(part=>part.variant==="nexus-5548-fan").length,2);}
    else{assert.equal(device.ports[48].type,"QSFP_PLUS_40G");assert.equal(device.ports[53].label,"MGMT1");assert.equal(rear.components.filter(part=>part.variant==="nexus-3064-fan").length,1);}
  });

  test(`${model} preserves true historical order, unsupported sockets, edits, cables and allocation`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,56);assert.equal(old.faceplate.unitsU,2);
    assert.deepEqual(old.ports.slice(48).map(port=>[port.portIndex,port.type,port.label]),[...[49,50,51,52,53,54].map(i=>[i,"QSFP28_100G",String(i)]),[55,"RJ45_1G","MGMT"],[56,"Console","CONSOLE"]]);
    delete old.faceplate.inventoryRevision;old.ports.reverse();for(const port of old.ports){port.label="Edited customer interface";port.speedMbps=123;port.nativeVlan=41;port.allowedVlans=[41,42];port.group="Customer";}
    const topology={devices:[old],links:[{id:"console-cable",sourcePortId:"saved-56",targetPortId:"outside"},{id:"unmapped-cable",sourcePortId:"saved-54",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:2}]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const front=sceneFor(old),rear=sceneFor(old,"rear"),all=[...front.ports,...rear.ports];assert.equal(all.length,index?34:54);
    assert.deepEqual(rear.unmappedPorts.map(port=>port.portIndex).sort((a,b)=>a-b),index?Array.from({length:22},(_,i)=>i+33):[53,54]);
    assert.equal(all.find(slot=>slot.port.portIndex===1).port.type,"SFP28_25G");assert.equal(all.find(slot=>slot.port.portIndex===55).displayLabel,"Edited customer interface");
    const fresh=sceneFor(deviceFor(model));assert.equal(front.chassis.width,fresh.chassis.width);assert.ok(Math.abs(front.chassis.height-fresh.chassis.height)<1e-10);assert.deepEqual(topology,before);
    old.ports=old.ports.filter(port=>[1,2,31,32,33,48,49,52,53,54,55,56].includes(port.portIndex));const sparseBefore=structuredClone(old);
    assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,index?6:10);assert.deepEqual(old,sparseBefore);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,old.ports.length);}
    const edited=deviceFor(model);edited.ports[0].type="Console";const editedBefore=structuredClone(edited);assert.ok(sceneFor(edited,index?"rear":"front").unmappedPorts.some(port=>port.portIndex===1));assert.deepEqual(edited,editedBefore);
  });
}

test("Nexus captions, native body and source primitives fit460/690 in fresh and saved allocations",()=>{
  for(const model of models)for(const legacy of [false,true])for(const units of [1,2,4])for(const width of [460,690])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();for(const port of device.ports)port.label="Very long customer description";
    const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(part=>part.variant?.startsWith("nexus-")))for(const primitive of hardwarePrimitives(component)){
      const points=primitive.kind==="polygon"?primitive.points:primitive.kind==="rect"?[[primitive.x,primitive.y],[primitive.x+primitive.width,primitive.y+primitive.height]]:
        primitive.kind==="circle"?[[primitive.cx-primitive.r,primitive.cy-primitive.r],[primitive.cx+primitive.r,primitive.cy+primitive.r]]:
        primitive.kind==="line"?[[primitive.x1,primitive.y1],[primitive.x2,primitive.y2]]:[];
      for(const [x,y]of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${model} ${component.variant} ${primitive.kind} bounds`);
    }
    for(const slot of scene.ports){const label=slot.labelPlacement,w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6),box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001&&box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} caption bounds`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(!overlap(box,other),`${model} ${units}U ${width} ${face} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);captions.push(box);
    }
    const native=sceneFor(deviceFor(model),face,width);assert.ok(Math.abs(scene.chassis.height/scene.chassis.width-native.chassis.height/native.chassis.width)<1e-10,"native body aspect");assert.deepEqual(device,before);
  }
});

test("selected Nexus supplies and fan grilles use the common detailedSVG pipeline",()=>{
  for(const variant of ["nexus-3064-psu","nexus-5548-psu","nexus-3064-fan","nexus-5548-fan"]){
    const component={kind:"module-bay",variant,x:10,y:20,width:variant.includes("fan")?185:95,height:58,label:"MODULE"},art=hardwarePrimitives(component),svg=hardwareComponentSVG(component);
    assert.ok(art.length>12);assert.ok(!svg.includes("NaN"));assert.ok(svg.includes("polygon"));
    if(variant.includes("psu"))assert.equal(art.filter(part=>part.kind==="rect"&&part.fill==="#c8d1cf").length,3);
  }
});
