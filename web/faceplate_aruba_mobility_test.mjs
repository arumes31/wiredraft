import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveArubaMobilityFaceplate} from "./static/js/faceplate-aruba-mobility.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

/** Use the production constructor for current and historical zone ordering. */
function deviceFor(legacy=false) {
  let entry=hardwareCatalog.find((row)=>row.vendor==="HPE Aruba"&&row.model==="Mobility Controller family");
  if(legacy) entry={...entry,inventoryRevision:0,groups:[
    {zone:"access",count:8,type:"RJ45_1G",speed:1000,prefix:""},
    {zone:"uplink",count:4,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},
    {zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"},
  ]};
  const device=instantiateProfile(entry,entry.model,{x:11,y:32});device.id="saved-controller";
  for(const port of device.ports){port.id=`saved-${port.portIndex}`;port.deviceId=device.id;}
  return device;
}

/** Exercise the shared renderer's actual scene model at both requested widths. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:100},{face});}

test("7205-RW selects four copper/SFP alternate pairs, two10G cages and three service sockets",()=>{
  const device=deviceFor();const profile=resolveArubaMobilityFaceplate(device);
  assert.equal(profile.sku,"JW735A");assert.equal(profile.fidelity,"model");assert.equal(profile.inventoryComplete,true);
  assert.equal(device.ports.length,13);assert.equal(sceneFor(device).ports.length,13);assert.equal(sceneFor(device,"rear").ports.length,0);
  assert.equal(sceneFor(device).unmappedPorts.length,0);assert.deepEqual(device.ports.slice(4,8).map((port)=>port.type),Array(4).fill("SFP_1G"));
  for(let index=0;index<4;index++){
    const pair=profile.faces.front.ports.filter((slot)=>slot.physicalLabel===String(index));
    assert.equal(pair.length,2);assert.ok(pair[0].x>pair[1].x,"source puts each copper socket right of its SFP alternative");
  }
  assert.match(profile.evidence.configuration,/integrated180W/);assert.match(profile.limitations.join(" "),/takes precedence/);
  assert.equal(profile.faces.rear.components.filter((part)=>part.kind==="power").length,1);
  assert.equal(profile.faces.rear.components.filter((part)=>["fan","psu"].includes(part.kind)).length,0);
  const cpu=profile.faces.rear.components.find((part)=>part.variant==="aruba-7205-cpu");
  assert.ok(hardwarePrimitives({...cpu,x:0,y:0,width:400,height:70}).some((part)=>part.kind==="text"&&part.text==="7205-MCC-1"));
});

test("7205 historical endpoints remain immutable and unsupported placeholder sockets stay unmapped",()=>{
  const old=deviceFor(true);delete old.faceplate.inventoryRevision;old.ports.reverse();
  for(const port of old.ports){port.label="0";port.speedMbps=100;port.nativeVlan=77;port.isPoe=true;port.allowedVlans=[77,99];}
  const topology={devices:[old],links:[{id:"cable",sourcePortId:"saved-14",targetPortId:"outside"}],racks:[{id:"rack",units:42}]};
  const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
  const scene=sceneFor(old);const fresh=sceneFor(deviceFor());
  assert.deepEqual(scene.unmappedPorts.map((port)=>port.portIndex).sort((a,b)=>a-b),[5,6,7,8,11,12]);
  for(const [prior,next] of [[1,1],[9,9],[13,11],[14,12]]){
    const actual=scene.ports.find((port)=>port.port.portIndex===prior);const expected=fresh.ports.find((port)=>port.port.portIndex===next);
    assert.equal(actual.centerX,expected.centerX);assert.equal(actual.centerY,expected.centerY);assert.equal(actual.port.id,`saved-${prior}`);
  }
  assert.deepEqual(topology,before);old.ports=old.ports.filter((port)=>[1,5,9,13,14].includes(port.portIndex));
  assert.equal(sceneFor(old).ports.length,4);old.faceplate.inventoryRevision=99;assert.equal(sceneFor(old).ports.length,0);
});

test("7205 physical captions stay clear at460 and690",()=>{
  for(const width of [460,690]){
    const scene=sceneFor(deviceFor(),"front",width);const captions=[];
    for(const port of scene.ports){
      const label=port.labelPlacement;const w=Math.min(label.boxMaxWidth,port.displayLabel.length*label.fontSize*.7+6);
      const box={x:label.x-w/2,y:label.y-label.boxHeight/2,width:w,height:label.boxHeight};
      assert.ok(box.x>=scene.chassis.x&&box.x+box.width<=scene.chassis.x+scene.chassis.width);
      assert.ok(box.y>=scene.chassis.y&&box.y+box.height<=scene.chassis.y+scene.chassis.height);
      for(const other of [...captions,...scene.ports,...scene.components.filter((part)=>!part.applicationOverlay)])assert.ok(
        !(box.x<other.x+other.width&&box.x+box.width>other.x&&box.y<other.y+other.height&&box.y+box.height>other.y),`${port.displayLabel} caption overlap at${width}`);
      captions.push(box);
    }
  }
});
