import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const synologyManual="https://global.download.synology.com/download/Document/Hardware/HIG/RackStation/21-year/RS3621RPxs/enu/Syno_HIG_RS3621RPxs_enu.pdf";
const qnapManual="https://download.qnap.com/TechnicalDocument/Storage/SMB%20NAS/ts-873aeu/ts-873aeu-ug-01-en-us.pdf";
const definitions={
  "Synology/RackStation family":{key:"synology-rs3621rpxs-a",sku:"RS3621RPxs",widthMm:482,heightMm:88,depthMm:724,source:synologyManual,frontPage:4,rearPage:4},
  "QNAP/Rackmount NAS family":{key:"qnap-ts873aeu-rp",sku:"TS-873AeU-RP-4G",widthMm:482,heightMm:89,depthMm:297.4,source:qnapManual,frontPage:8,rearPage:9},
};
const cache=new Map();

/** Resolve only the two documented rack NAS configurations; fit saved allocations without changing their inventories or placements. */
export function resolveNASFaceplate(device) {
  const definition=definitions[`${device?.faceplate?.vendor}/${device?.model}`];
  if(!definition||device.category!=="Server")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,definition),allocations:new Map()});
  const cached=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||2);
  if(units===2)return cached.profile;
  if(!cached.allocations.has(units)) {
    const scale=Math.min(1,units/2),bodyHeight=(200*cached.profile.chassis.height-16)*scale;
    // The shared scene reserves20% below80px and16px otherwise; invert both branches.
    const rawHeight=bodyHeight<64?bodyHeight/.8:bodyHeight+16;
    cached.allocations.set(units,{...cached.profile,chassis:{x:(1-scale)/2,y:.10*Math.min(1,2/units),width:scale,height:rawHeight/(units*100)}});
  }
  return cached.allocations.get(units);
}

/** Declare the selected SKU, backplate, empty trays, supplies and explicit historical network-index correspondence. */
function buildProfile(device,d) {
  const synology=d.sku==="RS3621RPxs";
  const configuration=synology
    ? "Synology RS3621RPxs, backplate A from the hardware guide: factory diskless with twelve empty Disk Tray Type R7 carriers, four embedded 1Gb RJ45 LAN ports and two Delta PSU 500W-RP Module_2 redundant supplies. Both PCIe expansion covers remain installed; no NIC card or external expansion unit is installed."
    : "QNAP TS-873AeU-RP-4G, factory diskless with eight empty drive trays in the documented 2/3/3 arrangement, two embedded 2.5Gb RJ45 LAN ports, two factory 300W redundant supplies and three rear 60mm system fans. No PCIe expansion or M.2 SSD is installed; both external low-profile covers remain installed.";
  return {id:d.key,family:d.sku,sku:d.sku,fidelity:"model",inventoryComplete:true,inventoryRevision:1,
    panelFidelity:{front:"model",rear:"model"},defaultFace:"rear",rearHardwareVerified:true,
    source:d.source,sourcePage:`PDF front page ${d.frontPage}, rear page ${d.rearPage}; hardware specification and installation sections`,
    evidence:{scope:"model",models:[device.model],sku:d.sku,reviewed:"2026-09-11",configuration,
      front:`${d.source}#page=${d.frontPage}`,rear:`${d.source}#page=${d.rearPage}`,
      tray:synology?`${synologyManual}#page=14`:`${qnapManual}#page=10`,
      power:synology?`${synologyManual}#page=10`:"https://www.qnap.com/en/product/ts-873aeu-rp/specs/hardware",
      physicalDimensions:{widthIncludingEarsMm:d.widthMm,heightMm:d.heightMm,depthMm:d.depthMm},
      backplate:synology?"A / Delta 500W":"TS-873AeU-RP"},
    note:configuration,
    limitations:[configuration,
      "This catalog alias selects one concrete model and does not assert the appearance of every RackStation or QNAP rack NAS.",
      "Diskless means carriers are installed without disks; indicator lights are shown inactive. Internal memory, processors, M.2 slots and depth are outside this orthographic panel projection.",
      synology?"Backplate B and the alternative 550W modules have different physical arrangements and are not depicted. COM is manufacturing-only; USB and two Infiniband expansion sockets are ancillary artwork because the editor has no compatible storage-expansion endpoint type.":"Rear USB Type-A and Type-C sockets are ancillary storage/peripheral connectors, not console or Ethernet endpoints.",
      "Saved allocations retain their height and placement, with the physical drawing fitted proportionally. Unsupported saved endpoints remain available as explicitly unmapped inventory."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:synology?{1:1,2:2,3:3,4:4}:{1:1,2:2},portLabels:{1:"LAN1",2:"LAN2",3:"LAN3",4:"LAN4",5:"MGMT1"}}],
    catalogDiscrepancies:["Historical LAN endpoints retain every saved ID, type, speed, label and setting on explicitly mapped physical sockets.",
      synology?"Historical MGMT5 is unmapped: this configuration has four LAN sockets and no dedicated management Ethernet.":"Historical LAN3, LAN4 and MGMT5 are unmapped: this configuration has only two LAN sockets and no dedicated management Ethernet."],
    chassis:{x:0,y:.10,width:1,height:(690*d.heightMm/d.widthMm+16)/200},
    faces:synology?{front:synologyFront(),rear:synologyRear(device)}:{front:qnapFront(),rear:qnapRear(device)},
  };
}

/** Place one sourced ancillary component using normalized top-left panel bounds. */
function part(kind,x,y,width,height,role,variant,extra={}) {
  return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};
}

/** Bind a physical LAN socket by canonical index while allowing the former 10Gb copper type to retain its saved settings. */
function lan(device,index,x,y,width,height,captionY) {
  const port=device.ports.find((p)=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:`LAN${index}`,x,y,width,height,connectorKind:"rj45",
    compatibleTypes:["RJ45_10G"],descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7}};
}

/** Draw the twelve R7 trays in the manufacturer's left-to-right 1–4, 5–8, 9–12 order with the left status strip. */
function synologyFront() {
  const components=[];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)components.push(part("drive-carrier",.062+col*.219,.045+row*.31,.211,.286,`empty-tray-${row*4+col+1}`,"synology-r7",{driveNumber:row*4+col+1}));
  components.push(part("button",.013,.13,.019,.10,"power"),part("button",.013,.39,.019,.10,"beep-off"));
  for(let i=0;i<3;i++)components.push(part("led",.036,.17+i*.09,.009,.045,["status","alert","network"][i]));
  for(const x of [.014,.959])components.push(part("handle",x,.67,.025,.28,"rack-handle"));
  components.push(part("text",.941,.33,.048,.14,"model-label",undefined,{text:"RS3621RPxs",fontSize:5}));
  return {components,ports:[]};
}

/** Trace Synology backplate A: left stacked Delta supplies, upper grille, manufacturing DB9, four LAN and horizontal Infiniband sockets. */
function synologyRear(device) {
  const components=[part("psu",.022,.03,.218,.455,"psu-1","synology-delta-500w"),part("psu",.022,.515,.218,.455,"psu-2","synology-delta-500w"),
    part("vent",.259,.07,.602,.51,"rear-main-grille","synology-square-grid",{columns:36,rows:6}),part("vent",.259,.58,.132,.33,"rear-lower-grille","synology-square-grid",{columns:8,rows:4}),
    part("db9",.414,.58,.068,.10,"manufacturing-only-com"),
    part("usb",.658,.713,.033,.070,"usb-1"),part("usb",.658,.815,.033,.070,"usb-2"),
    part("storage-expansion",.718,.79,.073,.115,"expansion-1","synology-infiniband"),part("storage-expansion",.814,.79,.073,.115,"expansion-2","synology-infiniband"),
    part("module-bay",.88,.075,.033,.69,"pcie-cover-1","synology-pcie-cover"),part("module-bay",.927,.075,.033,.69,"pcie-cover-2","synology-pcie-cover"),
    part("button",.960,.87,.013,.065,"reset","reset")];
  return {components,ports:[1,2,3,4].map((index)=>lan(device,index,.43+(index-1)*.035,.79,.032,.115,.94))};
}

/** Trace QNAP's disk numbering and left full-height airflow panel, leaving the upper-right branding grille above tray6. */
function qnapFront() {
  const components=[part("vent",.063,.045,.17,.91,"front-airflow","qnap-perforated"),part("module-bay",.731,.045,.206,.265,"brand-grille","qnap-brand-grille")];
  for(const [row,numbers] of [[0,[7,8]],[1,[4,5,6]],[2,[1,2,3]]])for(const [col,n] of numbers.entries())components.push(part("drive-carrier",.276+col*.221,.045+row*.31,.211,.286,`empty-tray-${n}`,"qnap-ts873aeu",{driveNumber:n}));
  components.push(part("module-bay",.242,.04,.024,.925,"left-tray-latch-column"),part("button",.958,.14,.022,.10,"power"));
  for(let i=0;i<3;i++)components.push(part("led",.965,.285+i*.085,.010,.035,["status","network","expansion"][i]));
  for(const x of [.01,.967])components.push(part("screw",x,.75,.017,.08,"ear-screw"));
  return {components,ports:[]};
}

/** Trace the RP-only rear drawing: two covered brackets at left, three60mm grilles, low I/O and stacked300W supplies at right. */
function qnapRear(device) {
  const components=[part("module-bay",.045,.10,.177,.15,"pcie-cover-1","qnap-pcie-cover"),part("module-bay",.045,.59,.177,.15,"pcie-cover-2","qnap-pcie-cover"),
    part("psu",.771,.045,.181,.435,"psu-1","qnap-300w-rp"),part("psu",.771,.53,.181,.435,"psu-2","qnap-300w-rp"),
    part("button",.260,.85,.010,.05,"reset","reset"),
    part("usb",.368,.755,.032,.058,"usb-a-1"),part("usb",.411,.755,.032,.058,"usb-a-2"),
    part("usb-c",.368,.865,.032,.050,"usb-c-1"),part("usb-c",.411,.865,.032,.050,"usb-c-2")];
  for(let i=0;i<3;i++)components.push(part("fan",.267+i*.176,.045,.127,.66,`system-fan-${3-i}`,"qnap-60mm"));
  return {components,ports:[1,2].map((index)=>lan(device,index,.289+(index-1)*.043,.795,.033,.115,.94))};
}
