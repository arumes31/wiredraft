import {canonicalFaceplateDevice} from "./faceplate-profile.js";
import {resolveFortinetFaceplate} from "./faceplate-fortinet-models.js";

const selections={
 "FortiGate 6000F":{model:"FortiGate 6301F",sku:"FG-6301F",units:3,height:132,width:437,depth:665,guide:"6000F",pages:"PDF 8 front, 16 rear, 18 dimensions, 19-21 generation 2 PSU, 30 rails",configuration:"FortiGate 6301F generation 2 AC; six internal FPCs, two 1 TB log disks in RAID 1, three SP-FG4000F-PS 2000 W high-line supplies and three FG-6000F-FAN trays. Shipped four-post sliding rails fitted; shipped loose optics not installed."},
 "FortiGate 7000E":{model:"FortiGate 7060E",sku:"FG-7060E-8",units:8,height:352.7,width:440,depth:650,guide:"7060E",pages:"PDF 7 front, 10 rear, 15 dimensions, 19 C16 supply, 27 rack tray, 29 FIM-7920E; 7000E ordering table",configuration:"FortiGate 7060E FG-7060E-8 AC bundle with FIM-7920E-C selected at order; two FIM-7920E in slots 1/2, two FPM-7620E in 3/4, two SMMs, four 1500 W AC supplies in PWR 1-4, PWR 5/6 and card slots 5/6 covered, three dual-fan trays. Shipped four-post rack trays and front mounting brackets fitted; optional air filter/cable brackets omitted."},
 "FortiGate 7000F":{model:"FortiGate 7081F",sku:"FG-7081F",units:12,height:543.9,width:440,depth:675.5,guide:"7081F",pages:"PDF 8 front, 10 FIM-7921F, 11 FPM-7620F, 12 rear, 14 shipped population, 15 dimensions, 21 Saf-D-Grid PSU, 33 rack tray; datasheet 13 ordering",configuration:"FortiGate 7081F AC shipped base; one FIM-7921F in slot 1 with two 4 TB RAID 1 log disks, one FPM-7620F in slot 3, two SMMs, six FG7K-PS-2K5AC 2500 W supplies, six covered unused module slots and three triple-fan trays. Shipped four-post rack trays and front mounting brackets fitted; optional air filter/cable brackets omitted. No -2 FIM-7941F population."}
};
const cache=new Map();

/** Resolve only the three explicitly selected family aliases, preserving the supplied saved device object. */
export function resolveFortinetChassisAliasFaceplate(device){
 if(!device||!Object.hasOwn(selections,device.model)||device.category!=="Firewall"||device.faceplate?.vendor!=="Fortinet")return null;
 const s=selections[device.model];
 const units=Math.max(1,Number(device.faceplate.unitsU)||s.units),key=`${device.model}:${units}`;
 if(!cache.has(key))cache.set(key,build(device,s,units));return cache.get(key);
}

/** Clone the exact documented population, apply conservative alias mappings and fit its physical body. */
function build(device,s,units){
 const exact=canonicalFaceplateDevice({...device,model:s.model}).device;
 const profile=structuredClone(resolveFortinetFaceplate(exact));
 const scale=Math.min(1,units/s.units),body=690*s.height/482.6*scale,width=s.width/482.6*scale,raw=body<64?body/.8:body+16;
 profile.id=`fortinet-chassis-alias-${s.guide.toLowerCase()}`;profile.sku=s.sku;profile.family=device.model;
 profile.fidelity="model";profile.panelFidelity={front:"model",rear:"model"};profile.inventoryRevision=1;profile.inventoryComplete=true;profile.rearHardwareVerified=true;
 profile.sourcePage=s.pages;profile.evidence={...profile.evidence,scope:"model",models:[s.model],selectedModel:s.model,selectedSku:s.sku,catalogAlias:device.model,configuration:s.configuration,reviewed:"2026-09-11",front:profile.source,rear:profile.source,physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:482.6}};
 profile.note=s.configuration;profile.chassis={x:(1-width)/2,y:.1/units,width,height:raw/(units*100)};
 const management=exact.ports.filter(p=>/^SMM[12]-MGMT$/.test(p.group));
 profile.legacyLayouts=[{inventoryRevision:0,portIndexMap:s.guide==="6000F"?{...Object.fromEntries(Array.from({length:28},(_,n)=>[n+1,n+1])),31:29,32:30,34:34}:{1:management[0].portIndex,2:management[1].portIndex}}];
 profile.catalogDiscrepancies=[s.guide==="6000F"?"Original HA1/HA2 and MGMT3 copper placeholders cannot map to optical cages. Original MGMT1/2 indices 31/32 map to 29/30; first console 34 maps, surplus 35 remains unmapped.":"Original two management endpoints map to SMM1/2. Original two consoles cannot identify four SMM console sockets and remain unmapped."];
 profile.limitations=[s.configuration,...profile.limitations,
  "The family label represents only this explicit selected SKU and population. Exact source panel artwork is cloned without mutating the named-model profile. No transceivers, breakout or additional cards are installed.",
  "Physical dimensions control native body proportions. Every saved rack allocation and complete endpoint/cable record remains unchanged; unknown revisions and incompatible types remain unmapped. Physical unclaimed sockets are noninteractive artwork. 6000F captions hide below 80% native fit. 7000E/F use source-sized physical silk-screen text because the shared 7 px caption boxes do not fit native card clearances; stored names remain available.",
  "Power inlets remain verified ancillary hardware, consistently with the named-model inventory. All status lamps are inactive. 6000F generation 2 and 7060E use keyed C16; 7081F uses Anderson Saf-D-Grid 2006G1-NC-BK, not the C20 connector at the other cable end."];
 for(const face of Object.values(profile.faces)){
  for(const component of face.components){component.active=false;if(s.guide==="6000F"&&component.kind==="psu")component.variant="fortinet-chassis-alias-c16-gen2";}
  for(const port of face.ports){
   delete port.compatibleTypes;
   const a=port.descriptionAnchor,small=s.guide==="6000F";
   const nativeBody=690*s.height/482.6;
   port.descriptionAnchor={...a,x:port.x,y:port.portIndex===34&&small?.773:small&&port.y<.85?.7355:a.y,fontSize:5.5,boxHeight:7,boxWidth:Math.max(port.width,.043),hidden:scale<.8||!small};
   if(!small){const cy=s.guide==="7060E"?a.y-(a.y>port.y?1/nativeBody:0):port.y+(a.y>port.y?1:-1)*(port.height/2+3/nativeBody);face.components.push({kind:"text",variant:"fortinet-chassis-alias-legend",role:`port${port.portIndex}-legend`,text:port.physicalLabel,x:port.x-port.width/2,y:cy-2.5/nativeBody,width:port.width,height:5/nativeBody,fontSize:3.5,active:false});}
  }
 }
 return profile;
}
