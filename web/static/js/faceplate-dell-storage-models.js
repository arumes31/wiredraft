import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const psManual="https://dl.dell.com/content/manual43435486-dell-powerstore-hardware-information-guide-for-powerstore-1000-1200-3000-3200-5000-5200-7000-9000-and-9200.pdf?language=en-us";
const meManual="https://dl.dell.com/content/manual52191289-dell-powervault-me5-series-storage-system-owner-s-manual.pdf?language=en-us";
const introduction="https://www.delltechnologies.com/asset/en-us/products/storage/industry-market/h18149-dell-powerstore-platform-introduction.pdf";
const definitions={"PowerStore family":{sku:"PowerStore5200T",key:"powerstore5200t-v2",heightMm:86.4,widthMm:444.5,depthMm:795,source:psManual},
  "PowerVault family":{sku:"ME5024",key:"powervault-me5024-iscsi",heightMm:87.9,widthMm:483,depthMm:547.8,source:meManual}};
const cache=new Map();

/** Resolve the two exact Dell storage configurations and proportionally fit their artwork into each saved rack allocation. */
export function resolveDellStorageFaceplate(device) {
  const d=definitions[device?.model];if(!d||device.faceplate?.vendor!=="Dell"||device.category!=="Server")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,d),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||2);if(units===2)return c.profile;
  if(!c.allocations.has(units)) {
    const scale=Math.min(1,units/2),body=(200*c.profile.chassis.height-16)*scale;
    const rawHeight=body<64?body/.8:body+16;
    c.allocations.set(units,{...c.profile,chassis:{x:(1-scale)/2,y:.10*Math.min(1,2/units),width:scale,height:rawHeight/(units*100)}});
  }
  return c.allocations.get(units);
}

/** Declare concrete hardware options, source scope and identity-preserving mappings for the former ten-port aliases. */
function buildProfile(device,d) {
  const ps=d.sku==="PowerStore5200T";
  const configuration=ps
    ? "Dell PowerStore5200T Gen2 base enclosure with embedded modulev2 (the hardware revision shipped before4.x), twenty-one NVMe TLC SSDs in slots0–20 and four NVMe NVRAM drives in21–24, matching the manufacturer's full front population. Each node has an installed four-port25Gb SFP28 embedded card and two-port100Gb QSFP28 backend card, one1Gb management and one1Gb service Ethernet socket. Optional host I/O slots0/1 are covered on both nodes. Two2100W AC supplies with C20 inlets; no expansion enclosure is connected. NodeA is lower and nodeB is upper/inverted."
    : "Dell PowerVaultME5024 ME5, dual four-port25Gb iSCSI SFP28 controllers, twenty-four2.4TB12Gb SAS ISE10K512e disks in slots0–23, and two580W AC Power Cooling Modules. Dell order-code me5024iscsi documents these controller, drive and supply options; the selected population fills all24 bays. Each controller has1Gb management Ethernet and a micro-USB CLI socket. No expansion enclosure or expansion IOM is installed. ControllerA is upper, controllerB lower/inverted; PCM0 is left and PCM1 right/inverted.";
  return {id:`dell-${d.key}`,family:d.sku,sku:d.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,defaultFace:"rear",rearHardwareVerified:true,
    source:d.source,sourcePage:ps?"Hardware guide pp7,10,12–13,18,31; Introduction pp12–17":"Owner's Manual pp12–14,22–24,134,136,138; Dell me5024iscsi configuration",
    evidence:{scope:"model",models:[device.model],sku:d.sku,configuration,reviewed:"2026-09-11",front:`${d.source}#page=${ps?7:12}`,rear:`${d.source}#page=${ps?13:13}`,
      photo:ps?introduction:"https://www.dell.com/en-uk/shop/dell-servers-storage-networking/smart-selection-powervault-me5024/spd/powervault-me5024/me5024iscsi",
      physicalDimensions:{heightMm:d.heightMm,widthMm:d.widthMm,depthMm:d.depthMm},revision:ps?"Gen2 / embeddedv2":"ME5 / ME5024 /25Gb iSCSI"},note:configuration,
    limitations:[configuration,"The alias selects this configuration only; other generations, drive populations and controller options have different physical layouts.",
      "Front security bezel/EMI shield is removed for the service view. Indicators are inactive; internal fans and batteries are not invented as exterior components.",
      ps?"Unused mini-serial, microDB9 and USB connectors are ancillary service artwork. Backend100Gb ports are expansion-only, not general host uplinks.":"Service-only USB and12Gb mini-SAS HD expansion sockets remain ancillary because no matching SAS endpoint type exists in the editor. CLI micro-USB is explicitly connectable.",
      "Saved device/rack placement, allocation, endpoint IDs, edited names/types/speeds/settings and complete cable references remain unchanged. New physical endpoints are created only for new revision1 devices."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10},
      portLabels:{1:"DATA1",2:"DATA2",3:"DATA3",4:"DATA4",5:"DATA5",6:"DATA6",7:"DATA7",8:"DATA8",9:"MGMT1",10:"MGMT2"}}],
    catalogDiscrepancies:["Old indices1–8 map explicitly to node/controllerA0–3 thenB0–3; old9/10 map toA/B management. No label-based inference or index replacement occurs.",
      ps?"Service11/12 and backend13–16 are added only to new instances.":"CLI11/12 are added only to new instances."],
    chassis:{x:0,y:.10,width:1,height:(690*d.heightMm/(ps?483:d.widthMm)+16)/200},
    faces:ps?{front:powerStoreFront(),rear:powerStoreRear(device)}:{front:powerVaultFront(),rear:powerVaultRear(device)}};
}

/** Place a sourced ancillary part using normalized panel coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind a canonical physical endpoint while keeping its readable node/controller label separate from the saved editable label. */
function socket(device,index,x,y,width,height,label,captionX=x,captionY=y+.13) {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,
    connectorKind:port.type==="USB_MICRO_CONSOLE"?"usb-micro":port.type==="RJ45_1G"?"rj45":port.type==="QSFP28_100G"?"qsfp":"sfp",
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:port.type==="SFP28_25G"?.038:.07}};
}

/** Rotate a node/controller180degrees in the panel while rotating physical sockets and retaining upright application captions. */
function inverted(p,center=false) {
  return {...p,x:1-p.x-(center?0:p.width),y:1-p.y-(center?0:p.height),inverted:!p.inverted,
    ...(p.descriptionAnchor?{descriptionAnchor:{...p.descriptionAnchor,x:1-p.descriptionAnchor.x,y:1-p.descriptionAnchor.y}}:{}),
    ...(p.connectorKind==="rj45"?{connectorKind:"rj45-inverted"}:{})};
}

/** Draw the manufacturer's fully populated21 data carriers and four differently latched NVRAM carriers at21–24. */
function powerStoreFront() {
  const components=[];
  for(let n=0;n<25;n++) {
    components.push(part("drive-carrier",.043+n*.0366,.05,.034,.90,`drive-${n}`,n>=21?"powerstore-nvram":"powerstore-tlc",{driveNumber:n}));
  }
  components.push(part("led",.017,.09,.012,.065,"enclosure-status"));
  for(const x of [.011,.976])components.push(part("handle",x,.69,.017,.24,"rail-latch"));
  return {components,ports:[]};
}

/** Trace nodeA's embeddedv2 card and two covered host I/O slots, then rotate the entire physical arrangement for nodeB. */
function powerStoreRear(device) {
  const lower=[part("psu",.795,.535,.174,.405,"node-a-psu","powerstore-2100w"),
    part("module-bay",.454,.57,.151,.335,"node-a-io0-cover","powerstore-io-cover"),part("module-bay",.620,.57,.151,.335,"node-a-io1-cover","powerstore-io-cover"),
    part("module-bay",.23,.605,.050,.095,"node-a-unused-serial","powerstore-unused-serial"),
    part("usb",.425,.77,.009,.12,"node-a-unused-usb"),part("button",.412,.89,.013,.065,"node-a-nmi","reset"),
    part("vent",.051,.595,.154,.038,"node-a-card-upper-grille","mesh"),
    part("vent",.230,.74,.045,.135,"node-a-embedded-grille","mesh")];
  const ports=[];
  for(let n=0;n<4;n++)ports.push(socket(device,n+1,.068+n*.041,.79,.036,.115,`A${n}`,undefined,.938));
  ports.push(socket(device,9,.300,.675,.029,.110,"A MGMT",.300,.543),socket(device,11,.300,.825,.029,.100,"A SVC",.300,.938),
    socket(device,13,.375,.67,.063,.100,"A EXP0",.375,.555),socket(device,14,.375,.825,.063,.100,"A EXP1",.375,.938));
  const upper=lower.map(p=>({...inverted(p),role:p.role.replace("node-a","node-b")}));
  const upperPorts=ports.map(p=>{const index=p.portIndex<=4?p.portIndex+4:p.portIndex===9?10:p.portIndex===11?12:p.portIndex+2;
    const mapped=inverted(p,true),canonical=device.ports.find(port=>port.portIndex===index);
    return {...mapped,portIndex:index,type:canonical.type,label:canonical.label,physicalLabel:p.physicalLabel.replace(/^A/,"B")};});
  return {components:[...lower,...upper],ports:[...ports,...upperPorts]};
}

/** Draw the24 vertical ME5 SFF carriers and source-specific left two-digit operator panel. */
function powerVaultFront() {
  const components=[];
  for(let n=0;n<24;n++)components.push(part("drive-carrier",.059+n*.0367,.045,.0345,.905,`drive-${n}`,"me5-sff",{driveNumber:n}));
  components.push(part("lcd",.011,.36,.034,.14,"enclosure-id","seven-segment",{text:"00"}),part("button",.022,.58,.015,.07,"identify","reset"));
  for(const [n,role] of ["power","fault"].entries())components.push(part("led",.014+n*.022,.23,.011,.055,role));
  components.push(part("handle",.957,.67,.026,.26,"right-rail-latch"));return {components,ports:[]};
}

/** Trace ME5024's topA four-SFP28 controller, micro-USB and management bank, bottom invertedB and side580W PCMs. */
function powerVaultRear(device) {
  const upper=[part("usb-micro",.521,.177,.027,.057,"controller-a-service-usb"),
    part("storage-expansion",.692,.215,.038,.17,"controller-a-sas-expansion","me5-sas-expansion"),
    part("module-bay",.43,.475,.29,.016,"controller-a-handle","me5-controller-handle")];
  for(let n=0;n<4;n++)upper.push(part("led",.304+n*.041,.12,.009,.044,`controller-a-link-${n}`));
  const ports=[];
  for(let n=0;n<4;n++)ports.push(socket(device,n+1,.307+n*.040+(n>=2?.014:0),.277,.036,.115,`A${n}`,undefined,.405));
  ports.push(socket(device,9,.637,.27,.035,.145,"A MGMT",.637,.405),socket(device,11,.578,.198,.029,.062,"A CLI",.578,.325));
  const lower=upper.map(p=>({...inverted(p),role:p.role.replace("controller-a","controller-b")}));
  const lowerPorts=ports.map(p=>{const index=p.portIndex<=4?p.portIndex+4:p.portIndex===9?10:12;
    const mapped=inverted(p,true),canonical=device.ports.find(port=>port.portIndex===index);
    return {...mapped,portIndex:index,label:canonical.label,physicalLabel:p.physicalLabel.replace(/^A/,"B")};});
  return {components:[part("psu",.047,.045,.210,.91,"pcm-0","me5-580w"),part("psu",.743,.045,.210,.91,"pcm-1","me5-580w",{inverted:true}),...upper,...lower],ports:[...ports,...lowerPorts]};
}
