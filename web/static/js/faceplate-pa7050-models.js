import {canonicalFaceplateDevice} from "./faceplate-profile.js";
const root="https://docs.paloaltonetworks.com/hardware/pa-7000-hardware-reference/";
const overview=`${root}pa-7000-series-firewall-overview/pa-7050-front-and-back-panel-descriptions/`;
const allocations=new Map();let profile;

/** Fit the source 9U chassis as a whole while preserving every saved rack allocation. */
export function resolvePA7050Faceplate(device) {
  if(device?.faceplate?.vendor!=="Palo Alto"||device.model!=="PA-7000 family")return null;
  if(!profile){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;profile=buildProfile(canonical.device);}
  const units=Math.max(1,Number(device.faceplate.unitsU)||9);
  if(!allocations.has(units)) {
    const body=690*15.75/19,scale=Math.min(1,(units*100*.94-16)/body),width=17.5/19*scale;
    const faces=scale<.7?Object.fromEntries(Object.entries(profile.faces).map(([face,panel])=>[face,{...panel,ports:panel.ports.map(p=>({...p,descriptionAnchor:{...p.descriptionAnchor,hidden:true}}))}])):profile.faces;
    allocations.set(units,{...profile,faces,chassis:{x:(1-width)/2,y:.055/units,width,height:(body*scale+16)/(units*100)}});
  }
  return allocations.get(units);
}

/** Record an explicitly valid historical card generation and its conservative revision map. */
function buildProfile(device) {
  const configuration="PA-7050 9U AC chassis: PA-7000-20GXM-NPC in slot1, first-generation PA-7050-SMC version1 in slot4, PA-7000-LPC in slot8 with four PA-7000-AMC-1TB drives, blank slots2/3/5/6/7, two original PA-7050-FAN trays, separate filter and four PA-7050-PWR25-AC supplies at208/240VAC. No air duct or second-generation cards.";
  return {id:"paloalto-pa7050-selected",sku:"PA-7050",family:"PA-7050",fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source:`${overview}pa-7050-front-panel-ac`,
    sourcePage:"Hardware reference p16/19/35/46/54/204/207/208; earlier Spanish guide p57/59",
    evidence:{scope:"model",models:["PA-7050"],selectedModel:"PA-7050",catalogAlias:device.model,configuration,front:`${overview}pa-7050-front-panel-ac`,rear:`${overview}pa-7050-back-panel-ac`,
      supplemental:["https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/hardware/pa-7000-series/pa-7000-hardware-reference.pdf","https://docs.paloaltonetworks.com/content/dam/techdocs/es_ES/pdf/hardware/pa-7000-series/pa-7000-hardware-reference-es-es.pdf"]},
    limitations:[configuration,"This is a historical first-generation SMC/LPC configuration, supported through PAN-OS10.1; 20GXM requires7.1 or later. The source chassis drawing places an older20G NPC in slot7; the selected20GXM uses its own low double-lever face in permitted slot1. Alternate chassis and card populations need separate layouts.",
      "Four front supplies each expose two fan grilles. Chassis fan impellers face sideways behind solid front service covers and are not drawn as front/rear rotors. Rear C20 inputs feed oppositely numbered front supplies. Tiny printing, grille density and latch details are simplified; all status lenses are inactive.",
      "Old copper1–12 retain matching dataplane numbers, MGMT1 index25 maps to29, and console27 maps to30. Unsupported copper13–16,25G optics17–24 and second management26 remain unmapped. No stored types, settings, labels, cables or rack allocations change.",
      "Native chassis aspect is matched at690 within the existing normalized-width contract. Below70% native body scale, captions are omitted while full labels remain available in hover, inspector and SVG metadata."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,i+1])),25:29,27:30},portLabels:{25:"MGMT1",26:"MGMT2",27:"CONSOLE"}}],
    faces:{front:frontPanel(device),rear:rearPanel(device)}};
}

/** Bind a physical opening to its immutable canonical endpoint and independent caption. */
function socket(device,index,x,y,width,height,kind,label,captionY,captionWidth=.035) {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,connectorKind:kind,
    descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Declare visible hardware without creating a network endpoint. */
function part(kind,x,y,width,height,role,variant,label) {return {kind,x,y,width,height,role,...(variant?{variant}:{}),...(label?{label}:{}),active:false};}

/** Keep module edges and release levers outside socket and caption reservations. */
function edges(parts,y,role,tall=false) {
  for(const edge of [y,y+.087])parts.push(part("module-bay",.070,edge,.806,.002,role,"pa7050-strip"));
  for(const x of [.073,.850])parts.push(part("handle",x,tall?y+.011:y+.069,.023,tall?.063:.014,`${role}-ejector`,tall?"pa7050-tall-ejector":"pa7050-low-ejector"));
}

/** Trace the selected network card, original SMC, four log drives and front power shelf. */
function frontPanel(device) {
  const ports=[],components=[part("module-bay",.070,.005,.806,.109,"brand-panel","pa7050-header","PA-7050")];
  for(const x of [.004,.886])components.push(part("module-bay",x,.008,.060,.889,"side-fan-tray","pa7050-fan-cover"));
  components.push(part("module-bay",.953,.008,.036,.889,"air-filter","pa7050-filter"));
  for(const [slot,y]of [[2,.219],[3,.315],[5,.515],[6,.611],[7,.707]])components.push(part("module-bay",.070,y,.806,.089,"blank-card","pa7050-blank",`SLOT${slot} COVER`));
  edges(components,.123,"npc");
  for(let i=0;i<12;i++)ports.push(socket(device,i+1,.289+Math.floor(i/2)*.033,i%2?.179:.150,.029,.021,i%2?"rj45":"rj45-inverted",String(i+1),i%2?.202:.132));
  for(let i=0;i<8;i++)ports.push(socket(device,i+13,.513+Math.floor(i/2)*.035,i%2?.179:.150,.031,.021,"sfp",String(i+13),i%2?.202:.132));
  for(let i=0;i<4;i++)ports.push(socket(device,i+21,.661+Math.floor(i/2)*.035,i%2?.179:.150,.031,.021,"sfp",String(i+21),i%2?.202:.132));
  for(let i=0;i<4;i++)components.push(part("led",.791,.142+i*.015,.006,.006,"npc-status"));
  edges(components,.413,"smc",true);
  for(const [index,x,label]of [[27,.303,"HA1-A"],[28,.366,"HA1-B"],[29,.427,"MGT"]])ports.push(socket(device,index,x,.468,.029,.027,"rj45-inverted",label,.434,.059));
  ports.push(socket(device,30,.558,.458,.029,.027,"rj45","CON",.434,.06),socket(device,25,.628,.469,.045,.023,"qsfp","HSCI-A",.434,.065),socket(device,26,.698,.469,.045,.023,"qsfp","HSCI-B",.434,.065));
  components.push(part("usb",.748,.463,.028,.011,"storage-usb"));
  for(let i=0;i<8;i++)components.push(part("led",.800+i%2*.012,.438+Math.floor(i/2)*.012,.005,.005,"smc-status"));
  edges(components,.802,"lpc");
  for(let i=0;i<4;i++)components.push(part("drive",.104+i*.181,.811,.174,.065,"amc-drive","pa7050-amc",["A1","A2","B1","B2"][i]));
  for(let i=0;i<4;i++)components.push(part("psu",.010+i*.246,.908,.235,.083,"front-power-supply","pa7050-ac",`PSU${i+1}`));
  for(const x of [.246,.492,.738])components.push(part("button",x,.960,.007,.010,"esd-socket"));
  return {ports,components};
}

/** Trace rear AC4-to-AC1 C20 inputs, separate breakers, ground studs and the low ventilation strip. */
function rearPanel(device) {
  const ports=[],components=[part("module-bay",.109,.014,.096,.056,"ground-studs","pa7050-ground"),part("vent",.085,.864,.882,.048,"rear-grille","pa7050-mesh")];
  for(const y of [.103,.389,.682,.965])components.push(part("module-bay",.002,y,.996,.006,"rear-panel-seam","pa7050-strip"));
  for(let i=0;i<4;i++) {
    const x=.229+i*.179;ports.push(socket(device,34-i,x,.458,.104,.064,"pa7050-c20",`AC${4-i}`,.340,.1));
    components.push(part("button",x-.020,.521,.040,.078,"ac-breaker","pa7050-breaker"));
  }
  for(const y of [.087,.132,.369,.409,.666,.947,.988])for(const x of [.052,.370,.629,.946])components.push(part("screw",x,y,.007,.008,"rear-fastener"));
  return {ports,components};
}
