import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const source="https://docs.netapp.com/us-en/ontap-systems/media/PDF/215-14512_2021-02_en-us_FAS8300orFAS8700_ISI.pdf";
const fanSource="https://docs.netapp.com/us-en/ontap-systems/fas8300/fan-swap-out.html";
const configuration="NetApp FAS8300 dual-controller 4U chassis, 2021 Ethernet mezzanine configuration: each controller has four25Gb SFP28 data ports e0e–e0h, two25Gb SFP28 HA ports e0a/e0b, two100Gb QSFP28 cluster ports e0c/e0d, four12Gb mini-SAS HD storage ports,1Gb e0M/BMC, RJ45 serial and micro-USB consoles. All five optional PCIe slots per controller are covered. Four matching1600W Platinum AC supplies and eight front fan modules are installed. Controller A is upper and B lower, both upright. The front service bezel is removed. This controller chassis contains no front data drives; external storage shelves are separate devices and are not included here.";
const profiles=new Map();

/** Select the documented FAS8300 configuration and retain physical proportions in historical rack allocations. */
export function resolveNetAppFaceplate(device) {
  if(device?.model!=="FAS family"||device.faceplate?.vendor!=="NetApp"||device.category!=="Server")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!profiles.has(canonical.catalog))profiles.set(canonical.catalog,{profile:buildProfile(canonical.device),allocations:new Map()});
  const c=profiles.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||4);if(units===4)return c.profile;
  if(!c.allocations.has(units)) {
    const scale=Math.min(1,units/4),body=(400*c.profile.chassis.height-16)*scale,rawHeight=body<64?body/.8:body+16;
    c.allocations.set(units,{...c.profile,chassis:{x:(1-scale)/2,y:.08*Math.min(1,4/units),width:scale,height:rawHeight/(units*100)}});
  }
  return c.allocations.get(units);
}

/** Record exact installed hardware and explicit revision mappings without modifying any saved device data. */
function buildProfile(device) {
  return {id:"netapp-fas8300-25gbe",family:"FAS8300",sku:"FAS8300",fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryRevision:1,inventoryComplete:true,defaultFace:"rear",rearHardwareVerified:true,source,sourcePage:"Installation pp1–3; FAS8300 fan and PSU replacement diagrams",
    evidence:{scope:"model",models:[device.model],sku:"FAS8300",configuration,reviewed:"2026-09-11",front:fanSource,rear:`${source}#page=2`,
      physicalDimensions:{heightMm:177.8,widthMm:447,depthMm:828.04,rackWidthMm:483},revision:"FAS8300 / 2021 Ethernet mezzanine / Platinum AC"},note:configuration,
    limitations:[configuration,"The family alias selects only this model and hardware population. Optional PCIe host adapters, FC mezzanines, DC or Titanium supplies and external drive shelves are outside this configuration.",
      "Mini-SAS HD storage sockets and USB-A service receptacles remain ancillary artwork because the editor has no matching SAS or ordinary USB endpoint type. No substitute Ethernet or Stack endpoints are invented.",
      "HA ports are dedicated to partner interconnect; cluster ports serve the cluster network. Front fan-module covers conceal the rotors. Only the PSU rotors visible in the official rear illustration are exposed.",
      "Saved IDs, complete cable references, edited names/types/speeds/settings and rack allocations remain unchanged. New HA, cluster and console sockets are appended only for new revision1 instances."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10},
      portLabels:{1:"DATA1",2:"DATA2",3:"DATA3",4:"DATA4",5:"DATA5",6:"DATA6",7:"DATA7",8:"DATA8",9:"MGMT1",10:"MGMT2"}}],
    catalogDiscrepancies:["Original1–8 map to A e0e–e0h then B e0e–e0h; original9/10 map to A/B e0M. Explicit revision0 maps no additional indices.","New11–14 are HA,15–18 cluster,19/20 RJ45 console and21/22 micro-USB console; no existing inventory is enlarged."],
    chassis:{x:0,y:.08,width:1,height:(690*177.8/483+16)/400},faces:{front:frontPanel(),rear:rearPanel(device)}};
}

/** Define a physically bounded ancillary part in normalized chassis coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind immutable physical socket indices separately from users' editable labels and connection identities. */
function socket(device,index,x,y,width,height,physicalLabel,captionX=x,captionY=y+.07) {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel,x,y,width,height,
    connectorKind:port.type==="USB_MICRO_CONSOLE"?"usb-micro":["Console","RJ45_1G"].includes(port.type)?"rj45":port.type==="QSFP28_100G"?"qsfp":"sfp",
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:.038}};
}

/** Trace eight opaque fan-module faces, their closed cam handles and release/status details from the bezel-removed service diagram. */
function frontPanel() {
  const components=[];
  for(let row=0;row<2;row++)for(let slot=0;slot<4;slot++)components.push(part("fan",.040+slot*.230,.047+row*.454,.218,.425,`fan-${slot+1}-${row+1}`,"fas8300-fan-module"));
  for(const x of [.014,.979])components.push(part("handle",x,.16,.012,.69,"rack-ear-handle"));
  return {components,ports:[]};
}

/** Trace both identically oriented controllers, five covered PCIe slots, onboard I/O and installed Ethernet mezzanines. */
function rearPanel(device) {
  const components=[],ports=[];
  for(let row=0;row<2;row++) {
    const dy=row*.5,node=row?"B":"A",role=node.toLowerCase();
    for(let n=0;n<2;n++)components.push(part("psu",.036+n*.169,.267+dy,.160,.205,`${role}-psu-${n+1}`,"fas8300-1600w-platinum"));
    for(const [n,x,y] of [[1,.112,.034],[2,.415,.034],[3,.415,.147],[4,.712,.034],[5,.712,.147]])
      components.push(part("module-bay",x,y+dy,.231,.101,`${role}-slot-${n}-cover`,"fas8300-slot-cover",{text:String(n)}));
    components.push(part("vent",.041,.039+dy,.055,.203,`${role}-left-grille`,"mesh"),part("vent",.372,.04+dy,.022,.217,`${role}-slot-grille`,"mesh"),
      part("vent",.653,.04+dy,.027,.204,`${role}-right-slot-grille`,"mesh"),part("vent",.381,.262+dy,.275,.022,`${role}-onboard-grille`,"mesh"),
      part("usb",.752,.348+dy,.012,.117,`${role}-usb-a`),part("handle",.015,.13+dy,.015,.326,`${role}-left-latch`),part("handle",.972,.13+dy,.015,.326,`${role}-right-latch`));
    for(let n=0;n<4;n++)components.push(part("module-bay",.392+n*.0235,.370+dy,.021,.068,`${role}-sas-0${String.fromCharCode(97+n)}`,"fas8300-sas"));
    for(let n=0;n<4;n++)ports.push(socket(device,1+row*4+n,.806+n*.037+(n>=2?.010:0),.401+dy,.033,.058,`${node} e0${String.fromCharCode(101+n)}`,undefined,.466+dy));
    ports.push(socket(device,9+row,.695,.396+dy,.028,.055,`${node} e0M`,.695,.466+dy));
    for(let n=0;n<2;n++)ports.push(socket(device,11+row*2+n,.520+n*.036,.401+dy,.032,.058,`${node} e0${String.fromCharCode(97+n)}`,undefined,.466+dy),
      socket(device,15+row*2+n,.604+n*.044,.401+dy,.038,.058,`${node} e0${String.fromCharCode(99+n)}`,undefined,.466+dy));
    ports.push(socket(device,19+row,.695,.318+dy,.028,.055,`${node} CON`,.742,.290+dy),
      socket(device,21+row,.729,.425+dy,.020,.024,`${node} USB`,.730,.466+dy));
  }
  return {components,ports};
}
