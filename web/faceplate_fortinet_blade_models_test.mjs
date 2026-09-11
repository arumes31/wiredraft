import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveFortinetBladeFaceplate } from "./static/js/faceplate-fortinet-blade-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";
import { resolveFaceplateTemplate } from "./static/js/faceplate.js";

/** Construct a catalog blade without importing private source snapshots into the regression suite. */
function fixture(model,legacy=false) {
 let p=hardwareCatalog.find(p=>p.vendor==="Fortinet"&&p.model===model);
 if(legacy)p={...p,units:2,inventoryRevision:0,groups:[{zone:"access",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT",poe:false},{zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE",poe:false}]};
 const d=instantiateProfile(p,model,{x:0,y:0});d.id=model;
 d.ports.forEach(p=>{p.id=`${model}-${p.portIndex}`;p.deviceId=model;});return d;
}

/** Build an actual front or rear scene inside the unchanged stored rack allocation. */
function scene(device,width=460,face="front") {return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Detect positive-area overlap while allowing touching outlines. */
function overlaps(a,b) {return a.x<b.x+b.width-1e-8&&a.x+a.width>b.x+1e-8&&a.y<b.y+b.height-1e-8&&a.y+a.height>b.y+1e-8;}

/** Bound every Canvas/SVG primitive, including its stroke, to catch protruding handles and pins. */
function primitiveBounds(p) {
 const s=p.stroke?(p.strokeWidth||0)/2:0;
 if(p.kind==="circle")return[p.cx-p.r-s,p.cy-p.r-s,p.cx+p.r+s,p.cy+p.r+s];
 if(p.kind==="line")return[Math.min(p.x1,p.x2)-s,Math.min(p.y1,p.y2)-s,Math.max(p.x1,p.x2)+s,Math.max(p.y1,p.y2)+s];
 if(p.kind==="polygon")return[Math.min(...p.points.map(v=>v[0]))-s,Math.min(...p.points.map(v=>v[1]))-s,Math.max(...p.points.map(v=>v[0]))+s,Math.max(...p.points.map(v=>v[1]))+s];
 if(p.kind==="text")return[p.x-p.text.length*p.fontSize*.31,p.y-p.fontSize/2,p.x+p.text.length*p.fontSize*.31,p.y+p.fontSize/2];
 return[p.x-s,p.y-s,p.x+p.width+s,p.y+p.height+s];
}

test("both exact blades resolve their documented FG-5060 carrier population",()=>{
 for(const model of ["FortiGate 5001E","FortiGate 5001E1"]) {
  const device=fixture(model),profile=resolveFortinetBladeFaceplate(device);
  assert.equal(device.ports.length,7);assert.equal(profile.fidelity,"model");assert.equal(profile.selectedCarrier,"FG-5060");
  assert.deepEqual(profile.legacyLayouts[0].portIndexMap,{1:1,2:2,3:7});
 }
});

for(const model of ["FortiGate 5001E","FortiGate 5001E1"]) {
 test(`${model} exact blade endpoints and covered carrier populations match the guide`,()=>{
  const device=fixture(model),front=scene(device),rear=scene(device,690,"rear");
  assert.equal(device.faceplate.unitsU,5);assert.deepEqual(device.ports.map(p=>[p.portIndex,p.type,p.label]),[
   [1,"RJ45_1G","MGMT1"],[2,"RJ45_1G","MGMT2"],[3,"QSFP_PLUS_40G","1"],[4,"QSFP_PLUS_40G","2"],[5,"SFP_PLUS_10G","3"],[6,"SFP_PLUS_10G","4"],[7,"Console","CONSOLE"]]);
  assert.equal(front.ports.length,7);assert.equal(rear.ports.length,0);assert.equal(front.profile.selectedSlot,3);
  assert.deepEqual(front.profile.evidence.models,[model]);assert.equal(front.profile.sku,model.replace("FortiGate ","FG-"));
  assert.equal(front.components.filter(p=>p.role?.startsWith("front-blank-")).length,5);assert.equal(rear.components.filter(p=>p.role?.startsWith("rear-rtm-blank-")).length,6);
  assert.deepEqual(front.components.filter(p=>p.kind==="fan").map(p=>[p.internalFans,p.airflow]),[[6,"right-to-left"],[6,"right-to-left"]]);
  assert.equal(rear.components.filter(p=>p.kind==="fan").length,0);
  assert.deepEqual(rear.components.filter(p=>p.kind==="psu").map(p=>[p.role,p.powerType,p.branches]),[["pem-B","DC",2],["pem-A","DC",2]]);
  assert.equal(front.components.filter(p=>p.role==="primary-shelf-manager").length,1);assert.equal(front.components.filter(p=>p.role==="secondary-shelf-manager-cover").length,1);
  assert.equal(front.profile.evidence.configuration.includes("480 GB SSD"),model.endsWith("E1"));
  assert.ok(front.profile.faces.front.ports.filter(p=>[1,2,7].includes(p.portIndex)).every(p=>p.connectorKind==="rj45-inverted"));
 });
 test(`${model} actual438 endpoints, settings and cables survive revised geometry`,()=>{
  const old=fixture(model,true);assert.equal(old.faceplate.unitsU,2);
  assert.deepEqual(old.ports.map(p=>[p.portIndex,p.type,p.label]),[[1,"RJ45_1G","MGMT1"],[2,"RJ45_1G","MGMT2"],[3,"Console","CONSOLE"]]);
  old.ports.reverse();old.rackId="retained";old.rackPosition=17;
  old.ports.forEach(p=>{p.label=`Custom retained ${p.portIndex}`;p.speedMbps=1500;p.isPoe=true;p.nativeVlan=39;p.allowedVlans=[39,71];});
  const topology={devices:[old],links:[{sourceDeviceId:old.id,sourcePortId:old.ports[0].id,targetDeviceId:"peer",targetPortId:"port"}]},before=structuredClone(topology);
  const front=scene(old),rear=scene(old,690,"rear");assert.equal(front.ports.length,3);assert.equal(front.unmappedPorts.length,0);assert.equal(rear.ports.length,0);
  assert.equal(front.components.filter(p=>p.ancillarySocket).length,4);assert.equal(upgradeInstalledPhysicalPorts(old),false);assert.deepEqual(topology,before);
  for(const revision of [0,1]){const sparse=fixture(model,revision===0);sparse.ports=sparse.ports.filter(p=>p.portIndex===1);const snapshot=structuredClone(sparse);assert.equal(scene(sparse).ports.length,1);assert.equal(scene(sparse).components.filter(p=>p.ancillarySocket).length,6);assert.equal(upgradeInstalledPhysicalPorts(sparse),false);assert.deepEqual(sparse,snapshot);}
 });
 test(`${model} unknown, duplicated, empty and type-edited records never claim unsupported identities`,()=>{
  const wrong=fixture(model,true);wrong.ports[0].type="RJ45_10G";assert.equal(scene(wrong).ports.length,2);assert.equal(scene(wrong).unmappedPorts.length,1);
  const duplicate=fixture(model,true);duplicate.ports.push({...duplicate.ports[0],id:"duplicate"});assert.equal(scene(duplicate).ports.length,3);assert.equal(scene(duplicate).unmappedPorts.length,1);
  const unknown=fixture(model,true);unknown.faceplate.inventoryRevision=45;assert.equal(scene(unknown).ports.length,0);assert.equal(scene(unknown).unmappedPorts.length,3);assert.equal(scene(unknown).components.filter(p=>p.ancillarySocket).length,7);
  for(const revision of [0,1,45]){const empty=fixture(model);empty.faceplate.inventoryRevision=revision;empty.ports=[];assert.equal(scene(empty).ports.length,0);assert.equal(scene(empty).components.filter(p=>p.ancillarySocket).length,7);}
 });
 test(`${model} native690 aspect and proportional saved allocation remain explicit`,()=>{
  const native=fixture(model),old=fixture(model,true),larger=structuredClone(native);larger.faceplate.unitsU=7;
  assert.ok(Math.abs(scene(native,690).chassis.height/scene(native,690).chassis.width-222/432)<1e-9);
  for(const width of [460,690]) {
   const a=scene(native,width),b=scene(old,width);assert.deepEqual(a.chassis,scene(larger,width).chassis);
   assert.ok(Math.abs(a.chassis.height/a.chassis.width-b.chassis.height/b.chassis.width)<1e-9);assert.ok(b.chassis.y+b.chassis.height<=200);
   assert.ok(b.ports.every(p=>p.labelPlacement.hidden));assert.ok(a.ports.every(p=>!p.labelPlacement.hidden));
  }
  assert.equal(old.faceplate.unitsU,2);assert.equal(native.faceplate.unitsU,5);
 });
 test(`${model} ports and visible captions clear every carrier assembly at both widths`,()=>{
  for(const width of [460,690])for(const legacy of [false,true])for(const custom of [false,true]) {
   const device=fixture(model,legacy);if(custom)device.ports.forEach(p=>p.label=`A long custom saved caption ${p.portIndex}`);
   const result=scene(device,width);
   for(const p of result.ports) {
    const l=p.labelPlacement;assert.ok([l.x,l.y,l.maxWidth,l.boxMaxWidth].every(Number.isFinite));
    const caption={x:l.x-l.boxMaxWidth/2,y:l.y-l.boxHeight/2,width:l.boxMaxWidth,height:l.boxHeight};
    for(const other of [...result.ports,...result.components]) {
     if(other!==p)assert.ok(!overlaps(p,other),`${model} socket ${p.port.portIndex}/${other.role||other.port?.portIndex}`);
     if(!l.hidden)assert.ok(!overlaps(caption,other),`${model} caption ${p.port.portIndex}/${other.role||other.port?.portIndex}`);
    }
   }
   for(const p of result.components.filter(p=>p.ancillarySocket))for(const c of result.components.filter(p=>!p.ancillarySocket))assert.ok(!overlaps(p,c),`${model} ancillary socket/${c.role}`);
  }
 });
 test(`${model} all primitive bounds and Canvas/SVG contracts pass460/6901x/2x`,()=>{
  for(const width of [460,690])for(const legacy of [false,true])for(const face of ["front","rear"])for(const scale of [1,2]) {
   const result=scene(fixture(model,legacy),width,face);
   for(const raw of [...result.components,...result.ports.map(p=>({...p,kind:p.connectorKind}))]) {
    const p={...raw,x:raw.x*scale,y:raw.y*scale,width:raw.width*scale,height:raw.height*scale},primitives=hardwarePrimitives(p);assert.ok(primitives.length>0);
    for(const item of primitives){assert.notEqual(item.fill,"none");const b=primitiveBounds(item);assert.ok(b.every(Number.isFinite));assert.ok(b[0]>=p.x-1e-7&&b[1]>=p.y-1e-7&&b[2]<=p.x+p.width+1e-7&&b[3]<=p.y+p.height+1e-7,`${model} ${width} ${legacy} ${raw.role||raw.kind} ${JSON.stringify(item)}`);}
    const calls=[],context=new Proxy({},{get:(_o,key)=>(...args)=>calls.push([key,...args]),set:()=>true});drawHardwareComponent(context,p);
    assert.deepEqual(calls.filter(c=>c[0]==="arc").map(c=>c.slice(1,4)),primitives.filter(i=>i.kind==="circle").map(i=>[i.cx,i.cy,i.r]));
    assert.equal((hardwareComponentSVG(p).match(/<polygon\b/g)||[]).length,primitives.filter(i=>i.kind==="polygon").length);
   }
  }
 });
}

test("manufacturer confirms identical external blade art, with E1 storage metadata only",()=>{
 const a=scene(fixture("FortiGate 5001E")),b=scene(fixture("FortiGate 5001E1"));
 assert.deepEqual(a.profile.faces.front.ports,b.profile.faces.front.ports);
 const parts=s=>s.components.filter(p=>p.role!=="blade-name"&&!p.applicationOverlay);assert.deepEqual(parts(a),parts(b));
 assert.equal(resolveFaceplateTemplate(fixture("FortiGate 5001E")).surface,"#252323");
 const d=fixture("FortiGate 5001E");d.model="FortiGate 5001D";assert.equal(resolveFortinetBladeFaceplate(d),null);d.model="FortiGate 5001E";d.faceplate.vendor="Cisco";assert.equal(resolveFortinetBladeFaceplate(d),null);
});

test("carrier services expose only sourced hardware and no blade endpoint identities",()=>{
 const front=scene(fixture("FortiGate 5001E")),manager=front.components.find(p=>p.role==="primary-shelf-manager"),sap=front.components.find(p=>p.role==="shelf-alarm-panel");
 assert.deepEqual(manager.exposedInterfaces,["ETH0"]);assert.deepEqual(sap.exposedInterfaces,["SERIAL1","SERIAL2","ALARM DB15 male"]);
 assert.ok([manager,sap].every(p=>p.carrierOnly&&!p.port&&!p.portIndex));
 assert.equal(hardwarePrimitives(sap).filter(p=>p.kind==="circle"&&p.fill==="#b2bebd").length,15);
 const nativeManager=scene(fixture("FortiGate 5001E"),690).components.find(p=>p.role==="primary-shelf-manager");
 const aperture=hardwarePrimitives(nativeManager).find(p=>p.kind==="rect"&&p.stroke==="#6a7a81");
 assert.ok(aperture.width/aperture.height>=.95&&aperture.width/aperture.height<=1.5,"source SM ETH0 is a landscape RJ45 aperture at the declared native reference");
});
