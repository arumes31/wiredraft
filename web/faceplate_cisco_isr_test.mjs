import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveCiscoISRFaceplate} from "./static/js/faceplate-cisco-isr-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["ISR 4300 family","ISR 4400 family"];

/** Reconstruct the actual old2U14-port constructor independently of the new catalog inventory. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:2,inventoryRevision:0,groups:[{zone:"access",count:8,type:"RJ45_1G",speed:1000,prefix:"GE"},
    {zone:"uplink",count:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"}]};
  const device=instantiateProfile(row,"Saved ISR",{x:14,y:18});device.id="saved-isr";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}return device;
}

/** Exercise the production dispatcher and scene against the actual saved allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect actual overlaps without treating shared floating-point edges as intersections. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects exact native chassis, source population and canonical ports`,()=>{
    const device=deviceFor(model),profile=resolveCiscoISRFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear"),all=[...front.ports,...rear.ports];
    assert.equal(profile.sku,index?"ISR4431/K9":"ISR4331/K9");assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.ok(Math.abs(front.chassis.height/front.chassis.width-(index?1.73:1.75)/17.25)<1e-10,"manufacturer native body aspect at690");
    assert.equal(device.faceplate.unitsU,1);assert.equal(device.ports.length,index?12:8);assert.equal(front.ports.length,index?0:4);assert.equal(rear.ports.length,index?12:4);
    assert.equal(all.length,device.ports.length);assert.equal(front.unmappedPorts.length,0);assert.equal(rear.unmappedPorts.length,0);
    assert.equal(device.ports.at(-1).type,"USB_MINI_CONSOLE");assert.equal(device.ports.at(-1).label,"USB CONSOLE");assert.equal(all.find(slot=>slot.port.portIndex===device.ports.length).connectorKind,"usb-mini");
    assert.equal(device.ports.at(-2).label,"AUX");assert.equal(rear.components.filter(part=>part.variant==="isr-nim-cover").length,index?3:2);
    assert.equal(front.components.filter(part=>part.variant==="isr-4431-psu").length,index?2:0);assert.equal(rear.components.filter(part=>part.variant==="isr-sm-cover").length,index?0:1);
    assert.equal(profile.faces.rear.components.filter(part=>part.kind==="fan"||part.kind==="psu").length,0);
    const data=rear.ports.filter(slot=>slot.port.portIndex<= (index?8:4)),first=data.find(slot=>slot.port.portIndex===1),second=data.find(slot=>slot.port.portIndex===2);
    assert.equal(first.centerX,second.centerX);assert.ok(first.centerY<second.centerY);
    if(index){assert.ok(rear.ports.find(slot=>slot.port.portIndex===10).centerX<first.centerX);assert.ok(rear.ports.find(slot=>slot.port.portIndex===3).centerX>rear.ports.find(slot=>slot.port.portIndex===8).centerX);}
    else assert.equal(profile.faces.rear.ports.find(slot=>slot.portIndex===4).physicalLabel,"GE0/0/2");
  });

  test(`${model} preserves historical endpoints, edits, cables and allocation through guarded explicit maps`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,14);assert.equal(old.faceplate.unitsU,2);delete old.faceplate.inventoryRevision;old.ports.reverse();
    for(const port of old.ports){port.label="Edited customer interface";port.speedMbps=123;port.nativeVlan=41;port.allowedVlans=[41,42];port.group="Customer";}
    const topology={devices:[old],links:[{id:"saved-cable",sourcePortId:"saved-14",targetPortId:"outside"},{id:"unmapped-cable",sourcePortId:"saved-8",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:2}]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const front=sceneFor(old),rear=sceneFor(old,"rear"),all=[...front.ports,...rear.ports];assert.equal(all.length,index?10:6);
    assert.deepEqual(rear.unmappedPorts.map(port=>port.portIndex).sort((a,b)=>a-b),index?[5,6,7,8]:[3,4,5,6,7,8,11,12]);
    const usb=all.find(slot=>slot.port.portIndex===14);assert.equal(usb.port.type,"USB_C_CONSOLE");assert.equal(usb.connectorKind,"usb-mini");
    assert.equal(all.find(slot=>slot.port.portIndex===9).port.type,"SFP_PLUS_10G");
    const fresh=sceneFor(deviceFor(model));assert.equal(front.chassis.width,fresh.chassis.width);assert.ok(Math.abs(front.chassis.height-fresh.chassis.height)<1e-10);assert.deepEqual(topology,before);
    old.ports=old.ports.filter(port=>[1,2,5,8,9,10,13,14].includes(port.portIndex));const sparseBefore=structuredClone(old);
    assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,6);assert.deepEqual(old,sparseBefore);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,old.ports.length);}
    const edited=deviceFor(model);edited.ports[0].type="Console";const editedBefore=structuredClone(edited);assert.ok(sceneFor(edited,"rear").unmappedPorts.some(port=>port.portIndex===1));assert.deepEqual(edited,editedBefore);
  });
}

test("ISR captions, native body and detailed primitives fit460/690 in fresh and saved allocations",()=>{
  for(const model of models)for(const legacy of [false,true])for(const units of [1,2,4])for(const width of [460,690])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();for(const port of device.ports)port.label="Very long customer description";
    const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(part=>part.variant?.startsWith("isr-")))for(const primitive of hardwarePrimitives(component)){
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

test("selected4431 supplies expose a source fan, latch and exactly three C14 contacts through sharedSVG",()=>{
  const component={kind:"module-bay",variant:"isr-4431-psu",x:10,y:20,width:145,height:58,label:"PSU 1"},art=hardwarePrimitives(component),svg=hardwareComponentSVG(component);
  assert.equal(art.filter(part=>part.kind==="rect"&&part.fill==="#bdc7c5").length,3);assert.ok(art.filter(part=>part.kind==="circle").length>=2);assert.ok(art.length>15);assert.ok(!svg.includes("NaN"));assert.ok(svg.includes("polygon"));
});
