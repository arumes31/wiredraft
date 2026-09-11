import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveCatalystChassisFaceplate} from "./static/js/faceplate-catalyst-chassis-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
const models=["Catalyst 9400 family","Catalyst 9600 family"];

/** Recreate the actual revision-zero six-unit family constructor, including its two management placeholders. */
function deviceFor(model,legacy=false) {
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:6,inventoryRevision:0,groups:[
    {zone:"uplink",count:48,type:"SFP28_25G",speed:25000,prefix:"SFP28"},
    {zone:"uplink",count:8,type:"QSFP28_100G",speed:100000,prefix:"QSFP28"},
    {zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"},
  ]};
  const device=instantiateProfile(row,model,{x:17,y:29});device.id="saved-chassis";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}return device;
}

/** Exercise the integrated scene at each current or historical rack allocation. */
function sceneFor(device,face="front",width=690) {
  return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});
}

/** Detect visible intersections while tolerating floating-point edge rounding. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects compatible installed cards, exact power and source-specific rear plates`,()=>{
    const device=deviceFor(model),profile=resolveCatalystChassisFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear");
    assert.equal(profile.sku,index?"C9606R":"C9404R");assert.equal(device.faceplate.unitsU,index?8:6);
    assert.equal(device.ports.length,index?52:59);assert.equal(front.ports.length,device.ports.length);assert.equal(rear.ports.length,0);
    assert.equal(profile.rearHardwareVerified,true);assert.equal(profile.inventoryComplete,true);assert.equal(front.unmappedPorts.length,0);
    assert.equal(profile.faces.front.components.filter(part=>part.kind==="psu").length,2);
    assert.equal(profile.faces.rear.components.filter(part=>part.kind==="fan"||part.kind==="psu").length,0,"side-facing internal cooling and front supplies");
    assert.match(profile.evidence.configuration,index?/C9600-SUP-1/:/C9400X-SUP-2/);
    assert.equal(device.ports.at(-1).type,"USB_MINI_CONSOLE");assert.equal(device.ports.at(-1).label,"USB CONSOLE");
    for(let i=0;i<48;i+=2){assert.equal(front.ports[i].centerX,front.ports[i+1].centerX);assert.ok(front.ports[i].centerY<front.ports[i+1].centerY);}
    const largeGap=front.ports[index?24:12].centerX-front.ports[index?22:10].centerX;
    assert.ok(largeGap>front.ports[2].centerX-front.ports[0].centerX,"source card bank gap");
  });

  test(`${model} keeps historical endpoints, edited settings, cables and rack allocation unchanged`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,59);delete old.faceplate.inventoryRevision;old.ports.reverse();
    for(const port of old.ports){port.label="Edited customer caption";port.speedMbps=123;port.nativeVlan=47;port.allowedVlans=[47,52];port.group="Custom";}
    const topology={devices:[old],links:[{id:"cable",sourcePortId:"saved-59",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:6}]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const scene=sceneFor(old);assert.equal(scene.ports.length,index?50:54);
    assert.deepEqual(scene.unmappedPorts.map(port=>port.portIndex).sort((a,b)=>a-b),index?[49,50,51,52,53,54,55,56,58]:[53,54,55,56,58]);
    assert.equal(scene.ports.find(slot=>slot.port.portIndex===59).connectorKind,"usb-mini");
    assert.equal(scene.ports.find(slot=>slot.port.portIndex===59).port.type,"USB_C_CONSOLE");assert.deepEqual(topology,before);
    const fresh=sceneFor(deviceFor(model));assert.equal(scene.chassis.width,fresh.chassis.width);assert.equal(scene.chassis.height,fresh.chassis.height);
    old.ports=old.ports.filter(port=>[1,2,48,49,53,57,58,59].includes(port.portIndex));
    const sparseBefore=structuredClone(old);assert.equal(sceneFor(old).ports.length,index?5:6);assert.deepEqual(old,sparseBefore);
    old.faceplate.inventoryRevision=27;assert.equal(sceneFor(old).ports.length,0);assert.equal(sceneFor(old).unmappedPorts.length,8);
    const edited=deviceFor(model);edited.ports[0].type="Console";const editedBefore=structuredClone(edited);assert.ok(sceneFor(edited).unmappedPorts.some(port=>port.portIndex===1));assert.deepEqual(edited,editedBefore);
  });
}

test("modular Catalyst captions and hardware fit native and smaller saved allocations at460/690",()=>{
  for(const model of models)for(const legacy of [false,true])for(const units of [4,6,8])for(const width of [460,690])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();for(const port of device.ports)port.label="Very long saved description";
    const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    for(const component of scene.components.filter(part=>part.variant?.startsWith("cat-")))for(const primitive of hardwarePrimitives(component)){
      const points=primitive.kind==="polygon"?primitive.points:primitive.kind==="rect"?[[primitive.x,primitive.y],[primitive.x+primitive.width,primitive.y+primitive.height]]:
        primitive.kind==="circle"?[[primitive.cx-primitive.r,primitive.cy-primitive.r],[primitive.cx+primitive.r,primitive.cy+primitive.r]]:
        primitive.kind==="line"?[[primitive.x1,primitive.y1],[primitive.x2,primitive.y2]]:[];
      for(const [x,y]of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${model} ${component.variant} ${primitive.kind} primitive bounds`);
    }
    for(const slot of scene.ports){
      const label=slot.labelPlacement,w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6),box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001&&box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} caption bounds`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)])assert.ok(!overlap(box,other),`${model} ${units}U ${width} ${face} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);
      captions.push(box);
    }
    assert.deepEqual(device,before);
    const native=sceneFor(deviceFor(model),face,width);assert.ok(Math.abs(scene.chassis.height/scene.chassis.width-native.chassis.height/native.chassis.width)<1e-10,"body aspect preserved");
  }
});

test("dedicated chassis power and rear service primitives retain source forms in Canvas/SVG",()=>{
  for(const variant of ["cat-9400-3200ac","cat-9600-2kwac","cat-9404-rear","cat-9606-rear","cat-chassis-fan-front"]){
    const part={kind:"module-bay",variant,x:10,y:20,width:variant.includes("rear")?460:150,height:variant.includes("rear")?350:75};
    const art=hardwarePrimitives(part),svg=hardwareComponentSVG(part);assert.ok(!svg.includes("NaN"));
    if(variant==="cat-chassis-fan-front"){
      assert.equal(art.filter(p=>p.kind==="polygon").length,1,"service handle without exposed internal impellers");
      assert.equal(art.filter(p=>p.kind==="circle").length,5,"two fasteners and three status indicators");
    }else assert.ok(art.length>8,variant);
    if(variant==="cat-9400-3200ac")assert.equal(art.filter(p=>p.kind==="rect"&&p.fill==="#bbc6c2").length,3,"C20 horizontal contacts");
    if(variant==="cat-9600-2kwac")assert.equal(art.filter(p=>p.kind==="rect"&&p.fill==="#c4ced0").length,3,"clockwise C14 horizontal contacts");
    if(variant.includes("rear")){
      const beacon=art.find(p=>p.kind==="circle"&&p.fill==="#48a8c3");
      assert.ok(variant==="cat-9404-rear"?beacon.cy>part.y+part.height/2:beacon.cy<part.y+part.height/2,"documented rear beacon above or below the handle");
    }
    for(const primitive of art)if(primitive.kind==="polygon")for(const [x,y]of primitive.points)assert.ok(x>=part.x&&x<=part.x+part.width&&y>=part.y&&y<=part.y+part.height,variant);
  }
});
