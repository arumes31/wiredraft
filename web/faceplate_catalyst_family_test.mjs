import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveCatalystFamilyFaceplate } from "./static/js/faceplate-catalyst-family-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives,hardwareComponentSVG } from "./static/js/hardware-components.js";

const models=["Catalyst 9200 family","Catalyst 9300 family","Catalyst 9500 family"];

/** Recreate old family inventory using the actual zone-ordering constructor, preserving its trailing stack group. */
function deviceFor(model,legacy=false) {
  let entry=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy) entry={...entry,inventoryRevision:0,groups:[
    {zone:model.includes("9500")?"uplink":"access",count:48,type:model.includes("9500")?"SFP28_25G":"RJ45_1G",speed:model.includes("9500")?25000:1000,poe:!model.includes("9500"),prefix:""},
    {zone:"uplink",count:4,type:model.includes("9500")?"QSFP28_100G":"SFP_PLUS_10G",speed:model.includes("9500")?100000:10000,prefix:"UPLINK"},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"},
    {zone:"uplink",count:2,type:"Stack",speed:40000,prefix:"STACK"},
  ]};
  const device=instantiateProfile(entry,model,{x:13,y:24});device.id="saved-device";
  for(const port of device.ports) {port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}
  return device;
}

/** Exercise the application resolver and caption layout at either supported rack width. */
function sceneFor(device,face="front",width=690) {
  return buildFaceplateScene(device,{x:0,y:0,width,height:100},{face});
}

/** Compare two axis-aligned boxes with a tolerance for floating-point edges. */
function overlaps(a,b) {return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model] of models.entries()) {
  test(`${model} selects its exact installed SKU and both documented faces`,()=>{
    const device=deviceFor(model),profile=resolveCatalystFamilyFaceplate(device);
    assert.equal(profile.sku,["C9200L-48P-4X","C9300L-48P-4X","C9500-48Y4C"][index]);
    assert.equal(profile.rearHardwareVerified,true);assert.equal(profile.inventoryComplete,true);
    assert.equal(device.ports.length,55);assert.equal(device.faceplate.inventoryRevision,1);
    assert.equal(sceneFor(device).ports.length,index===2?55:53);assert.equal(sceneFor(device,"rear").ports.length,index===2?0:2);
    assert.equal(sceneFor(device).unmappedPorts.length,0);
    assert.equal(profile.faces.rear.components.filter(part=>part.kind==="fan").length,[2,3,2][index]);
    assert.equal(profile.faces.rear.components.filter(part=>part.kind==="psu").length,1);
    assert.ok(profile.faces.rear.components.filter(part=>["fan","psu"].includes(part.kind)).every(part=>part.variant.startsWith("catalyst-")));
    assert.deepEqual(device.ports.slice(52).map(port=>port.type),["Console","USB_MINI_CONSOLE","RJ45_1G"]);
    assert.equal(device.ports[53].label,"USB CONSOLE");
    const data=sceneFor(device).ports.filter(slot=>slot.port.portIndex<=48);
    for(let i=0;i<48;i+=2) {assert.equal(data[i].centerX,data[i+1].centerX);assert.ok(data[i].centerY<data[i+1].centerY);}
  });

  test(`${model} keeps historical zone-ordered IDs, custom data, sparse arrays and unknown revisions unchanged`,()=>{
    const old=deviceFor(model,true);assert.deepEqual(old.ports.slice(52).map(port=>port.type),["Stack","Stack","RJ45_1G","USB_C_CONSOLE"]);
    delete old.faceplate.inventoryRevision;old.ports.reverse();
    for(const port of old.ports) {port.label="Saved custom label";port.speedMbps=123;port.nativeVlan=73;port.allowedVlans=[73,99];port.group="Edited";}
    const topology={devices:[old],links:[{id:"wire",sourcePortId:"saved-56",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:9,units:1}]}]};
    const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const front=sceneFor(old),rear=sceneFor(old,"rear"),all=[...front.ports,...rear.ports];
    assert.equal(all.length,54);assert.deepEqual(front.unmappedPorts.map(port=>port.portIndex).sort((a,b)=>a-b),[53,54]);
    assert.equal(all.find(slot=>slot.port.portIndex===56).connectorKind,"usb-mini");
    assert.equal(all.find(slot=>slot.port.portIndex===56).port.type,"USB_C_CONSOLE");
    assert.equal(all.find(slot=>slot.port.portIndex===55).port.id,"saved-55");assert.deepEqual(topology,before);
    old.ports=old.ports.filter(port=>[1,49,53,55,56].includes(port.portIndex));
    assert.equal([...sceneFor(old).ports,...sceneFor(old,"rear").ports].length,4);
    old.faceplate.inventoryRevision=99;assert.equal(sceneFor(old).ports.length,0);assert.equal(sceneFor(old).unmappedPorts.length,5);
    const edited=deviceFor(model);edited.ports[0].type="USB_C_CONSOLE";
    const editedBefore=structuredClone(edited);assert.ok(sceneFor(edited).unmappedPorts.some(port=>port.portIndex===1));
    assert.deepEqual(edited,editedBefore);
  });
}

test("Catalyst family fresh and saved captions stay inside local free spaces at460 and690",()=>{
  for(const model of models) for(const legacy of [false,true]) for(const width of [460,690]) for(const face of ["front","rear"]) {
    const device=deviceFor(model,legacy);if(legacy) for(const port of device.ports)port.label="Long saved customer caption";
    const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)]) {
      assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} ${face} measured bounds`);
    }
    for(const slot of scene.ports) {
      const label=slot.labelPlacement,w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6);
      const box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001,`${model} ${face} horizontal caption`);
      assert.ok(box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} ${face} vertical caption`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(part=>!part.applicationOverlay)]) assert.ok(!overlaps(box,other),`${model} ${face} port${slot.port.portIndex} caption intersects ${other.kind||other.port?.portIndex||"caption"} width${width}`);
      captions.push(box);
    }
    assert.deepEqual(device,before);
  }
});

test("dedicated Catalyst hardware is shared by Canvas/SVG and stays within measured component bounds",()=>{
  const variants=["catalyst-9200-fixed-fan","catalyst-9300-fan-t2","catalyst-9500-fantray","catalyst-c5-ac","catalyst-c1-ac","catalyst-9500-ac","catalyst-stack-cover","catalyst-9500-ssd-cover"];
  for(const variant of variants) {
    const part={kind:"fan",variant,x:10,y:20,width:variant.includes("fan-t2")?60:140,height:65};
    const art=hardwarePrimitives(part),svg=hardwareComponentSVG(part);assert.ok(art.length>3);assert.ok(!svg.includes("NaN"));
    if(variant.includes("fixed-fan")||variant.includes("fantray"))assert.ok(art.filter(p=>p.kind==="polygon"&&p.points.length===6).length>20);
    if(variant==="catalyst-9500-ac") assert.equal(art.filter(p=>p.kind==="rect"&&p.fill==="#c3c9c5"&&p.width>p.height).length,3,"9500 clockwise C14 contact orientation");
    for(const primitive of art) {
      if(primitive.kind==="polygon") for(const [x,y]of primitive.points) assert.ok(x>=part.x&&x<=part.x+part.width&&y>=part.y&&y<=part.y+part.height,variant);
      if(primitive.kind==="rect") assert.ok(primitive.x>=part.x&&primitive.y>=part.y&&primitive.x+primitive.width<=part.x+part.width+.001&&primitive.y+primitive.height<=part.y+part.height+.001,variant);
    }
  }
});
