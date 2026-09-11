import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveFortinetFinalFaceplate} from "./static/js/faceplate-fortinet-final-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {addFortinetFinalHardware} from "./static/js/hardware-fortinet-final-components.js";
const models=["FortiSwitch Rugged 112F-POE","FortiSwitch Rugged 216F-POE","FortiWLC family"];
/** Independently reproduce the actual frozen438 group definitions without loading a private snapshot. */
function deviceFor(model,legacy=false){
 let row=hardwareCatalog.find(r=>r.model===model);if(legacy){const wlc=model===models[2],n=model===models[1]?16:8;
 /** Recreate one historical constructor group with its original speed and PoE defaults. */
 const group=(zone,count,type,speed,prefix,poe=false)=>({zone,count,type,speed,prefix,poe});
 row={...row,units:wlc?1:2,inventoryRevision:0,groups:[group("access",n,"RJ45_1G",1000,wlc?"":"PORT",!wlc),group("uplink",4,model===models[0]?"SFP_1G":"SFP_PLUS_10G",model===models[0]?1000:10000,model===models[0]?"SFP":"SFP+"),...(wlc?[group("management",1,"RJ45_1G",1000,"MGMT"),group("management",1,"Console",0,"CONSOLE")]:[group("management",1,"Console",0,"CONSOLE"),group("management",1,"RJ45_1G",1000,"MGMT")])]};}
 const d=instantiateProfile(row,"Saved appliance",{x:14,y:18});d.id="saved-device";d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}
/** Use the real production scene and the device's existing allocation. */
function sceneFor(device,face="front",width=690){return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}
/** Reject positive-area intersections while permitting adjacent boundaries. */
function overlaps(a,b){return a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;}

test("final Fortinet models select inspected hardware with complete new inventories",()=>{
 for(const [i,model] of models.entries()){const d=deviceFor(model),p=resolveFortinetFinalFaceplate(d),s=sceneFor(d);assert.equal(hardwareCatalog.find(r=>r.model===model).preserveInstalledPorts,true);assert.equal(p.fidelity,"model");assert.equal(p.rearHardwareVerified,true);assert.equal(p.sku,["FSR-112F-POE","FSR-216F-POE","FortiWLC-500D"][i]);assert.equal(d.ports.length,[14,22,11][i]);assert.equal(s.ports.length,d.ports.length);assert.equal(s.unmappedPorts.length,0);assert.equal(sceneFor(d,"rear").ports.length,0);assert.ok(p.limitations.length);}
 const wlc=deviceFor(models[2]);assert.deepEqual(wlc.ports.map(p=>p.type),[...Array(4).fill("RJ45_1G"),...Array(4).fill("SFP_1G"),...Array(2).fill("SFP_PLUS_10G"),"Console"]);assert.deepEqual(wlc.ports.map(p=>p.label),["1","2","3","4","5","6","7","8","9","10","CONSOLE"]);
});

test("actual historical inventories preserve every record and only source-supported identities",()=>{
 for(const [i,model]of models.entries()){const d=deviceFor(model,true);assert.equal(d.ports.length,[14,22,14][i]);delete d.faceplate.inventoryRevision;d.ports.reverse();for(const p of d.ports){p.label="Customer saved interface";p.speedMbps=123;p.nativeVlan=47;p.allowedVlans=[47,48];}
 const topology={devices:[d],links:[{id:"cable",sourcePortId:"saved-1",targetPortId:"outside"},{id:"other",sourcePortId:"saved-13",targetPortId:"elsewhere"}],racks:[{id:"rack",devices:[{deviceId:d.id,startUnit:8,units:i===2?1:2}]}]},before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);const s=sceneFor(d);assert.equal(s.ports.length,[14,22,7][i]);assert.equal(s.unmappedPorts.length,[0,0,7][i]);assert.deepEqual(topology,before);
 if(i===2)assert.deepEqual(s.ports.map(p=>p.port.portIndex).sort((a,b)=>a-b),[1,2,3,4,9,10,14]);d.ports=d.ports.filter(p=>p.portIndex%3);const sparse=structuredClone(d);sceneFor(d);assert.deepEqual(d,sparse);d.faceplate.inventoryRevision=99;assert.equal(sceneFor(d).ports.length,0);assert.equal(sceneFor(d).unmappedPorts.length,d.ports.length);
 const wrong=deviceFor(model);wrong.ports[0].type="SFP28_25G";assert.ok(sceneFor(wrong).unmappedPorts.some(p=>p.portIndex===1));}
});

test("source captions and custom primitives fit both widths and old allocations",()=>{
 for(const model of models)for(const legacy of [false,true])for(const width of [460,690])for(const face of ["front","rear"]){const d=deviceFor(model,legacy);if(legacy)for(const p of d.ports)p.label="Long saved interface description";const before=structuredClone(d),s=sceneFor(d,face,width),captions=[];
 for(const c of [...s.ports,...s.components.filter(c=>!c.applicationOverlay&&!c.captionBackground)])assert.ok(c.x>=s.chassis.x-.001&&c.y>=s.chassis.y-.001&&c.x+c.width<=s.chassis.x+s.chassis.width+.001&&c.y+c.height<=s.chassis.y+s.chassis.height+.001,`${model} component bounds`);
 for(const slot of s.ports){const l=slot.labelPlacement,w=Math.min(l.boxMaxWidth,slot.displayLabel.length*l.fontSize*.7+6),box={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};assert.ok(l.fontSize>=5.5);for(const other of [...captions,...s.ports,...s.components.filter(c=>!c.applicationOverlay&&!c.captionBackground)])assert.ok(!overlaps(box,other),`${model} ${width} caption${slot.port.portIndex} intersects ${other.kind||other.port?.portIndex||"caption"}`);captions.push(box);}
 for(const c of [...s.components,...s.ports.map(p=>({...p,kind:p.connectorKind}))].filter(c=>typeof(c.variant||c.kind)==="string"&&(c.variant||c.kind).startsWith("fortinet-final-"))){const parts=hardwarePrimitives(c);assert.ok(parts.length>=2);for(const p of parts){const points=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:[];for(const [x,y]of points)assert.ok(x>=c.x-.001&&x<=c.x+c.width+.001&&y>=c.y-.001&&y<=c.y+c.height+.001,`${c.variant||c.kind} primitive bounds`);}}
 assert.deepEqual(d,before);}
});

test("final helper defensively declines missing or unrelated component kinds",()=>{for(const c of [{},{kind:4},{variant:42},{kind:false},{kind:"fan"}])assert.equal(addFortinetFinalHardware(null,c),false);});

test("native body aspects survive enlarged or compact saved allocations without stretching hardware",()=>{
 for(const [index,model]of models.entries())for(const units of [1,2,4]){const d=deviceFor(model,true);d.faceplate.unitsU=units;const before=structuredClone(d),s=sceneFor(d),body=index===2?s.chassis:s.components.find(c=>c.variant===`fortinet-final-body-${index===0?112:216}`),ratio=[66.5/127,180/116.4,44/438][index];assert.ok(Math.abs(body.height/body.width-ratio)<1e-10,`${model} body aspect`);assert.ok(s.chassis.y+s.chassis.height<=units*100);assert.deepEqual(d,before);}
});

test("source-specific contact orientations, bracket patterns and supplies remain distinct",()=>{
 const a=sceneFor(deviceFor(models[0])),b=sceneFor(deviceFor(models[1])),c=sceneFor(deviceFor(models[2]),"rear");
 assert.equal(a.ports[0].connectorKind,"rj45-inverted");assert.equal(a.ports[1].connectorKind,"rj45");assert.equal(b.ports[0].connectorKind,"fortinet-final-rj45-left");assert.equal(b.ports[1].connectorKind,"fortinet-final-rj45-right");assert.ok(b.ports[0].centerY>b.ports[15].centerY);assert.ok(b.ports[16].centerY>b.ports[19].centerY);
 assert.equal(c.components.filter(p=>p.variant==="fortinet-final-wlc-psu").length,2);assert.equal(c.components.filter(p=>p.kind==="fan").length,0);assert.equal(deviceFor(models[1]).ports.at(-1).speedMbps,100);assert.equal(deviceFor(models[1],true).ports.at(-1).speedMbps,1000);
 const left=hardwarePrimitives({kind:"fortinet-final-rj45-left",x:0,y:0,width:20,height:30}).filter(p=>p.fill==="#ccb777"),right=hardwarePrimitives({kind:"fortinet-final-rj45-right",x:0,y:0,width:20,height:30}).filter(p=>p.fill==="#ccb777");assert.equal(left.length,8);assert.equal(right.length,8);assert.ok(left.every(p=>p.x>10));assert.ok(right.every(p=>p.x<10));
});

test("portrait captions reserve readable gutters for long saved labels without affecting sockets",()=>{
 for(const width of [460,690]){const d=deviceFor(models[1],true),original=sceneFor(d,"front",width);for(const p of d.ports)p.label="Very long customer interface description";const before=structuredClone(d),s=sceneFor(d,"front",width);assert.deepEqual(s.ports.map(p=>[p.x,p.y,p.width,p.height]),original.ports.map(p=>[p.x,p.y,p.width,p.height]));for(const p of s.ports){assert.equal(p.labelPlacement.hidden,undefined);assert.ok(p.labelPlacement.boxMaxWidth>=20);assert.equal(p.labelPlacement.fontSize,5.5);}assert.deepEqual(d,before);}
});
