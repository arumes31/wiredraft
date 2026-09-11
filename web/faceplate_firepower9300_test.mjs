import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveFirepower9300Faceplate} from "./static/js/faceplate-firepower9300-model.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {addFirepower9300Hardware} from "./static/js/hardware-firepower9300-components.js";
const models=["Secure Firewall 9300"];
/** Reconstruct the actual frozen43835-port constructor independently from the changed catalog. */
function deviceFor(model=models[0],legacy=false){
 let row=hardwareCatalog.find(r=>r.model===model);
 if(legacy)row={...row,units:3,inventoryRevision:0,groups:[{zone:"uplink",count:24,type:"SFP28_25G",speed:25000,prefix:"SFP28"},{zone:"uplink",count:8,type:"QSFP28_100G",speed:100000,prefix:"QSFP28"},{zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT"},{zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE"}]};
 const d=instantiateProfile(row,"Saved firewall",{x:14,y:18});d.id="saved-firewall";d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}
/** Resolve a real production scene using the existing rack allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}
/** Detect genuine intersections while tolerating coincident edges. */
function overlap(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

test("Firepower9300 selects the inspected later AC chassis and installed18-port population",()=>{
 const d=deviceFor(),p=resolveFirepower9300Faceplate(d),front=sceneFor(d),rear=sceneFor(d,"rear");
 assert.equal(p.sku,"FPR-C9300-AC");assert.equal(p.fidelity,"model");assert.equal(p.rearHardwareVerified,true);assert.equal(d.ports.length,18);assert.equal(front.ports.length,18);assert.equal(rear.ports.length,0);assert.equal(front.unmappedPorts.length,0);
 assert.deepEqual(d.ports.slice(0,8).map(p=>p.type),Array(8).fill("SFP_PLUS_10G"));assert.deepEqual(d.ports.slice(8,16).map(p=>p.type),Array(8).fill("QSFP28_100G"));assert.equal(d.ports[16].type,"SFP_1G");assert.equal(d.ports[17].type,"Console");
 assert.deepEqual(d.ports.map(p=>p.label),[...Array.from({length:8},(_,i)=>`1/${i+1}`),...Array.from({length:4},(_,i)=>`2/${i+1}`),...Array.from({length:4},(_,i)=>`3/${i+1}`),"MGMT","CONSOLE"]);
 assert.equal(front.components.filter(c=>c.variant==="firepower9300-sm40").length,3);assert.equal(front.components.filter(c=>c.kind==="psu").length,2);assert.equal(rear.components.filter(c=>c.kind==="fan").length,4);assert.equal(rear.components.filter(c=>c.variant==="firepower9300-ac-feed").length,2);assert.equal(rear.components.filter(c=>c.variant==="firepower9300-switch").length,1);
 assert.match(p.evidence.configuration,/FPR9K-SM-40/);assert.match(p.evidence.configuration,/FPR9K-NM-4X100G/);assert.ok(Math.abs(front.chassis.height/front.chassis.width-5.25/17.5)<1e-10);
});

test("all35 actual historical records survive with only eight100G and the console mapped",()=>{
 const d=deviceFor(models[0],true);assert.equal(d.ports.length,35);assert.equal(d.ports[24].label,"QSFP281");assert.equal(d.ports[32].label,"MGMT1");assert.equal(d.ports[34].label,"CONSOLE1");delete d.faceplate.inventoryRevision;d.ports.reverse();d.ports.forEach(p=>{p.label="Customer saved link";p.speedMbps=123;p.nativeVlan=47;p.allowedVlans=[47,48];});
 const topology={devices:[d],links:[{id:"mapped",sourcePortId:"saved-25",targetPortId:"outside"},{id:"unmapped",sourcePortId:"saved-1",targetPortId:"other"}],racks:[{id:"rack",devices:[{deviceId:d.id,startUnit:12,units:3}]}]},before=structuredClone(topology);
 assert.equal(upgradeInstalledPhysicalPorts(topology),false);const scene=sceneFor(d);assert.equal(scene.ports.length,9);assert.equal(scene.unmappedPorts.length,26);assert.deepEqual(new Set(scene.ports.map(s=>s.port.portIndex)),new Set([25,26,27,28,29,30,31,32,35]));assert.deepEqual(topology,before);
 d.ports=d.ports.filter(p=>[1,8,24,25,28,32,33,34,35].includes(p.portIndex));assert.equal(sceneFor(d).ports.length,4);assert.equal(sceneFor(d).unmappedPorts.length,5);d.faceplate.inventoryRevision=99;assert.equal(sceneFor(d).ports.length,0);assert.equal(sceneFor(d).unmappedPorts.length,9);
 const wrong=deviceFor();wrong.ports[0].type="SFP28_25G";wrong.ports[16].type="RJ45_1G";const wrongBefore=structuredClone(wrong);assert.deepEqual(sceneFor(wrong).unmappedPorts.map(p=>p.portIndex),[1,17]);assert.deepEqual(wrong,wrongBefore);
});

test("Firepower9300 captions, primitive bounds and native aspect survive460/690 and saved3U/4U/6U",()=>{
  for(const model of models)for(const legacy of [false,true])for(const width of [460,690])for(const units of [3,4,6])for(const face of ["front","rear"]){
    const device=deviceFor(model,legacy);device.faceplate.unitsU=units;device.ports.reverse();device.ports.forEach(p=>{p.label="Very long saved interface label";});const before=structuredClone(device),scene=sceneFor(device,face,width),captions=[];
    for(const element of [...scene.ports,...scene.components.filter(c=>!c.applicationOverlay)])assert.ok(element.x>=scene.chassis.x-.001&&element.y>=scene.chassis.y-.001&&element.x+element.width<=scene.chassis.x+scene.chassis.width+.001&&element.y+element.height<=scene.chassis.y+scene.chassis.height+.001,`${model} element bounds`);
    const components=[...scene.components,...scene.ports.filter(s=>s.connectorKind?.startsWith("firepower9300-")).map(s=>({...s,kind:s.connectorKind}))];
    for(const component of components.filter(c=>(c.variant||c.kind).startsWith("firepower9300-"))){
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

test("compact allocations fit native3U aspect without changing saved rack metadata",()=>{
 for(const units of [1,2,3,6]){const d=deviceFor();d.faceplate.unitsU=units;const before=structuredClone(d),s=sceneFor(d);assert.ok(s.chassis.y+s.chassis.height<=units*100);assert.ok(Math.abs(s.chassis.height/s.chassis.width-5.25/17.5)<1e-10);assert.deepEqual(d,before);}
});

test("Firepower9300 helper retains three source-drawn AC-feed contacts and declines unrelated kinds",()=>{
 const p=hardwarePrimitives({kind:"power",variant:"firepower9300-ac-feed",x:0,y:0,width:100,height:70});assert.equal(p.filter(p=>p.fill==="#c6d1c5").length,3);
 for(const component of [{},{kind:4},{variant:42},{kind:false},{kind:"fan"}])assert.equal(addFirepower9300Hardware(null,component),false);
});

test("rear AC feed discloses symbolic manufacturer geometry independently of C19 cord compatibility",()=>{
 const profile=resolveFirepower9300Faceplate(deviceFor());assert.match(profile.evidence.acFeedGeometry,/symbolic/);assert.match(profile.evidence.acFeedGeometry,/C19/);assert.match(profile.evidence.acFeedGeometry,/not verified/);
 assert.equal(sceneFor(deviceFor(),"rear").components.filter(c=>c.variant==="firepower9300-ac-feed").length,2);
});

test("Firepower source sockets do not intersect USB or captive-fastener envelopes",()=>{
 for(const width of [460,690])for(const legacy of [false,true]){const s=sceneFor(deviceFor(models[0],legacy),"front",width);for(const p of s.ports)for(const c of s.components.filter(c=>!c.applicationOverlay&&!['text','led'].includes(c.kind)))assert.ok(!overlap(p,c),`${width} ${p.port.label} overlaps ${c.kind}`);}
});

test("tight captive-screw envelopes preserve visible source geometry at both widths",()=>{
 for(const width of [460,690]){const s=sceneFor(deviceFor(),"front",width),screws=s.components.filter(c=>c.screwEnvelopeScale);for(const [i,c]of screws.entries()){
  const expected=hardwarePrimitives({kind:"screw",variant:"firepower9300-screw",x:s.chassis.x+[.521,.760][i]*s.chassis.width,y:s.chassis.y+.100*s.chassis.height,width:.027*s.chassis.width,height:.09*s.chassis.height}),actual=hardwarePrimitives(c);assert.equal(actual.length,expected.length);
  for(const [j,p]of expected.entries())for(const key of Object.keys(p)){if(typeof p[key]==="number")assert.ok(Math.abs(actual[j][key]-p[key])<1e-9,`${width} ${key} geometry changed`);else assert.equal(actual[j][key],p[key]);}
 }}
});
