import {canonicalFaceplateDevice} from "./faceplate-profile.js";
import {buildCiscoNexusModelFaceplate} from "./faceplate-cisco-nexus-models.js";
const models=["Nexus 7000 family","Nexus 9000 family"],cache=new Map();
const overview="https://www.cisco.com/c/en/us/td/docs/switches/datacenter/hw/nexus7000/installation/guide/cisco_nexus_7000_hardware_install/cisco_nexus_7000_hardware_install_chapter_01.html";
const supervisor="https://www.cisco.com/c/en/us/products/collateral/switches/nexus-7000-series-switches/data_sheet_c78-710881.html";
const linecard="https://www.cisco.com/c/en/us/products/collateral/switches/nexus-7000-series-switches/data_sheet_c78-720322.html";

/** Resolve only the two selected Nexus aliases and fit their bodies within unchanged saved rack allocations. */
export function resolveCiscoNexusFinalFaceplate(device){
  if(device?.faceplate?.vendor!=="Cisco"||!models.includes(device.model))return null;
  if(!cache.has(device.model)){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set(device.model,{profile:device.model===models[0]?profile7009(canonical.device):profile93180(canonical.device),allocations:new Map()});}
  const entry=cache.get(device.model),native=device.model===models[0]?14:1,units=Math.max(1,Number(device.faceplate.unitsU)||native);
  if(!entry.allocations.has(units)){
    const original=entry.profile.chassis,body=native*100*original.height-16,scale=Math.min(1,(units*100*.94-16)/body);
    const faces=native===14&&scale<.5?Object.fromEntries(Object.entries(entry.profile.faces).map(([face,panel])=>[face,{...panel,ports:panel.ports.map(slot=>({...slot,descriptionAnchor:{...slot.descriptionAnchor,hidden:true}}))}])):entry.profile.faces;
    entry.allocations.set(units,{...entry.profile,faces,chassis:{x:(1-original.width*scale)/2,y:original.y*Math.min(1,native/units),width:original.width*scale,height:(body*scale+16)/(units*100)}});
  }
  return entry.allocations.get(units);
}

/** Reuse the exact inspected93180 model while giving this historical alias its own immutable revision map. */
function profile93180(device){
  const profile=structuredClone(buildCiscoNexusModelFaceplate({...device,model:"Nexus 93180YC-FX3"}));
  const width=17.3/17.5,body=width*690*1.72/17.3,sku="N9K-C93180YC-FX3";
  for(const [face,panel]of Object.entries(profile.faces))for(const slot of panel.ports){
    const service=face==="rear";slot.descriptionAnchor={x:service?.675:slot.x,y:service?(slot.portIndex===55?.13:.848):(slot.y<.5?.15:.83),fontSize:5.5,boxHeight:7,boxWidth:service?.035:slot.portIndex>48?.046:.03};
  }
  return {...profile,id:"cisco-nexus-9000-selected",sku,family:sku,panelFidelity:{front:"model",rear:"model"},rearHardwareVerified:true,
    evidence:{...profile.evidence,models:[sku],catalogAlias:device.model,selectedModel:sku},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:54},(_,i)=>[i+1,i+1])),55:56,56:55},portLabels:{55:"MGMT",56:"CONSOLE"}}],
    catalogDiscrepancies:["The historical2U alias has MGMT55 and Console56. The selected exact SKU has Console55 and MGMT56. Explicit revision-zero maps preserve both identities and all54data ports.","Timing SMB/SMA, unsupported ToD and storage USB are noninteractive hardware; saved devices acquire no additional endpoints."],
    limitations:[profile.evidence.configuration,"This alias selects only the exact N9K-C93180YC-FX3 configuration already traced by the exact-model module. Alternate Nexus9000 chassis and airflow options require separate layouts.","Storage USB, unsupported ToD and timing fittings remain noninteractive. Fine manufacturer printing and fan grille details are simplified. Saved labels, types, speeds, settings, IDs, cables and allocations remain unchanged."],
    chassis:{x:(1-width)/2,y:.055,width,height:(body+16)/100}};
}

/** Disclose the installed7009 population and retain only source-compatible historical endpoints. */
function profile7009(device){
  const sku="N7K-C7009",width=17.3/17.5,body=width*690*24.5/17.3;
  const configuration="N7K-C7009 14U with N7K-SUP2 in slot1, N7K-F248XP-25E in slot3, five N7K-C7009-FAB-2, N7K-C7009-FAN and two N7K-AC-6.0KW. Supervisor2 and I/O4–9 covered; no optional front door or air filter.";
  return {id:"cisco-nexus-7009-selected",sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source:overview,
    sourcePage:"Overview Figures2/3; supervisor datasheet Figure4; F2e fiber datasheet Figure1; specifications24.5×17.3in",
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,front:overview,rear:overview,supervisor,linecard},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,i+1])),55:49,56:50},portLabels:{55:"MGMT",56:"CONSOLE"}}],
    catalogDiscrepancies:["The old48SFP28 endpoints map to the selected48SFP+ cages without changing stored types/speeds. MGMT55→49 and Console56→50. OldQSFP49–54 have no selected socket and remain unmapped."],
    limitations:[configuration,"Only this explicit card/fabric/power population is represented. USB host/log/slot0 storage apertures remain noninteractive; no optical transceivers are invented.","The fan tray rear is a solid service cover with a handle; hidden side-facing impellers are not drawn as rear-facing fans. Tiny text, latch geometry and grille perforation density are simplified.","Saved device and port IDs, edited labels/types/settings, cables and allocated rack units are preserved, including unknown revisions and sparse or reordered arrays."],
    chassis:{x:(1-width)/2,y:.02,width,height:(body+16)/1400},faces:panels7009(device)};
}

/** Bind a measured physical socket to its canonical index and an independent bounded caption. */
function socket(device,index,x,y,width,height,label,captionY){
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:index<=48?.029:.055},...(index<=48?{compatibleTypes:["SFP28_25G"]}:{})};
}

/** Describe source-visible hardware independently of saved logical endpoints. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Draw narrow module edges and ejectors without covering the socket/caption reservation. */
function edges(parts,y,label,height=.058){
  parts.push(part("module-bay",.085,y,.84,.003,"nexus-final-strip",label),part("module-bay",.085,y+height,.84,.003,"nexus-final-strip"));
  for(const x of [.087,.903])parts.push(part("handle",x,y+.008,.017,.040,"nexus-final-ejector"));
}

/** Trace the7009 top supervisors, split linecard banks, central five fabrics and rear service cover. */
function panels7009(device){
  const ports=[],components=[part("module-bay",.04,.005,.92,.032,"nexus-final-hood","CISCO NEXUS7009")];
  edges(components,.052,"N7K-SUP2 · SLOT1");
  ports.push(socket(device,49,.255,.083,.029,.020,"MGMT",.104),socket(device,50,.208,.083,.029,.020,"CON",.104));
  for(let i=0;i<5;i++)components.push(part("led",.120+i*.013,.075,.004,.003));
  components.push(part("usb",.379,.071,.024,.007),part("usb",.379,.085,.024,.007),part("usb",.524,.077,.040,.012),part("usb",.574,.077,.040,.012),part("button",.64,.083,.005,.004));
  for(const [slot,y]of [[2,.115],[4,.260],[5,.324],[6,.578],[7,.642],[8,.706],[9,.770]])components.push(part("module-bay",.085,y,.84,.059,"nexus-final-blank",`SLOT${slot} COVER`));
  edges(components,.180,"N7K-F248XP-25E · SLOT3",.074);
  for(let i=0;i<48;i++){const col=Math.floor(i/2),x=.126+col*.0325+Math.floor(col/6)*.003;ports.push(socket(device,i+1,x,i%2?.229:.205,.028,.014,String(i+1),i%2?.246:.191));}
  for(const [i,x,y]of [[1,.105,.389],[2,.378,.389],[3,.651,.389],[4,.241,.482],[5,.514,.482]])components.push(part("module-bay",x,y,.251,.085,"nexus-final-fabric",`FAB${i}`));
  components.push(part("module-bay",.085,.850,.84,.134,"nexus-final-intake"));
  for(const x of [.032,.945])components.push(part("module-bay",x,.041,.023,.791,"nexus-final-cable-frame"));
  return {front:{ports,components},rear:{ports:[],components:[part("module-bay",.035,.015,.93,.794,"nexus-final-fan-cover","N7K-C7009-FAN"),
    part("psu",.035,.821,.46,.164,"nexus-final-6kw","PSU1"),part("psu",.505,.821,.46,.164,"nexus-final-6kw","PSU2")]}};
}
