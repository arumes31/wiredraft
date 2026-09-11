import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveMerakiAdvancedFaceplate} from "./static/js/faceplate-meraki-advanced-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives,hardwareComponentSVG} from "./static/js/hardware-components.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";
import {addMerakiAdvancedHardware} from "./static/js/hardware-meraki-advanced-components.js";
const models=["Meraki MS250","Meraki MS350","Meraki MS390"];

/** Independently reproduce the actual frozen438 constructor groups and then apply deterministic identities. */
function deviceFor(model,legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:1,inventoryRevision:0,groups:[{zone:"access",count:48,type:"RJ45_1G",speed:1000,poe:true,prefix:""},{zone:"uplink",count:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]};
  const device=instantiateProfile(row,"Saved switch",{x:14,y:18});device.id="saved-meraki";device.ports.forEach(port=>{port.id=`saved-${port.portIndex}`;port.deviceId=device.id;});return device;
}

/** Resolve a production scene using the complete unchanged saved rack allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect actual visible box intersections with a small tolerance for coincident edges. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

for(const [index,model]of models.entries()){
  test(`${model} selects its documented supply, cooling and uplink population`,()=>{
    const device=deviceFor(model),profile=resolveMerakiAdvancedFaceplate(device),front=sceneFor(device),rear=sceneFor(device,"rear");
    assert.equal(profile.sku,["MS250-48LP","MS350-48LP","MS390-48P-HW"][index]);assert.equal(profile.fidelity,"model");assert.equal(profile.rearHardwareVerified,true);
    assert.equal(device.ports.length,index===2?59:55);assert.equal(front.ports.length,index===2?56:52);assert.equal(rear.ports.length,3);assert.equal(front.unmappedPorts.length,0);assert.equal(rear.unmappedPorts.length,0);
    assert.equal(rear.components.filter(c=>c.kind==="fan").length,[0,2,3][index]);assert.equal(rear.components.filter(c=>c.kind==="psu").length,1);assert.equal(rear.components.filter(c=>c.variant==="meraki-advanced-psu-cover").length,1);
    assert.equal(rear.components.filter(c=>c.variant==="meraki-advanced-stackpower").length,index===2?2:0);
    for(const slot of front.ports.filter(s=>s.port.portIndex<=48))assert.equal(slot.connectorKind,slot.port.portIndex%2?"rj45-inverted":"rj45");
    const stacks=rear.ports.filter(s=>s.port.type==="Stack");assert.deepEqual(stacks.map(s=>s.port.speedMbps),index===2?[120000,120000]:[40000,40000]);assert.ok(stacks.every(s=>s.connectorKind===(index===2?"meraki-advanced-stack":"qsfp")));
    assert.equal(device.ports.at(-1).label,"MGMT");assert.equal(rear.ports.find(s=>s.port.label==="MGMT").connectorKind,index===2?"rj45":"rj45-inverted");assert.ok(!device.ports.some(p=>p.type==="Console"));
    if(index===2){assert.deepEqual(device.ports.slice(48,56).map(p=>p.label),["1","2","3","4","5","6","7","8"]);assert.match(profile.evidence.configuration,/MA-MOD-8X10G/);}
    const ratio=index===2?1.73/17.5:1.72/(index===1?19.07:19);assert.ok(Math.abs(front.chassis.height/front.chassis.width-ratio)<1e-10);assert.equal(resolveFaceplateTemplate(device).id,"meraki-access-silver");
  });
  test(`${model} preserves the actual53-endpoint historical identities and rejects unknown revisions/types`,()=>{
    const old=deviceFor(model,true);assert.equal(old.ports.length,53);assert.deepEqual(old.ports.slice(48).map(p=>[p.portIndex,p.type,p.label]),[...[49,50,51,52].map(i=>[i,"SFP_PLUS_10G",String(i)]),[53,"RJ45_1G","MGMT"]]);delete old.faceplate.inventoryRevision;
    old.ports.reverse();old.ports.forEach(p=>{p.label="Edited customer interface";p.speedMbps=123;p.nativeVlan=47;p.allowedVlans=[47,48];p.group="Customer";});
    const topology={devices:[old],links:[{id:"cable",sourcePortId:"saved-53",targetPortId:"outside"}],racks:[{id:"rack",devices:[{deviceId:old.id,startUnit:12,units:1}]}]},before=structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology),false);assert.equal(sceneFor(old).ports.length,52);assert.equal(sceneFor(old,"rear").ports.length,1);assert.equal(sceneFor(old,"rear").ports[0].port.portIndex,53);assert.equal(sceneFor(old,"rear").ports[0].displayLabel,"Edited customer interface");assert.equal(sceneFor(old).unmappedPorts.length,0);assert.deepEqual(topology,before);
    old.ports=old.ports.filter(p=>[1,2,24,25,48,49,52,53].includes(p.portIndex));const sparse=structuredClone(old);assert.equal(sceneFor(old).ports.length+sceneFor(old,"rear").ports.length,8);assert.deepEqual(old,sparse);
    old.faceplate.inventoryRevision=99;for(const face of ["front","rear"]){assert.equal(sceneFor(old,face).ports.length,0);assert.equal(sceneFor(old,face).unmappedPorts.length,8);}
    const wrong=deviceFor(model);wrong.ports[48].type="QSFP28_100G";const wrongBefore=structuredClone(wrong);assert.ok(sceneFor(wrong).unmappedPorts.some(p=>p.portIndex===49));assert.deepEqual(wrong,wrongBefore);
  });
}

test("advanced Meraki captions and source primitives remain bounded at460/690 and saved1U/2U/4U",()=>{
  for(const model of models)for(const legacy of [false,true])for(const width of [460,690])for(const units of [1,2,4])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();device.ports.forEach(p=>{p.label="Very long saved interface label";});const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    const components=[...scene.components,...scene.ports.filter(s=>s.connectorKind==="meraki-advanced-stack").map(s=>({...s,kind:s.connectorKind}))];
    for(const component of components.filter(c=>(c.variant||c.kind).startsWith("meraki-advanced-"))){
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

test("MS250/MS350 supply retains its source C16 heat key while MS390 uses the three-contact C14",()=>{
  const component={kind:"psu",x:0,y:0,width:100,height:40},old=hardwarePrimitives({...component,variant:"meraki-advanced-640w"}),modern=hardwarePrimitives({...component,variant:"meraki-advanced-715w"});
  assert.equal(old.length,modern.length+1);assert.equal(old.filter(p=>p.fill==="#c8ceca").length,3);assert.equal(modern.filter(p=>p.fill==="#c8ceca").length,3);assert.ok(!hardwareComponentSVG({...component,variant:"meraki-advanced-640w"}).includes("NaN"));
});

test("Meraki helper declines absent or nonstring kinds without invoking an art builder",()=>{
  for(const component of [{},{kind:4},{variant:42},{kind:false},{kind:"fan"}])assert.equal(addMerakiAdvancedHardware(null,component),false);
});
