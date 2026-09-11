import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { lenovoStorageProfiles } from "./static/js/catalog-lenovo-storage.js";
import { resolveLenovoStorageFaceplate } from "./static/js/faceplate-lenovo-storage-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";
import { addLenovoStorageComponent } from "./static/js/hardware-lenovo-storage-components.js";

const cases=[["DE2000H","7Y71A001WW",14,24],["DE240S","7Y68A000WW",8,24],["D1212","4587EKU",8,12],["D1224","4587A31",8,24],["TS2900","3572-S7H",2,0]];

/** Construct a public catalog fixture with stable IDs and no private checkpoint dependency. */
function fixture(model) {
 const d=instantiateProfile(hardwareCatalog.find(p=>p.model===model&&["Lenovo","IBM"].includes(p.vendor)),model,{x:0,y:0});
 d.id=model;d.ports.forEach(p=>{p.id=`${model}-${p.portIndex}`;p.deviceId=model;});return d;
}

/** Build the exact physical scene at either supported review width and saved rack allocation. */
function scene(device,width=460,face="rear") {return buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face});}

/** Identify positive-area collisions without counting a shared boundary as overlap. */
function overlaps(a,b) {return a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&a.y<b.y+b.height-1e-7&&a.y+a.height>b.y+1e-7;}

/** Return stroke-inclusive bounds for every shared Canvas/SVG primitive. */
function bounds(p) {
 const s=p.stroke?(p.strokeWidth||0)/2:0;
 if(p.kind==="circle")return[p.cx-p.r-s,p.cy-p.r-s,p.cx+p.r+s,p.cy+p.r+s];
 if(p.kind==="line")return[Math.min(p.x1,p.x2)-s,Math.min(p.y1,p.y2)-s,Math.max(p.x1,p.x2)+s,Math.max(p.y1,p.y2)+s];
 if(p.kind==="polygon")return[Math.min(...p.points.map(v=>v[0]))-s,Math.min(...p.points.map(v=>v[1]))-s,Math.max(...p.points.map(v=>v[0]))+s,Math.max(...p.points.map(v=>v[1]))+s];
 if(p.kind==="text")return[p.x-p.text.length*p.fontSize*.31,p.y-p.fontSize/2,p.x+p.text.length*p.fontSize*.31,p.y+p.fontSize/2];
 return[p.x-s,p.y-s,p.x+p.width+s,p.y+p.height+s];
}

for(const [model,sku,total,drives]of cases) {
 test(`${model} selected SKU, connector identities and installed modules match manufacturer evidence`,()=>{
  const d=fixture(model),profile=resolveLenovoStorageFaceplate(d),front=scene(d,460,"front"),rear=scene(d);
  assert.equal(profile.sku,sku);assert.equal(profile.fidelity,"model");assert.equal(rear.profile.id,profile.id);assert.deepEqual(profile.evidence.models,[model]);
  assert.equal(d.faceplate.inventoryRevision,1);assert.equal(d.ports.length,total);assert.equal(front.ports.length,0);assert.equal(rear.ports.length,total);
  assert.equal(front.components.filter(p=>p.kind==="drive-carrier").length,drives);
  assert.equal(rear.components.filter(p=>p.kind==="psu").length,model==="TS2900"?1:2);
  assert.ok(d.ports.filter(p=>p.type.startsWith("SAS_")||p.type.startsWith("FC_")).every(p=>p.mode==="Unconfigured"&&p.nativeVlan===0));
  assert.ok(profile.faces.rear.ports.filter(p=>p.type.startsWith("SAS_")).every(p=>p.connectorKind.startsWith("sas-mini")));
  if(model==="DE2000H") {assert.equal(d.ports.filter(p=>p.type==="FC_SFP_16G").length,4);assert.equal(d.ports.filter(p=>p.type==="SAS_MINI_HD_12G").length,4);assert.equal(rear.components.filter(p=>p.role?.endsWith("HIC-cover")).length,2);assert.equal(rear.components.filter(p=>p.serviceOnly).length,4);}
  if(model==="DE240S")assert.equal(d.ports.filter(p=>p.type==="SAS_MINI_HD_12G").length,8);
  if(model==="D1212"||model==="D1224") {assert.equal(d.ports.filter(p=>p.type==="SAS_MINI_HD_12G").length,6);assert.equal(profile.faces.rear.ports.filter(p=>p.connectorKind==="sas-mini-hd-inverted").length,3);assert.equal(rear.components.filter(p=>p.serviceOnly).length,2);assert.equal(d.ports.at(-1).speedMbps,100);}
  if(model==="TS2900") {assert.equal(d.ports[0].type,"SAS_MINI_6G");assert.equal(front.components.find(p=>p.role==="closed-nine-position-magazine").cartridgePositions,9);assert.equal(front.components.find(p=>p.role==="operator-panel").buttons,4);}
 });
 test(`${model} sparse, reordered and edited current records retain IDs, settings, cables and allocation`,()=>{
  const d=fixture(model);d.ports.reverse();d.ports=d.ports.filter(p=>p.portIndex%2===0);d.faceplate.unitsU=3;d.rackId="saved";d.rackPosition=19;
  d.ports.forEach(p=>{p.label=`A deliberately long saved custom caption ${p.portIndex}`;p.speedMbps=99;p.nativeVlan=47;p.allowedVlans=[47,88];});
  const topology={devices:[d],links:[{id:"saved-link",sourceDeviceId:d.id,sourcePortId:d.ports[0].id,targetDeviceId:"peer",targetPortId:"peer-port"}]},before=structuredClone(topology);
  const s=scene(d);assert.equal(s.ports.length,d.ports.length);assert.equal(s.components.filter(p=>p.ancillarySocket).length,total-d.ports.length);assert.equal(upgradeInstalledPhysicalPorts(d),false);assert.deepEqual(topology,before);
  assert.ok(s.ports.every(p=>p.displayLabel===p.port.label));
 });
 test(`${model} unknown revisions, types, duplicates and empty inventories never invent logical endpoints`,()=>{
  for(const revision of [0,72]) {const d=fixture(model);d.faceplate.inventoryRevision=revision;const before=structuredClone(d),s=scene(d);assert.equal(s.ports.length,0);assert.equal(s.unmappedPorts.length,total);assert.equal(s.components.filter(p=>p.ancillarySocket).length,total);assert.deepEqual(d,before);}
  const d=fixture(model);d.ports[0].type="RJ45_10G";assert.equal(scene(d).ports.length,total-1);assert.equal(scene(d).unmappedPorts.length,1);
  const duplicate=fixture(model);duplicate.ports.push({...duplicate.ports[0],id:"extra"});assert.equal(scene(duplicate).ports.length,total);assert.equal(scene(duplicate).unmappedPorts.length,1);
  const empty=fixture(model);empty.ports=[];assert.equal(scene(empty).ports.length,0);assert.equal(scene(empty).components.filter(p=>p.ancillarySocket).length,total);
 });
 test(`${model} native and saved allocation ratios remain equivalent at460/690`,()=>{
  const d=fixture(model),small=structuredClone(d),large=structuredClone(d);small.faceplate.unitsU=1;large.faceplate.unitsU=4;
  const dims=resolveLenovoStorageFaceplate(d).evidence.physicalDimensions,a=scene(d,690);
  assert.ok(Math.abs(a.chassis.height/a.chassis.width-dims.heightMm/dims.widthMm)<1e-9);
  for(const width of [460,690]) {const n=scene(d,width),s=scene(small,width),l=scene(large,width);assert.deepEqual(n.chassis,l.chassis);assert.ok(Math.abs(n.chassis.height/n.chassis.width-s.chassis.height/s.chassis.width)<1e-9);assert.ok(s.chassis.y+s.chassis.height<=100);}
 });
 test(`${model} sockets and captions clear non-container assemblies at both widths`,()=>{
  for(const width of [460,690])for(const custom of [false,true]) {
   const d=fixture(model);if(custom)d.ports.forEach(p=>p.label="Long saved custom label must stay intact");
   const s=scene(d,width),parts=s.components.filter(p=>p.hardwareLayer!=="chassis-container");
   for(const p of s.ports) {
    const l=p.labelPlacement,caption={x:l.x-l.boxMaxWidth/2,y:l.y-l.boxHeight/2,width:l.boxMaxWidth,height:l.boxHeight};
    for(const other of [...s.ports,...parts]) {if(other!==p)assert.ok(!overlaps(p,other),`${model} socket${p.port.portIndex}/${other.role||other.port?.portIndex}`);assert.ok(!overlaps(caption,other),`${model} caption${p.port.portIndex}/${other.role||other.port?.portIndex}`);}
   }
  }
 });
 test(`${model} physical primitives stay bounded and Canvas/SVG share geometry460/6901x/2x`,()=>{
  for(const width of [460,690])for(const face of ["front","rear"])for(const scale of [1,2])for(const small of [false,true]) {
   const device=fixture(model);if(small)device.faceplate.unitsU=1;
   const s=scene(device,width,face);
   for(const raw of [...s.components,...s.ports.map(p=>({...p,kind:p.connectorKind}))]) {
    const c={...raw,x:raw.x*scale,y:raw.y*scale,width:raw.width*scale,height:raw.height*scale},parts=hardwarePrimitives(c);assert.ok(parts.length>0);
    for(const p of parts) {assert.notEqual(p.fill,"none");if(p.kind==="text"&&raw.variant?.startsWith("lenovo-storage-"))assert.ok(p.fontSize>=5.5,"module identifiers use absolute pixel font sizes, not normalized fractions");const b=bounds(p);assert.ok(b.every(Number.isFinite));assert.ok(b[0]>=c.x-1e-7&&b[1]>=c.y-1e-7&&b[2]<=c.x+c.width+1e-7&&b[3]<=c.y+c.height+1e-7,`${model}/${width}/${raw.role||raw.kind} ${JSON.stringify(p)}`);}
    const calls=[],ctx=new Proxy({},{get:(_o,key)=>(...args)=>calls.push([key,...args]),set:()=>true});drawHardwareComponent(ctx,c);
    assert.deepEqual(calls.filter(v=>v[0]==="arc").map(v=>v.slice(1,4)),parts.filter(p=>p.kind==="circle").map(p=>[p.cx,p.cy,p.r]));
    assert.equal((hardwareComponentSVG(c).match(/<polygon\b/g)||[]).length,parts.filter(p=>p.kind==="polygon").length);
   }
  }
 });
}

test("only five exact names resolve; other vendor, category and model remain unsupported",()=>{
 assert.equal(lenovoStorageProfiles.length,5);const d=fixture("DE2000H");d.model="DE4000H";assert.equal(resolveLenovoStorageFaceplate(d),null);
 d.model="DE2000H";d.faceplate.vendor="IBM";assert.equal(resolveLenovoStorageFaceplate(d),null);d.faceplate.vendor="Lenovo";d.category="Switch";assert.equal(resolveLenovoStorageFaceplate(d),null);
 for(const model of ["constructor","__proto__","toString",null,undefined])assert.equal(resolveLenovoStorageFaceplate({...d,category:"Server",model}),null);
 for(const variant of [123,null,{},undefined])assert.equal(addLenovoStorageComponent({}, {variant}),false);
});
