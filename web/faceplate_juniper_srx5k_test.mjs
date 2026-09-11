import test from "node:test";
import assert from "node:assert/strict";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {resolveJuniperSRX5KFaceplate} from "./static/js/faceplate-juniper-srx5k-models.js";

// Independent literal fixtures verified against actual frozen438 execution; no QA snapshot dependency.
const historical={
  "SRX5400": {
    "id": "",
    "name": "saved SRX",
    "category": "Firewall",
    "model": "SRX5400",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 5,
      "totalPorts": 3,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#243b31",
      "hasSfpSlots": false,
      "vendor": "Juniper",
      "layout": "juniper",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "MGMT0",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "CONSOLE",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.31,
        "faceplateY": 0.25
      }
    ]
  },
  "SRX5600": {
    "id": "",
    "name": "saved SRX",
    "category": "Firewall",
    "model": "SRX5600",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 8,
      "totalPorts": 3,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#243b31",
      "hasSfpSlots": false,
      "vendor": "Juniper",
      "layout": "juniper",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "MGMT0",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "CONSOLE",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.31,
        "faceplateY": 0.25
      }
    ]
  },
  "SRX5800": {
    "id": "",
    "name": "saved SRX",
    "category": "Firewall",
    "model": "SRX5800",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 16,
      "totalPorts": 3,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#243b31",
      "hasSfpSlots": false,
      "vendor": "Juniper",
      "layout": "juniper",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "MGMT0",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "CONSOLE",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.31,
        "faceplateY": 0.25
      }
    ]
  }
};
const cases=[{model:"SRX5400",units:5,height:221.234,count:21,power:4,scbs:1},{model:"SRX5600",units:8,height:355.6,count:21,power:4,scbs:2},{model:"SRX5800",units:16,height:704.85,count:25,power:8,scbs:2}];

/** Assign saved identities and placement to the selected inventory or full independent original fixture. */
function deviceFor(c,old=false) {
 const d=old?structuredClone(historical[c.model]):instantiateProfile(hardwareCatalog.find(p=>p.vendor==="Juniper"&&p.model===c.model),"saved SRX",{x:23,y:29});
 d.id="saved-device";d.rackId="saved-rack";d.rackPosition=4;
 d.ports.forEach(p=>{p.id="saved-port-"+p.portIndex;p.deviceId=d.id;});return d;
}

/** Identify positive-area overlap while permitting touching component edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
 test(`${c.model} exposes only its selected IOC,SPC,RE and power inventory`,()=>{
  const d=deviceFor(c),p=resolveJuniperSRX5KFaceplate(d);assert.equal(d.ports.length,c.count);assert.equal(p.faces.front.ports.length,17);assert.equal(p.faces.rear.ports.length,c.power);
  assert.equal(d.ports.filter(p=>p.type==="QSFP_PLUS_40G").length,12);assert.equal(d.ports.filter(p=>p.type==="SFP_PLUS_10G").length,2);
  assert.equal(d.ports.filter(p=>p.type==="Console").length,2);assert.equal(d.ports.filter(p=>p.type==="RJ45_1G").length,1);
  assert.equal(d.faceplate.unitsU,c.units);assert.deepEqual(p.evidence.models,[c.model]);assert.equal(p.evidence.physicalDimensions.heightMm,c.height);
  assert.equal(p.faces.front.components.filter(p=>p.role.includes("reserved-sfp")).length,c.scbs*2);
  assert.equal(p.faces.front.components.filter(p=>p.role.includes("empty-re-cover")).length,c.scbs-1);
  assert.ok(Object.values(p.faces).every(f=>f.components.every(p=>p.active===false)));
 });
 test(`${c.model} preserves complete original records,cables and strict revision mappings`,()=>{
  for(const old of [false,true]){
   const d=deviceFor(c,old);if(old)delete d.faceplate.inventoryRevision;
   d.ports.reverse();d.ports.forEach(p=>Object.assign(p,{label:"custom "+p.portIndex,speedMbps:100,mode:"Trunk",nativeVlan:7,allowedVlans:[7,99],isPoe:true,group:"edited"}));
   const topology={devices:[d],links:d.ports.map(p=>({id:"cable-"+p.id,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:"remote-"+p.id,color:"#abcdef",label:"saved cable",points:[{x:2,y:8}]}))},before=structuredClone(topology);
   assert.equal(upgradeInstalledPhysicalPorts(topology),false);
   const scenes=["front","rear"].map(face=>buildFaceplateScene(d,{x:0,y:0,width:690,height:c.units*100},{face}));
   assert.equal(scenes.flatMap(s=>s.ports).length,old?2:c.count);assert.deepEqual(topology,before);
   if(old){assert.deepEqual(scenes.flatMap(s=>s.ports.map(p=>p.port.portIndex)).sort((a,b)=>a-b),[1,3]);assert.deepEqual(scenes[0].unmappedPorts.map(p=>p.portIndex),[2]);}
   d.ports=d.ports.filter(p=>[1,3,15,16,18].includes(p.portIndex));d.ports.find(p=>p.portIndex===1).type="USB_C_CONSOLE";
   const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:c.units*100},{face:"front"});assert.ok(sparse.unmappedPorts.some(p=>p.portIndex===1));
   d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:c.units*100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
  }
 });
 test(`${c.model} fits native and altered saved allocations with separate readable captions`,()=>{
  for(const width of [460,690])for(const units of [2,c.units,c.units+2])for(const old of [false,true])for(const face of ["front","rear"]){
   const d=deviceFor(c,old);d.faceplate.unitsU=units;const scene=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face}),fit=Math.min(1,units/c.units);
   assert.ok(Math.abs(scene.chassis.width-width*fit)<1e-7);assert.ok(Math.abs(scene.chassis.height-690*c.height/482.6*fit)<1e-7);
   const all=[...scene.ports,...scene.components.filter(p=>!p.applicationOverlay)];
   for(const p of all)assert.ok(p.x>=scene.chassis.x-1e-7&&p.y>=scene.chassis.y-1e-7&&p.x+p.width<=scene.chassis.x+scene.chassis.width+1e-7&&p.y+p.height<=scene.chassis.y+scene.chassis.height+1e-7,`${p.role||p.displayLabel} bounds`);
   for(const p of scene.ports){for(const q of all)if(q!==p)assert.ok(!overlap(p,q),`${c.model} ${p.displayLabel} overlaps ${q.role||q.displayLabel}`);
    const a=p.labelPlacement;assert.equal(a.hidden===true,fit<.8||(c.units===16&&face==="front"));if(a.hidden)continue;
    const w=Math.min(a.boxMaxWidth,Math.max(12,Math.min(a.maxWidth,p.displayLabel.length*a.fontSize)+6)),label={x:a.x-w/2,y:a.y-a.boxHeight/2,width:w,height:a.boxHeight};
    for(const q of all)assert.ok(!overlap(label,q),`${c.model} ${p.displayLabel} caption overlaps ${q.role||q.displayLabel} at${width}/${units}`);
   }
   if(old){const fresh=deviceFor(c);fresh.faceplate.unitsU=units;const current=buildFaceplateScene(fresh,{x:0,y:0,width,height:units*100},{face});const supplements=scene.components.filter(p=>p.ancillarySocket);assert.equal(supplements.length,current.ports.length-scene.ports.length);
    for(const a of supplements){const b=current.ports.find(p=>p.port.portIndex===a.physicalSlotIndex);assert.ok(b);for(const key of ["x","y","width","height"])assert.equal(a[key],b[key]);}}
  }
 });
}

test("SRX source artwork retains diagonal C20 blades,blue ejectors and internal-only fan rotors",()=>{
 for(const c of cases){const d=deviceFor(c),p=resolveJuniperSRX5KFaceplate(d);assert.equal(resolveFaceplateTemplate(d).id,"juniper-ex");
  assert.equal(p.faces.rear.components.filter(p=>p.kind==="fan").length,0);
  assert.equal(p.faces.front.components.filter(p=>p.role.endsWith("fan-tray")).length,c.units===16?2:0);
  for(const component of p.faces.front.components.filter(p=>p.role.endsWith("-ejector")))assert.ok(hardwarePrimitives({...component,x:0,y:0,width:20,height:20}).some(p=>p.fill==="#7bbad0"));
 }
 for(const kind of ["juniper-srx5k-c20","juniper-srx5k-c20-diagonal"]){const p=hardwarePrimitives({kind,x:0,y:0,width:46.23,height:39.28}),blades=p.filter(p=>p.fill==="#c9ced0");assert.equal(blades.length,3);assert.ok(blades.every(p=>p.kind===(kind.endsWith("diagonal")?"polygon":"rect")));}
});

test("All SRX primitive envelopes stay bounded on both renderers' shared input",()=>{
 for(const c of cases)for(const width of [460,690])for(const units of [2,c.units])for(const old of [false,true])for(const face of ["front","rear"]){
  const d=deviceFor(c,old);d.faceplate.unitsU=units;const scene=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
  for(const component of [...scene.components.filter(p=>!p.applicationOverlay),...scene.ports.map(p=>({...p,kind:p.connectorKind}))])for(const p of hardwarePrimitives(component)){
   const pts=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:[];
   for(const [x,y] of pts)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${c.model} ${component.role||component.kind} primitive bounds`);
  }
 }
});


test("SRX5800 rotated physical legends remain visible, bounded and separate from every socket",()=>{
 for(const width of [460,690])for(const old of [false,true]){
  const scene=buildFaceplateScene(deviceFor(cases[2],old),{x:0,y:0,width,height:1600},{face:"front"});
  const legends=scene.components.filter(c=>c.variant==="juniper-srx5k-legend-v");assert.equal(legends.length,17);
  assert.deepEqual(legends.map(c=>c.text),["HA0","HA1",...Array.from({length:12},(_,n)=>`${Math.floor(n/6)}/${n%6}`),"AUX","CON","MGMT"]);
  for(const legend of legends){const lines=hardwarePrimitives(legend);assert.ok(lines.length>=5);assert.ok(lines.every(p=>p.kind==="line"));for(const socket of [...scene.ports,...scene.components.filter(c=>c.ancillarySocket)])assert.ok(!overlap(legend,socket));}
 }
});
