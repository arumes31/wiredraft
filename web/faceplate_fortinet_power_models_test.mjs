import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveModelFaceplate} from "./static/js/faceplate-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const cases=[
  ["FortiGate 3000F-ACDC",2,41,88.9/443,"AC"],
  ["FortiGate 3001F-ACDC",2,41,88.9/443,"AC"],
  ...["FortiGate 3960E","FortiGate 3960E-ACDC","FortiGate 3960E-DC","FortiGate 3980E","FortiGate 3980E-DC"].map(model=>[model,5,model.includes("3980")?29:25,222/437,model.endsWith("-DC")?"DC":"AC"]),
];

/** Reproduce the independently executed revision-1 checkpoint438 groups without private QA imports. */
function fixture(model,saved=false){
 const row=hardwareCatalog.find(p=>p.model===model),large=model.includes("39"),count=model.includes("3980")?10:6;
 const original={...row,units:large?3:2,inventoryRevision:1,groups:[
  {zone:"access",count:large?2:18,type:large?"RJ45_1G":"RJ45_10G",speed:large?1000:10000,prefix:large?"GE":"10GE",poe:false},
  {zone:"uplink",count:16,type:large?"SFP_PLUS_10G":"SFP28_25G",speed:large?10000:25000,prefix:large?"SFP+":"SFP28",poe:false},
  {zone:"uplink",count,type:"QSFP28_100G",speed:100000,prefix:"QSFP28",poe:false},
  {zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE",poe:false}]};
 const d=instantiateProfile(saved?original:row,"Saved chassis",{x:9,y:12});d.id="original";
 d.ports.forEach(p=>{p.id=`original-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Resolve either physical face at the allocated rack size without changing stored topology. */
function scene(d,face="front",width=690){return buildFaceplateScene(d,{x:0,y:0,width,height:d.faceplate.unitsU*100},{face});}

/** Detect occupied areas without treating touching edges as overlaps. */
function overlaps(a,b){return a.x<b.x+b.width-1e-8&&a.x+a.width>b.x+1e-8&&a.y<b.y+b.height-1e-8&&a.y+a.height>b.y+1e-8;}

/** Include stroke thickness when checking shared Canvas/SVG primitive bounds. */
function bounds(p){
 const h=p.stroke?(p.strokeWidth||0)/2:0;
 if(p.kind==="text")return [p.x-p.text.length*p.fontSize*.31,p.y-p.fontSize/2,p.x+p.text.length*p.fontSize*.31,p.y+p.fontSize/2];
 if(p.kind==="polygon")return [Math.min(...p.points.map(v=>v[0]))-h,Math.min(...p.points.map(v=>v[1]))-h,Math.max(...p.points.map(v=>v[0]))+h,Math.max(...p.points.map(v=>v[1]))+h];
 if(p.kind==="circle")return [p.cx-p.r-h,p.cy-p.r-h,p.cx+p.r+h,p.cy+p.r+h];
 if(p.kind==="line")return [Math.min(p.x1,p.x2)-h,Math.min(p.y1,p.y2)-h,Math.max(p.x1,p.x2)+h,Math.max(p.y1,p.y2)+h];
 return [p.x-h,p.y-h,p.x+p.width+h,p.y+p.height+h];
}

for(const [model,units,count,ratio,power] of cases){
 test(`${model} selects documented chassis height, endpoint population and power configuration`,()=>{
  const d=fixture(model),p=resolveModelFaceplate(d);assert.equal(d.faceplate.unitsU,units);assert.equal(d.ports.length,count);assert.equal(p.fidelity,"model");
  assert.equal(p.evidence?.selectedPower,power);assert.match(p.source,/fortinet/);
  assert.ok(Math.abs(scene(d).chassis.height/scene(d).chassis.width-ratio)<1e-8,"native height follows manufacturer dimensions");
  const supplies=p.faces.rear.components.filter(c=>c.role==="power-supply");assert.equal(supplies.length,model.includes("39")?3:2);
  assert.equal(p.faces.rear.components.filter(c=>c.role==="fan-tray").length,model.includes("39")?2:0);
  assert.ok(supplies.every(c=>c.powerType===power));assert.ok(scene(d).unmappedPorts.length===0);
  if(model.endsWith("-ACDC"))assert.match(p.limitations.join(" "),/selected AC/i,"ACDC alias must disclose selected AC population");
 });
 test(`${model} preserves every original record and original rack allocation`,()=>{
  for(const sparse of [false,true]){
   const d=fixture(model,true);assert.equal(d.ports.length,count);assert.equal(d.faceplate.unitsU,model.includes("39")?3:2);
   d.ports.reverse();if(sparse)d.ports=d.ports.filter((_,i)=>i%3===0);
   d.ports.forEach(p=>Object.assign(p,{label:"Customer <link> & carrier",speedMbps:100,nativeVlan:31,allowedVlans:[31,32]}));
   const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromPortId:p.id,toPortId:"peer"})),racks:[{id:"rack",units:42}]},before=structuredClone(topology);
   assert.equal(upgradeInstalledPhysicalPorts(topology),false);
   for(const width of [460,690]){
    const s=scene(d,"front",width);assert.equal(s.ports.length,d.ports.length);assert.equal(s.unmappedPorts.length,0);
    const n=scene(fixture(model),"front",width);assert.ok(Math.abs(s.chassis.height/s.chassis.width-n.chassis.height/n.chassis.width)<1e-8);
   }
   assert.deepEqual(topology,before);d.faceplate.inventoryRevision=99;assert.equal(scene(d).ports.length,0);
  }
 });
}

test("Fortinet source captions clear sockets and hardware in native and historical allocations",()=>{
 for(const [model] of cases)for(const saved of [false,true])for(const width of [460,690])for(const face of ["front","rear"]){
  const s=scene(fixture(model,saved),face,width);
  for(const p of s.ports){
   const l=p.labelPlacement;if(l.hidden)continue;
   const box={x:l.x-l.boxMaxWidth/2,y:l.y-l.boxHeight/2,width:l.boxMaxWidth,height:l.boxHeight};
   assert.ok(Object.values(box).every(Number.isFinite));
   for(const other of [...s.ports,...s.components])assert.ok(!overlaps(box,other),`${model} ${saved} ${width} caption${p.port.portIndex} overlaps ${other.role||other.kind||other.port?.portIndex}`);
  }
 }
});

test("numeric default labels never permit catalog refresh to rewrite edited speeds or refill sparse inventories",()=>{
 for(const [model] of cases)for(const sparse of [false,true]){
  const d=fixture(model,true);if(sparse)d.ports=d.ports.filter(p=>p.portIndex%2===1);
  for(const p of d.ports){p.speedMbps=100;p.group="User assignment";}
  const before=structuredClone(d);assert.equal(upgradeInstalledPhysicalPorts({devices:[d]}),false,model);assert.deepEqual(d,before);
  assert.equal(hardwareCatalog.find(p=>p.model===model).preserveInstalledPorts,true);
 }
});

test("Fortinet source hardware stays within its drawing bounds in both renderers",()=>{
 for(const [model] of cases)for(const saved of [false,true])for(const width of [460,690])for(const face of ["front","rear"]){
  const s=scene(fixture(model,saved),face,width);
  for(const c of s.components.filter(c=>c.variant?.startsWith("fortinet-power-"))){
   const primitives=hardwarePrimitives(c);assert.ok(primitives.length);assert.ok(primitives.every(p=>p.fill!=="none"));
   for(const p of primitives){const b=bounds(p);assert.ok(b.every(Number.isFinite));assert.ok(b[0]>=c.x-1e-6&&b[1]>=c.y-1e-6&&b[2]<=c.x+c.width+1e-6&&b[3]<=c.y+c.height+1e-6,`${model} ${saved} ${width} ${c.variant}: ${JSON.stringify(p)}`);}
  }
 }
});

test("3960 AC portrait inlet follows the source's right-facing central contact and left handle",()=>{
 const c={kind:"psu",variant:"fortinet-power-ac-portrait",x:0,y:0,width:100,height:150};
 const p=hardwarePrimitives(c),blades=p.filter(p=>p.kind==="rect"&&p.fill==="#c8d2d3");
 assert.equal(blades.length,3);assert.ok(blades[1].x>blades[0].x&&blades[1].x>blades[2].x);
 const handle=p.find(p=>p.kind==="rect"&&p.fill==="#2d393e");assert.ok(handle.x<blades[0].x);
});
