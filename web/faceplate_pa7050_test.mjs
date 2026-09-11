import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveModelFaceplate} from "./static/js/faceplate-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

/** Reproduce the original 438 constructor groups independently of the selected chassis inventory. */
function deviceFor(old=false) {
  const row=hardwareCatalog.find(p=>p.vendor==="Palo Alto"&&p.model==="PA-7000 family");
  const profile=old?{...row,units:2,inventoryRevision:0,groups:[
    {zone:"access",count:16,type:"RJ45_1G",speed:1000,prefix:"",poe:false},
    {zone:"uplink",count:8,type:"SFP28_25G",speed:25000,prefix:"SFP28",poe:false},
    {zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT",poe:false},
    {zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE",poe:false}]}:row;
  const d=instantiateProfile(profile,"Customer chassis",{x:9,y:12});d.id="saved";
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Resolve the physical scene using the existing rack allocation and rendering width. */
function sceneFor(d,face="front",width=690) {return buildFaceplateScene(d,{x:0,y:0,width,height:d.faceplate.unitsU*100},{face});}

/** Compare positive-area rectangles, allowing floating-point shared edges. */
function overlaps(a,b) {return a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&a.y<b.y+b.height-1e-7&&a.y+a.height>b.y+1e-7;}

test("PA-7000 selects valid PA-7050 first-generation cards and 34 physical sockets",()=>{
  const d=deviceFor(),p=resolveModelFaceplate(d);assert.equal(d.faceplate.unitsU,9);assert.equal(d.ports.length,34);
  assert.equal(p.evidence.selectedModel,"PA-7050");assert.equal(p.fidelity,"model");assert.equal(p.faces.front.ports.length,30);assert.equal(p.faces.rear.ports.length,4);
  assert.equal(d.ports.filter(p=>p.type==="RJ45_1G").length,15);assert.equal(d.ports.filter(p=>p.type==="SFP_1G").length,8);
  assert.equal(d.ports.filter(p=>p.type==="SFP_PLUS_10G").length,4);assert.equal(d.ports.filter(p=>p.type==="QSFP_PLUS_40G").length,2);
  assert.equal(p.faces.front.components.filter(c=>c.role==="blank-card").length,5);
  assert.equal(p.faces.front.components.filter(c=>c.role==="front-power-supply").length,4);
  assert.equal(p.faces.front.components.filter(c=>c.role==="amc-drive").length,4);
  assert.equal(p.faces.front.components.filter(c=>c.role==="side-fan-tray").length,2);
  assert.equal(p.faces.rear.components.filter(c=>c.kind==="fan").length,0);
  assert.deepEqual(p.faces.rear.ports.map(p=>p.physicalLabel),["AC4","AC3","AC2","AC1"]);
  assert.match(p.evidence.configuration,/slot1/);assert.match(p.evidence.configuration,/SMC.*slot4/);assert.match(p.evidence.configuration,/LPC.*slot8/);
});

test("PA-7050 preserves all actual old27 records and maps only12 data, management and console",()=>{
  for(const sparse of [false,true]) {
    const d=deviceFor(true);assert.equal(d.ports.length,27);assert.equal(d.faceplate.unitsU,2);
    assert.deepEqual(d.ports.slice(24).map(p=>[p.portIndex,p.type,p.label]),[[25,"RJ45_1G","MGMT1"],[26,"RJ45_1G","MGMT2"],[27,"Console","CONSOLE"]]);
    d.ports.reverse();d.ports.forEach(p=>Object.assign(p,{label:"Customer <uplink> & carrier",nativeVlan:31,speedMbps:100,allowedVlans:[31,32]}));
    if(sparse)d.ports=d.ports.filter(p=>[1,7,12,19,25,26,27].includes(p.portIndex));
    const topology={devices:[d],racks:[{id:"rack",units:42}],links:d.ports.map(p=>({id:`cable-${p.id}`,fromPortId:p.id,toPortId:"peer",points:[{x:1,y:2}],label:"Existing cable"}))},before=structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology),false);
    const s=sceneFor(d),supported=new Set([...Array.from({length:12},(_,i)=>i+1),25,27]);
    assert.deepEqual(s.ports.map(p=>p.port.portIndex),d.ports.filter(p=>supported.has(p.portIndex)).map(p=>p.portIndex));
    assert.equal(s.unmappedPorts.length,d.ports.filter(p=>!supported.has(p.portIndex)).length);
    assert.equal(s.components.filter(c=>c.ancillarySocket).length,30-s.ports.length);assert.deepEqual(topology,before);
    assert.ok(s.ports.every(p=>p.labelPlacement.hidden===true));assert.ok(s.ports.every(p=>p.displayLabel==="Customer <uplink> & carrier"));
    d.faceplate.inventoryRevision=99;assert.equal(sceneFor(d).ports.length,0);
  }
  const d=deviceFor();d.ports[0].type="SFP28_25G";assert.ok(sceneFor(d).unmappedPorts.some(p=>p.portIndex===1));
});

test("PA-7050 native proportions and captions fit original2U and larger allocations",()=>{
  for(const width of [460,690])for(const units of [2,4,9,12]) {
    const d=deviceFor();d.faceplate.unitsU=units;d.ports.forEach(p=>p.label="Long customer description");
    const native=sceneFor(deviceFor(),"front",width);
    for(const face of ["front","rear"]) {
      const s=sceneFor(d,face,width);assert.ok(Math.abs(s.chassis.height/s.chassis.width-native.chassis.height/native.chassis.width)<1e-8);
      for(const box of [...s.ports,...s.components.filter(c=>!c.applicationOverlay)])assert.ok(box.x>=s.chassis.x-1e-7&&box.y>=s.chassis.y-1e-7&&box.x+box.width<=s.chassis.x+s.chassis.width+1e-7&&box.y+box.height<=s.chassis.y+s.chassis.height+1e-7);
      const captions=[];
      for(const slot of s.ports) {
        const l=slot.labelPlacement;if(l.hidden)continue;
        const box={x:l.x-l.boxMaxWidth/2,y:l.y-l.boxHeight/2,width:l.boxMaxWidth,height:l.boxHeight};
        for(const other of [...captions,...s.ports,...s.components.filter(c=>!c.applicationOverlay&&c.kind!=="text")])assert.ok(!overlaps(box,other),`${width}/${units}/${face} caption${slot.port.portIndex} intersects ${other.role||other.port?.portIndex||"caption"}`);
        captions.push(box);
      }
    }
    if(width===690)assert.ok(Math.abs(native.chassis.height/native.chassis.width-15.75/17.5)<1e-8);
  }
});

test("PA-7050 rear C20 blades and front paired fan grilles match source hardware",()=>{
  const p=resolveModelFaceplate(deviceFor());
  assert.equal(p.faces.rear.ports.length,4);
  assert.equal(p.faces.front.components.filter(c=>c.role==="front-power-supply").length,4);
  const vent=p.faces.rear.components.find(c=>c.role==="rear-grille");
  const holes=hardwarePrimitives({...vent,x:0,y:0,width:500,height:30});
  assert.equal(new Set(holes.map(p=>Math.round(p.points.reduce((n,v)=>n+v[1],0)/p.points.length))).size,3);
  for(const slot of p.faces.rear.ports) {
    const parts=hardwarePrimitives({...slot,kind:slot.connectorKind,x:0,y:0,width:40,height:26});
    const blades=parts.filter(p=>p.fill==="#d0d6d8");assert.equal(blades.length,3);assert.ok(blades.every(p=>p.width>p.height));
  }
  for(const c of p.faces.front.components.filter(c=>c.role==="front-power-supply")) {
    const parts=hardwarePrimitives({...c,x:0,y:0,width:120,height:40});assert.equal(parts.filter(p=>p.kind==="circle"&&p.fill==="#24333a").length,2);
    assert.ok(parts.filter(p=>p.stroke==="#bdc7c9").every(p=>p.fill===undefined),"Guard outlines must not trigger Canvas fill with invalid CSS none");
  }
});

test("PA-7050 source rear inlet housings clear the panel fasteners at native and saved sizes",()=>{
 for(const width of [460,690])for(const old of [false,true]){
  const d=deviceFor(old),s=sceneFor(d,"rear",width);
  const sockets=[...s.ports,...s.components.filter(c=>c.ancillarySocket)];
  for(const socket of sockets)for(const screw of s.components.filter(c=>c.role==="rear-fastener"))assert.ok(!overlaps(socket,screw),`${width}/${old}: inlet overlaps rear fastener`);
 }
 const p=resolveModelFaceplate(deviceFor());
 assert.ok(p.faces.rear.ports.every(p=>p.height===.064),"Source rear illustration's inlet housing spans6.4% of body height");
});

/** Check real generated geometry, including stroke extents, for every new helper at both display scales. */
test("PA-7050 custom hardware stays within its source boxes at460/690 and1x/2x",()=>{
  let checked=0;
  for(const width of [460,690])for(const units of [2,9])for(const scale of [1,2])for(const face of ["front","rear"]) {
    const d=deviceFor();d.faceplate.unitsU=units;const s=sceneFor(d,face,width);
    for(const c of [...s.components,...s.ports.map(p=>({...p,kind:p.connectorKind}))].filter(c=>(c.variant||c.kind)?.startsWith("pa7050-"))) {
      const box={...c,x:c.x*scale,y:c.y*scale,width:c.width*scale,height:c.height*scale};
      for(const p of hardwarePrimitives(box)) {
        const points=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:[];
        const margin=p.stroke?(p.strokeWidth||0)/2:0;
        for(const [x,y]of points)assert.ok(x-margin>=box.x-1e-7&&x+margin<=box.x+box.width+1e-7&&y-margin>=box.y-1e-7&&y+margin<=box.y+box.height+1e-7,`${width}/${units}/${face} ${c.variant||c.kind} ${p.kind} bounds`);
        checked++;
      }
    }
  }
  assert.ok(checked>100);
});
