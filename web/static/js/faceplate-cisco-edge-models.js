import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const wlcModel="Catalyst 9800-L WLC",isrModel="ISR 1100 family",cache=new Map();
const wlcSource="https://www.cisco.com/c/en/us/td/docs/wireless/controller/9800/9800-L/installation-guide/b-wlc-ig-9800-L/overview.pdf";
const isrSource="https://www.cisco.com/c/en/us/td/docs/routers/access/1100/hardware/installation/guide/b-cisco-1100-series-hig/isr1k-hig-overview.pdf";
const isrPhoto="https://www.cisco.com/c/dam/en/us/products/collateral/routers/1000-series-integrated-services-routers-isr/datasheet-c78-739512.docx/_jcr_content/renditions/datasheet-c78-739512_14.png";

/** Fit the selected compact native chassis inside the actual saved allocation without mutating inventory. */
export function resolveCiscoEdgeFaceplate(device){
  if(device?.faceplate?.vendor!=="Cisco"||![wlcModel,isrModel].includes(device.model))return null;
  if(!cache.has(device.model)){
    const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
    cache.set(device.model,{profile:buildProfile(canonical.device),allocations:new Map()});
  }
  const entry=cache.get(device.model),units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!entry.allocations.has(units)){
    const native=entry.profile.chassis;
    entry.allocations.set(units,{...entry.profile,chassis:{...native,y:native.y/units,height:native.height/units}});
  }
  return entry.allocations.get(units);
}

/** Disclose exact source configurations, physical populations and immutable historical index mappings. */
function buildProfile(device){
  const wlc=device.model===wlcModel,sku=wlc?"C9800-L-F-K9":"C1111X-8P",source=wlc?wlcSource:isrSource;
  const configuration=wlc?"C9800-L-F-K9 fiber controller with external C9800-AC-110W; four2.5G copper, two10G SFP+, SP/RP and RJ45/Micro-B consoles."
    :"C1111X-8P with8GB memory and external PWR-66W-AC-V2; eight1G LAN, two1G copper WAN and one alternate-media1G SFP, RJ45/Micro-B consoles. PoE/LTE/WLAN/DSL options absent.";
  const width=(wlc?8.5:12.7)/17.5,body=width*690*(wlc?1.58/8.5:1.75/12.7);
  const portIndexMap=wlc?{1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:10}:{1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:11,14:13};
  return {id:`cisco-edge-${sku.toLowerCase()}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryComplete:true,inventoryRevision:1,rearHardwareVerified:true,defaultFace:wlc?"front":"rear",source,
    sourcePage:wlc?"Overview Figure2 page1, front callouts page3, rear Figure4 page5; datasheet physical dimensions":"Overview bezel Figure1 page5, family I/O Figure2 page6; exact C1111X-8P datasheet photo Figure14",
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,
      front:`${source}#page=${wlc?1:5}`,rear:wlc?`${source}#page=5`:isrPhoto,
      supplemental:wlc?"https://www.cisco.com/c/en/us/products/collateral/wireless/catalyst-9800-series-wireless-controllers/datasheet-c78-742434.html":"https://www.cisco.com/c/en/us/products/collateral/routers/1000-series-integrated-services-routers-isr/datasheet-c78-739512.html"},
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:wlc?{7:"MGMT",8:"CONSOLE"}:{14:"CONSOLE"}}],
    catalogDiscrepancies:[wlc?"Historical1–7 retain positions; old USB-C8 maps Micro-B10 without changing type. RP8 and RJ45 console9 are fresh inventory only. Historical1G copper remains saved despite2.5G capable sockets."
      :"Historical LAN1–8 retain cages; old SFP+9 maps SFP11; USB-C14 maps Micro-B13. Old optical10/11/12 and management13 remain unmapped. Copper WAN9/10 and RJ45 console12 are fresh inventory only."],
    limitations:[configuration,"Saved endpoints, labels, types, speeds, VLANs, links and allocated rack units are unchanged. Sparse, reordered and unknown revisions are not synthesized.",
      wlc?"Fiber SKU only; copper9800-L-C and newer CW9800L require separate geometry. Datasheet1.58-inch body height is used; installation appendix lists1.73 inches. External power brick is outside the chassis."
        :"The base Ethernet SKU omits the LTE antennas, GPS, provisioning USB, SIM and DSL sockets shown in the generic family figure. GE0/0/0 copper/SFP share one interface; simultaneous activation is not enforced.",
      "RJ45 and Micro-B console sockets are alternatives. Small safety printing, circuit detail and perforation density are simplified."],
    chassis:{x:(1-width)/2,y:.055,width,height:(body+Math.min(16,body/4))/100},faces:wlc?wlcPanels(device):isrPanels(device)};
}

/** Bind a canonical socket and constrain edited descriptions to an explicit local region. */
function socket(device,index,x,y,width,height,physicalLabel,captionX,captionY,captionWidth,compatibleTypes=[]){
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel,x,y,width,height,
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth},
    ...(compatibleTypes.length?{compatibleTypes}:{}),...(port.type==="USB_MICRO_CONSOLE"?{connectorKind:"usb-micro",compatibleTypes:["USB_C_CONSOLE"]}:{})};
}

/** Define a decorative, bounded service or cooling element with no endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the fiber9800-L front L-shaped perforations, service stacks and rear six-pin DC input. */
function wlcPanels(device){
  const ports=[],components=[part("vent",.022,.09,.665,.23,"edge-wlc-vent"),part("vent",.022,.335,.15,.31,"edge-wlc-vent"),
    part("text",.917,.10,.074,.16,undefined,"CISCO"),part("usb",.693,.455,.024,.30),
    part("button",.107,.74,.016,.07),...Array.from({length:3},(_,i)=>part("led",.051+i*.030,.91,.009,.045))];
  for(let i=0;i<4;i++){const x=.235+i*.065;ports.push(socket(device,i+1,x,.647,.056,.30,String(i),x,.903,.061,["RJ45_1G"]));}
  for(let i=0;i<2;i++){const x=.534+i*.070;ports.push(socket(device,i+5,x,.672,.065,.24,String(i),x,.903,.065));}
  ports.push(socket(device,7,.867,.295,.056,.28,"SP",.954,.53,.07),socket(device,8,.867,.665,.056,.28,"RP",.954,.78,.07),
    socket(device,9,.768,.395,.056,.28,"CON",.768,.125,.068),socket(device,10,.768,.749,.032,.085,"USB",.768,.930,.065));
  return {front:{ports,components},rear:{ports:[],components:[part("module-bay",.009,.018,.982,.964,"edge-wlc-rear")]}};
}

/** Trace the exact C1111X-8P non-radio photograph, including the alternate WAN media and four-pin DC connector. */
function isrPanels(device){
  const ports=[],components=[part("module-bay",.012,.435,.145,.40,"edge-isr-power"),part("text",.104,.05,.065,.15,undefined,"CISCO"),
    part("usb",.596,.662,.040,.12),part("module-bay",.966,.50,.024,.16,"edge-isr-lock"),
    part("text",.556,.11,.080,.10,undefined,"PID"),part("text",.650,.11,.08,.10,undefined,"SERIAL")];
  for(let i=0;i<8;i++){const x=.191+Math.floor(i/2)*.045;ports.push(socket(device,i+1,x,i%2?.663:.315,.041,.255,String(i),x,i%2?.903:.105,.044));}
  ports.push(socket(device,9,.409,.651,.046,.29,"GE0/0/1",.409,.912,.064),socket(device,10,.471,.651,.046,.29,"GE0/0/0 CU",.471,.912,.058),
    socket(device,11,.532,.695,.043,.17,"GE0/0/0 SFP",.532,.912,.057,["SFP_PLUS_10G"]),
    socket(device,12,.791,.398,.046,.285,"CON",.857,.398,.073),socket(device,13,.791,.764,.025,.062,"USB",.791,.925,.07));
  return {front:{ports:[],components:[part("module-bay",.008,.035,.984,.93,"edge-isr-bezel")]},rear:{ports,components}};
}
