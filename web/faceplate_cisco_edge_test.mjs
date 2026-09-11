import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveCiscoEdgeFaceplate} from "./static/js/faceplate-cisco-edge-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["Catalyst 9800-L WLC","ISR 1100 family"];

/** Construct actual zone-ordered historical inventory with stable saved endpoint identities. */
function deviceFor(model,legacy=false){
  const wlc=model===models[0];let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:wlc?1:2,inventoryRevision:0,groups:[
    {zone:"access",count:wlc?4:8,type:"RJ45_1G",speed:1000,prefix:"GE"},
    {zone:"uplink",count:wlc?2:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"}]};
  const device=instantiateProfile(row,"Saved edge",{x:14,y:18});device.id="edge-saved";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}return device;
}

/** Exercise the actual model dispatcher and scene at the device's existing allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect visible intersections, excluding floating-point edge noise. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects an exact non-placeholder physical inventory and both verified faces`,()=>{
    const device=deviceFor(model),profile=resolveCiscoEdgeFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear"),io=index?rear:front;
    assert.equal(profile.sku,index?"C1111X-8P":"C9800-L-F-K9");assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.ok(Math.abs(io.chassis.height/io.chassis.width-(index?1.75/12.7:1.58/8.5))<1e-10,"manufacturer native body aspect at690");
    assert.equal(device.faceplate.unitsU,1);assert.equal(device.ports.length,index?13:10);assert.equal(io.ports.length,device.ports.length);assert.equal((index?front:rear).ports.length,0);
    assert.equal(io.unmappedPorts.length,0);assert.equal(device.ports.at(-1).type,"USB_MICRO_CONSOLE");assert.equal(device.ports.at(-1).label,"USB CONSOLE");
    assert.equal(io.ports.at(-1).connectorKind,"usb-micro");assert.equal(profile.faces.front.components.filter(part=>part.kind==="fan"||part.kind==="psu").length,0);
    assert.equal(profile.faces.rear.components.filter(part=>part.kind==="fan"||part.kind==="psu").length,0);
    if(index){
      assert.equal(device.ports[10].type,"SFP_1G");assert.equal(io.ports[0].centerX,io.ports[1].centerX);assert.ok(io.ports[0].centerY<io.ports[1].centerY);
      assert.match(profile.evidence.configuration,/PoE\/LTE\/WLAN\/DSL options absent/);
    }else{
      assert.equal(device.ports[0].type,"RJ45_MGIG");assert.equal(device.ports[0].speedMbps,2500);
      assert.equal(io.ports[6].centerX,io.ports[7].centerX);assert.ok(io.ports[6].centerY<io.ports[7].centerY);assert.equal(device.ports[6].label,"SP");assert.equal(device.ports[7].label,"RP");
    }
  });

  test(`${model} preserves real legacy endpoints, edits, cables and allocation with an explicit revision map`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,index?14:8);delete old.faceplate.inventoryRevision;old.ports.reverse();
    for(const port of old.ports){port.label="Edited customer interface";port.speedMbps=123;port.nativeVlan=41;port.allowedVlans=[41,42];port.group="Customer";}
    const topology={devices:[old],links:[{id:"saved-cable",sourcePortId:`saved-${index?14:8}`,targetPortId:"outside"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:index?2:1}]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const face=index?"rear":"front",scene=sceneFor(old,face);assert.equal(scene.ports.length,index?10:8);
    assert.deepEqual(scene.unmappedPorts.map(port=>port.portIndex).sort((a,b)=>a-b),index?[10,11,12,13]:[]);
    const usb=scene.ports.find(slot=>slot.port.portIndex===(index?14:8));assert.equal(usb.port.type,"USB_C_CONSOLE");assert.equal(usb.connectorKind,"usb-micro");
    if(index)assert.equal(scene.ports.find(slot=>slot.port.portIndex===9).port.type,"SFP_PLUS_10G");
    const fresh=sceneFor(deviceFor(model),face);assert.equal(scene.chassis.width,fresh.chassis.width);assert.ok(Math.abs(scene.chassis.height-fresh.chassis.height)<1e-10);
    assert.deepEqual(topology,before);old.ports=old.ports.filter(port=>[1,2,7,8,9,10,13,14].includes(port.portIndex));
    const sparseBefore=structuredClone(old);assert.equal(sceneFor(old,face).ports.length,index?6:4);assert.deepEqual(old,sparseBefore);
    old.faceplate.inventoryRevision=99;assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,old.ports.length);
    const edited=deviceFor(model);edited.ports[0].type="Console";const editedBefore=structuredClone(edited);assert.ok(sceneFor(edited,face).unmappedPorts.some(port=>port.portIndex===1));assert.deepEqual(edited,editedBefore);
  });
}

test("compact Cisco captions, native body and hardware primitives fit460/690 in fresh and saved allocations",()=>{
  for(const model of models)for(const legacy of [false,true])for(const units of [1,2,4])for(const width of [460,690])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();for(const port of device.ports)port.label="Very long customer description";
    const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(part=>part.variant?.startsWith("edge-")))for(const primitive of hardwarePrimitives(component)){
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

test("compact Cisco exact power connector contacts and bezel render in the common Canvas/SVG pipeline",()=>{
  for(const [variant,expected]of [["edge-wlc-rear",6],["edge-isr-power",4]]){
    const component={kind:"module-bay",variant,x:10,y:20,width:variant.includes("wlc")?332:75,height:variant.includes("wlc")?60:30};
    const art=hardwarePrimitives(component),svg=hardwareComponentSVG(component);
    assert.equal(art.filter(part=>part.kind==="rect"&&part.fill===(expected===6?"#68828b":"#92a29c")).length,expected);assert.ok(!svg.includes("NaN"));assert.ok(svg.includes("polygon"));
  }
});
