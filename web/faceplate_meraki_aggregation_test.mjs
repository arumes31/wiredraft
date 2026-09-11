import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveMerakiAggregationFaceplate} from "./static/js/faceplate-meraki-aggregation-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";
import {addMerakiAggregationHardware} from "./static/js/hardware-meraki-aggregation-components.js";
const models=["Meraki MS410","Meraki MS425","Meraki MS450"];

/** Reconstruct actual frozen438 groups independently of current catalog declarations. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:1,inventoryRevision:0,groups:[{zone:"access",count:48,type:"RJ45_1G",speed:1000,poe:true,prefix:""},{zone:"uplink",count:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]};
  const device=instantiateProfile(row,"Saved switch",{x:14,y:18});device.id="saved-meraki";device.ports.forEach(port=>{port.id=`saved-${port.portIndex}`;port.deviceId=device.id;});return device;
}
/** Resolve production geometry without changing the allocated rack height. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}
/** Detect real intersections while allowing coincident edges. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects documented optical inventory and rear population`,()=>{
    const device=deviceFor(model),profile=resolveMerakiAggregationFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear");
    assert.equal(profile.sku,["MS410-32","MS425-32","MS450-12"][index]);assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.equal(device.ports.length,[39,35,17][index]);assert.equal(front.ports.length,[36,34,14][index]);assert.equal(rear.ports.length,[3,1,3][index]);assert.equal(front.unmappedPorts.length,0);
    assert.equal(rear.components.filter(c=>c.kind==="fan").length,[2,3,3][index]);assert.equal(rear.components.filter(c=>c.kind==="psu").length,1);assert.equal(rear.components.filter(c=>c.variant==="meraki-aggregation-cover").length,1);
    assert.equal(device.ports.at(-1).label,"MGMT");assert.ok(!device.ports.some(p=>p.type==="Console"));
    assert.deepEqual(rear.ports.filter(s=>s.port.type==="Stack").map(s=>s.port.speedMbps),index===0?[40000,40000]:index===1?[]:[100000,100000]);
    assert.deepEqual(device.ports.slice(0,index===2?12:32).map(p=>p.type),Array(index===2?12:32).fill(["SFP_1G","SFP_PLUS_10G","QSFP_PLUS_40G"][index]));
    if(index===1){assert.match(profile.evidence.rearPopulationPhoto,/dedicatednetworksinc/);assert.match(profile.evidence.rearPopulationBasis,/Fan part revision is not asserted/);assert.ok(rear.components.find(c=>c.kind==="psu").x>rear.chassis.width*.7);}
    const ratio=index===0?1.74/17.33:1.72/(index===2?19.08:19);assert.ok(Math.abs(front.chassis.height/front.chassis.width-ratio)<1e-10);assert.equal(resolveFaceplateTemplate(device).id,"meraki-access-silver");
  });
  test(`${model} retains all historical53 endpoints and maps only supported identities`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,53);assert.deepEqual(old.ports.slice(48).map(p=>[p.portIndex,p.type,p.label]),[...[49,50,51,52].map(i=>[i,"SFP_PLUS_10G",String(i)]),[53,"RJ45_1G","MGMT"]]);delete old.faceplate.inventoryRevision;
    old.ports.reverse();old.ports.forEach(p=>{p.label="Edited customer interface";p.speedMbps=123;p.nativeVlan=47;p.allowedVlans=[47,48];p.group="Customer";});
    const topology={devices:[old],links:[{id:"cable",sourcePortId:"saved-53",targetPortId:"outside"},{id:"unmapped-cable",sourcePortId:"saved-1",targetPortId:"outside2"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:1}]}]},before=structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology),false);assert.equal(sceneFor(old).ports.length,index===0?4:0);assert.equal(sceneFor(old,"rear").ports.length,1);assert.equal(sceneFor(old,"rear").ports[0].port.portIndex,53);assert.equal(sceneFor(old,"rear").ports[0].displayLabel,"Edited customer interface");assert.equal(sceneFor(old).unmappedPorts.length,index===0?48:52);assert.deepEqual(topology,before);
    old.ports=old.ports.filter(p=>[1,2,24,25,48,49,52,53].includes(p.portIndex));const sparse=structuredClone(old);assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,index===0?3:1);assert.deepEqual(old,sparse);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,8);}
    const wrong=deviceFor(model);wrong.ports.at(-1).type="QSFP28_100G";const wrongBefore=structuredClone(wrong);assert.ok(sceneFor(wrong).unmappedPorts.some(p=>p.portIndex===wrong.ports.at(-1).portIndex));assert.deepEqual(wrong,wrongBefore);
  });
}

test("aggregation captions, primitive bounds and native aspect survive460/690 and saved1U/2U/4U",()=>{
  for(const model of models)for(const legacy of [false,true])for(const width of [460,690])for(const units of [1,2,4])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();device.ports.forEach(p=>{p.label="Very long saved interface label";});const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    const components=[...scene.components,...scene.ports.filter(s=>s.connectorKind?.startsWith("meraki-aggregation-")).map(s=>({...s,kind:s.connectorKind}))];
    for(const component of components.filter(c=>(c.variant||c.kind).startsWith("meraki-aggregation-"))){
      const parts=hardwarePrimitives(component);assert.ok(parts.length>=2,`${model} custom primitive dispatch`);
      for(const primitive of parts){const points=primitive.kind==="polygon"?primitive.points:primitive.kind==="rect"?[[primitive.x,primitive.y],[primitive.x+primitive.width,primitive.y+primitive.height]]:primitive.kind==="circle"?[[primitive.cx-primitive.r,primitive.cy-primitive.r],[primitive.cx+primitive.r,primitive.cy+primitive.r]]:[];
        for(const [x,y]of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${model} ${component.variant||component.kind} primitive bounds`);
      }
    }
    for(const slot of scene.ports){const label=slot.labelPlacement,w=Math.min(label.boxMaxWidth,slot.displayLabel.length*label.fontSize*.7+6),box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x-.001&&box.x+w<=scene.chassis.x+scene.chassis.width+.001&&box.y>=scene.chassis.y-.001&&box.y+box.height<=scene.chassis.y+scene.chassis.height+.001,`${model} caption bounds`);
      for(const other of [...captions,...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(!overlap(box,other),`${model} ${units}U ${width} ${face} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);captions.push(box);
    }
    const fresh=sceneFor(deviceFor(model),face,width);assert.ok(Math.abs(scene.chassis.height-fresh.chassis.height)<1e-10);assert.equal(scene.chassis.width,fresh.chassis.width);assert.deepEqual(device,before);
  }
});

test("lower optical cages put their latch above the cavity and250W supplies retain three C14 contacts",()=>{
  for(const kind of ["meraki-aggregation-sfp-up","meraki-aggregation-qsfp-up"]){const parts=hardwarePrimitives({kind,x:0,y:0,width:100,height:40});assert.ok(parts.some(p=>p.kind==="rect"&&p.fill==="#52666a"&&p.y===5.2));assert.ok(!hardwareComponentSVG({kind,x:0,y:0,width:100,height:40}).includes("NaN"));}
  const supply=hardwarePrimitives({kind:"psu",variant:"meraki-aggregation-250w",x:0,y:0,width:100,height:40});assert.equal(supply.filter(p=>p.fill==="#c8ceca").length,3);
});

test("aggregation helper declines invalid or unrelated kinds",()=>{
  for(const component of [{},{kind:4},{variant:42},{kind:false},{kind:"fan"}])assert.equal(addMerakiAggregationHardware(null,component),false);
});
