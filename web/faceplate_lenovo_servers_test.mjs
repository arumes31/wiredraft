import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {lenovoServerProfiles} from "./static/js/catalog-lenovo-servers.js";
import {instantiateProfile,hardwareCatalog,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveLenovoServerFaceplate} from "./static/js/faceplate-lenovo-servers-models.js";
import {resolveModelFaceplate} from "./static/js/faceplate-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

test("server source notes retain UTF-8 page ranges and the ambient temperature", () => {
  const bytes = readFileSync(new URL("./static/js/catalog-lenovo-servers.js", import.meta.url));
  assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const profiles = lenovoServerProfiles.map(c => resolveLenovoServerFaceplate(deviceFor(c)));
  assert.ok(profiles[0].sourcePage.includes("83\u201385"));
  assert.ok(profiles[1].sourcePage.includes("91\u201393"));
  assert.ok(profiles[1].note.includes("30\u00b0C"));
  assert.ok(profiles[2].sourcePage.includes("20\u201321"));
  assert.ok(profiles[2].sourcePage.includes("26\u201327"));
});

/** Create a complete saved record with user-defined identities independently of port geometry. */
function deviceFor(c){const d=instantiateProfile(c,"User server",{x:47,y:81});d.id="saved-server";d.rackId="rack-id";d.rackPosition=11;for(const p of d.ports){p.id=`port-${p.portIndex}`;p.deviceId=d.id;}return d;}
/** Exclude edge contact while detecting positive-area hardware/caption collisions. */
function overlaps(a,b){return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}
/** Determine whether a source container fully encloses its associated socket. */
function contains(a,b){return b.x>=a.x-.001&&b.y>=a.y-.001&&b.x+b.width<=a.x+a.width+.001&&b.y+b.height<=a.y+a.height+.001;}
/** Convert actual primitive shapes into envelope points for regression testing. */
function points(p){if(p.kind==="rect")return [[p.x,p.y],[p.x+p.width,p.y+p.height]];if(p.kind==="circle")return [[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]];if(p.kind==="polygon")return p.points;if(p.kind==="line")return [[p.x1,p.y1],[p.x2,p.y2]];if(p.kind==="text"){const w=p.text.length*p.fontSize*.62;return [[p.x-w/2,p.y-p.fontSize/2],[p.x+w/2,p.y+p.fontSize/2]];}return [];}

for(const c of lenovoServerProfiles){
 test(`${c.model} integrates seven valid sockets and an explicitly selected source population`,()=>{
  const row=hardwareCatalog.find(p=>p.vendor===c.vendor&&p.model===c.model);assert.ok(row);const d=deviceFor(row),p=resolveLenovoServerFaceplate(d);assert.equal(resolveModelFaceplate(d),p);assert.deepEqual(d.ports.map(p=>[p.portIndex,p.label,p.type]),[[1,"NIC1","RJ45_1G"],[2,"NIC2","RJ45_1G"],[3,"NIC3","RJ45_1G"],[4,"NIC4","RJ45_1G"],[5,c.vendor==="IBM"?"IMM":"XCC","RJ45_1G"],[6,"AC-L","Power"],[7,"AC-R","Power"]]);assert.equal(d.faceplate.inventoryRevision,1);assert.equal(p.faces.front.ports.length,0);assert.equal(p.faces.rear.ports.length,7);assert.deepEqual(p.evidence.models,[c.model]);assert.equal(p.sku,c.sku);const scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:c.units*100},{face:"rear"});for(const power of scene.ports.filter(p=>p.port.type==="Power")){assert.equal(power.connectorKind,"lenovo-server-c14");const art=hardwarePrimitives({...power,kind:power.connectorKind});assert.equal(art.filter(p=>p.kind==="polygon").length,1);assert.equal(art.filter(p=>p.kind==="rect"&&p.fill==="#c1c9cc").length,3);assert.ok(art.every(p=>p.kind!=="text"));}assert.equal(p.faces.front.components.filter(a=>a.kind==="drive-bay").length,c.model.endsWith("V2")?12:8);assert.equal(p.faces.rear.components.filter(a=>a.variant==="lenovo-server-psu").length,2);assert.equal(p.faces.rear.components.filter(a=>a.kind==="fan").length,0);assert.ok(Object.values(p.faces).every(f=>f.components.every(a=>a.active===false)));
 });
 test(`${c.model} preserves every incoming endpoint field and cable through sparse and unknown inventories`,()=>{
  const d=deviceFor(c);d.ports.reverse();for(const p of d.ports)Object.assign(p,{label:`edited ${p.portIndex}`,speedMbps:123,mode:"Trunk",nativeVlan:41,allowedVlans:[41,93],isPoe:true,group:"custom"});
  const state={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"remote",toPortId:`other-${p.id}`,color:"#aabbcc",points:[{x:3,y:19}]}))},before=structuredClone(state);
  assert.equal(upgradeInstalledPhysicalPorts(state),false);const s=buildFaceplateScene(d,{x:0,y:0,width:690,height:c.units*100},{face:"rear"});assert.equal(s.ports.length,7);assert.deepEqual(state,before);assert.ok(s.ports.every(p=>p.displayLabel.startsWith("edited")));
  d.ports=d.ports.filter(p=>[1,3,5,7].includes(p.portIndex));d.ports.find(p=>p.portIndex===3).type="SFP_PLUS_10G";const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:c.units*100},{face:"rear"});assert.deepEqual(sparse.ports.map(p=>p.port.portIndex).sort((a,b)=>a-b),[1,5,7]);assert.equal(sparse.unmappedPorts.length,1);assert.equal(sparse.components.filter(p=>p.ancillarySocket).length,4);
  for(const rev of [undefined,0,99,-1,1.5,"1"]){if(rev===undefined)delete d.faceplate.inventoryRevision;else d.faceplate.inventoryRevision=rev;const prior=structuredClone(d),scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:c.units*100},{face:"rear"});assert.equal(scene.ports.length,0);assert.equal(scene.unmappedPorts.length,4);assert.equal(scene.components.filter(p=>p.ancillarySocket).length,7);assert.deepEqual(d,prior);}
 });
 test(`${c.model} fits source dimensions, hardware and captions at native and saved allocations`,()=>{
  for(const width of [460,690])for(const units of [1,c.units,4])for(const sparse of [false,true])for(const face of ["front","rear"]){const d=deviceFor(c);d.faceplate.unitsU=units;if(sparse)d.ports=d.ports.filter(p=>[2,5,7].includes(p.portIndex));const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face}),definition=s.profile.evidence.physicalDimensions,scale=Math.min(1,units/c.units),physical=[...s.ports,...s.components.filter(p=>!p.applicationOverlay)];
   assert.equal(s.chassis.componentDrawn,true);assert.ok(Math.abs(s.chassis.height-690*definition.heightMm/482.6*scale)<1e-7);assert.ok(Math.abs(s.chassis.width-width*definition.widthMm/482.6*scale)<1e-7);
   for(const p of physical)assert.ok(contains(s.chassis,p),`${c.model} ${p.role||p.displayLabel} bounds`);
   for(const p of s.ports){for(const q of physical)if(q!==p&&!(q.hardwareLayer==="chassis-container"&&contains(q,p)))assert.ok(!overlaps(p,q),`${c.model} ${p.displayLabel} overlaps ${q.role||q.displayLabel}`);
    const a=p.labelPlacement;if(a.hidden)continue;const w=Math.min(a.boxMaxWidth,Math.max(12,Math.min(a.maxWidth,p.displayLabel.length*a.fontSize)+6)),label={x:a.x-w/2,y:a.y-a.boxHeight/2,width:w,height:a.boxHeight};assert.ok(contains(s.chassis,label),`${c.model} caption bounds`);for(const q of physical)if(q.role!=="body")assert.ok(!overlaps(label,q),`${c.model} caption ${p.displayLabel} overlaps ${q.role||q.displayLabel} at ${width}/${units}`);
   }
   if(sparse){const fresh=deviceFor(c);fresh.faceplate.unitsU=units;const t=buildFaceplateScene(fresh,{x:0,y:0,width,height:units*100},{face});for(const q of s.components.filter(p=>p.ancillarySocket)){const current=t.ports.find(p=>p.port.portIndex===q.physicalSlotIndex);assert.ok(current);for(const key of ["x","y","width","height"])assert.equal(q[key],current[key]);}}
  }
 });
 test(`${c.model} uses bounded real primitives in both current and unclaimed socket rendering`,()=>{
  for(const width of [460,690])for(const units of [1,c.units,4])for(const empty of [false,true])for(const face of ["front","rear"]){const d=deviceFor(c);d.faceplate.unitsU=units;if(empty)d.ports=[];const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});for(const component of [...s.components.filter(p=>!p.applicationOverlay),...s.ports.map(p=>({...p,kind:p.connectorKind}))]){const primitives=hardwarePrimitives(component);assert.ok(primitives.length,`${component.variant} has artwork`);for(const p of primitives)for(const [x,y] of points(p))assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${c.model} ${component.role||component.kind} ${p.kind} primitive bounds`);}}
 });
}

test("Lenovo server resolver is guarded by exact vendor/model/category and unknown names remain null",()=>{
 for(const model of ["constructor","toString","__proto__","ThinkSystem SR650 V3","srv650 v2"]){const d={category:"Server",model,faceplate:{vendor:"Lenovo",unitsU:2},ports:[]};assert.equal(resolveLenovoServerFaceplate(d),null);assert.equal(resolveModelFaceplate(d),null);}
 const d=deviceFor(lenovoServerProfiles[0]);d.faceplate.vendor="IBM";assert.equal(resolveLenovoServerFaceplate(d),null);d.faceplate.vendor="Lenovo";d.category="Switch";assert.equal(resolveLenovoServerFaceplate(d),null);
});
