import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const sources={
  9400:"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9400/hardware/install/b_c9400_hig/b_c9400_hig_chapter_00.pdf",
  9600:"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9600/hardware/install/b_9600_hig/b_9600_hig_chapter_01.pdf",
};
const cache=new Map();

/** Resolve disclosed modular populations and fit the native body inside unchanged saved allocations. */
export function resolveCatalystChassisFaceplate(device) {
  const series=device?.model==="Catalyst 9400 family"?9400:device?.model==="Catalyst 9600 family"?9600:null;
  if(!series||device.faceplate?.vendor!=="Cisco")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(series))cache.set(series,{profile:buildProfile(canonical.device,series),allocations:new Map()});
  const cached=cache.get(series),native=series===9400?6:8,units=Math.max(1,Number(device.faceplate.unitsU)||native);
  if(units===native)return cached.profile;
  if(!cached.allocations.has(units)){
    const body=native*100*cached.profile.chassis.height-16,available=units*100*.94-16,scale=Math.min(1,available/body);
    cached.allocations.set(units,{...cached.profile,chassis:{x:(1-.95*scale)/2,y:.03*Math.min(1,native/units),width:.95*scale,height:(body*scale+16)/(units*100)}});
  }
  return cached.allocations.get(units);
}

/** Record exact installed parts, primary figures and explicit revision-zero endpoint mappings. */
function buildProfile(device,series) {
  const small=series===9400,sku=small?"C9404R":"C9606R",source=sources[series];
  const supervisor=small?"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9400/hardware/sup_install/b-c9400-sup-note.pdf":"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9600/hardware/install/b-c9600-sup-note.pdf";
  const linecard=small?"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9400/hardware/sw_mod_install/b-c9400-mod-note.pdf":"https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9600/hardware/install/b-c9600-lc-installation-note.pdf";
  const configuration=small?"C9404R6U: C9400-LC-48XS slot1, C9400X-SUP-2 slot2, two C9400-PWR-3200AC supplies in bays1/2, C9404-FAN with eight internal fans; supervisor3, line4 and PSU3/4 covered."
    :"C9606R8U: C9600-LC-48YL slot1 at25G with C9600-SUP-1 slot3, two C9600-PWR-2KWAC supplies in bays1/2, C9606-FAN with nine internal fans; slots2/4/5/6 and PSU3/4 covered.";
  const portIndexMap={...Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,i+1])),...(small?{49:53,50:54,51:55,52:56,57:57,59:59}:{57:49,59:52})};
  return {id:`cisco-${sku.toLowerCase()}-selected`,sku,family:sku,defaultFace:"front",fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryComplete:true,inventoryRevision:1,rearHardwareVerified:true,source,
    sourcePage:small?"Overview front/rear pages2–3, PSU20; SUP2 page13; LC48XS page25":"Overview front/rear pages3–4, PSU8; SUP1 page2; LC48YL page11",
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,front:`${source}#page=${small?2:3}`,rear:`${source}#page=${small?3:4}`,supervisor,linecard},
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{57:"MGMT1",59:"CONSOLE"}}],
    limitations:[configuration,"Internal fan impellers face the side airflow path; front/rear show the service strips and covers, not fictitious rear fan banks. Small printing is simplified.",
      small?"C9400-LC-48XS requires SUP2/2XL. SUP2's eight physical uplink sockets support either four25G plus three100G or four100G; all physical sockets are drawn, without enforcing mutually exclusive modes."
        :"The selected48YL/SUP1 supports25G,10G and1G. Its copper and fiber management sockets are alternatives; only one can be active. There is no separate eight-port uplink card installed.",
      "Alternate cards and supervisors need separate layouts. Saved rack allocation, IDs, labels, types, speeds, links and settings are not changed."],
    catalogDiscrepancies:[small?"Saved SFP28 indices1–48 use the48XS SFP+ cages. Old QSFP49–52 map to supervisor sockets53–56. Old53–56 and second MGMT58 stay unmapped. Four SFP28 uplinks and RJ45 serial are new only."
      :"Saved data1–48 retain their cages. Old MGMT57 maps49 and USB-C59 mapsMini-B52. Old QSFP49–56 and second copper MGMT58 stay unmapped. Fiber management and RJ45 serial are new only."],
    chassis:{x:.025,y:.03,width:.95,height:small?.70:.69},faces:small?panels9404(device):panels9606(device)};
}

/** Bind a socket to immutable inventory and a bounded local caption region. */
function socket(device,index,x,y,width,height,label,captionX,captionY,captionWidth=.032,compatibleTypes=[]) {
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth},
    ...(compatibleTypes.length?{compatibleTypes}:{}),...(port.type==="USB_MINI_CONSOLE"?{connectorKind:"usb-mini",compatibleTypes:["USB_C_CONSOLE"]}:{})};
}

/** Describe a measured hardware element with no routable endpoint. */
function part(kind,x,y,width,height,variant,label) {return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Add module edge strips and separately located ejectors, leaving label space on the face clear. */
function moduleEdges(parts,x,y,width,height,label) {
  parts.push(part("module-bay",x,y,width,.012,"cat-chassis-strip",label),part("module-bay",x,y+.015,.020,height-.025,"cat-chassis-edge"),
    part("module-bay",x+width-.020,y+.015,.020,height-.025,"cat-chassis-edge"),
    part("handle",x+.024,y+height-.009,.20,.009,"cat-chassis-ejector"),part("handle",x+width-.224,y+height-.009,.20,.009,"cat-chassis-ejector"));
}

/** Trace the four-slot9404R with top supplies, left fan service strip and the SUP2 mixed uplink block. */
function panels9404(device) {
  const ports=[],components=[part("text",.455,.012,.10,.027,undefined,"CISCO"),part("module-bay",.026,.265,.075,.685,"cat-chassis-fan-front","C9404-FAN")];
  for(let i=0;i<4;i++)components.push(part(i<2?"psu":"module-bay",.025+i*.239,.065,.228,.173,i<2?"cat-9400-3200ac":"cat-chassis-blank",i<2?undefined:`PSU ${i+1}`));
  moduleEdges(components,.123,.26,.847,.170,"C9400-LC-48XS · SLOT 1");
  for(let i=0;i<48;i++){
    const col=Math.floor(i/2),x=.170+col*.0315+Math.floor(col/6)*.010;
    ports.push(socket(device,i+1,x,i%2?.380:.329,.029,.035,String(i+1),x,i%2?.411:.297,.031,["SFP28_25G"]));
  }
  moduleEdges(components,.123,.443,.847,.170,"C9400X-SUP-2 · SLOT 2");
  for(let i=0;i<4;i++){
    const x=.703+Math.floor(i/2)*.038;
    ports.push(socket(device,49+i,x,i%2?.539:.492,.032,.033,String(i+1),x,i%2?.575:.465,.035));
    const qx=.794+i*.044;
    ports.push(socket(device,53+i,qx,.539,.043,.033,String(i+5),qx,.575,.042));
  }
  ports.push(socket(device,57,.290,.490,.030,.037,"MGMT",.344,.490,.065),socket(device,58,.290,.545,.030,.037,"CON",.344,.545,.065),
    socket(device,59,.233,.553,.021,.013,"USB",.233,.579,.044));
  components.push(part("usb",.174,.530,.032,.025),part("button",.661,.54,.008,.011),
    ...Array.from({length:4},(_,i)=>part("led",.18+i*.026,.462,.005,.006)),
    part("module-bay",.123,.626,.847,.157,"cat-chassis-blank","SUPERVISOR 3 COVER"),
    part("module-bay",.123,.797,.847,.157,"cat-chassis-blank","LINE 4 COVER"),
    part("text",.390,.967,.21,.025,undefined,"C9404R"));
  return {front:{ports,components},rear:{ports:[],components:[part("module-bay",.024,.020,.951,.96,"cat-9404-rear")]}};
}

/** Trace the9606R six-slot chassis, lower supplies and the SUP1 right-side dual-media management cluster. */
function panels9606(device) {
  const ports=[],components=[part("text",.45,.007,.10,.027,undefined,"CISCO"),part("module-bay",.025,.05,.070,.77,"cat-chassis-fan-front","C9606-FAN")];
  moduleEdges(components,.112,.047,.867,.139,"C9600-LC-48YL · SLOT 1");
  for(let i=0;i<48;i++){
    const col=Math.floor(i/2),x=.166+col*.0327+(col>=12?.018:0);
    ports.push(socket(device,i+1,x,i%2?.146:.109,.030,.023,String(i+1),x,i%2?.16725:.081,.031));
  }
  for(const slot of [2,4,5,6])components.push(part("module-bay",.112,.047+(slot-1)*.132,.867,.122,"cat-chassis-blank",`SLOT ${slot} COVER`));
  moduleEdges(components,.112,.311,.867,.127,"C9600-SUP-1 · SLOT 3");
  ports.push(socket(device,49,.832,.348,.031,.029,"MGMT",.889,.348,.066),socket(device,50,.932,.391,.030,.022,"SFP MGMT",.932,.416,.050),
    socket(device,51,.832,.390,.031,.029,"CON",.832,.416,.055),socket(device,52,.888,.399,.021,.009,"USB",.888,.416,.038));
  components.push(part("usb",.758,.367,.011,.030),part("usb",.782,.367,.011,.030),part("button",.344,.394,.005,.006),
    ...Array.from({length:4},(_,i)=>part("led",.234+i*.021,.384,.004,.006)));
  for(let i=0;i<4;i++)components.push(part(i<2?"psu":"module-bay",.123+i*.186,.863,.177,.105,i<2?"cat-9600-2kwac":"cat-chassis-blank",i<2?undefined:`PSU ${i+1}`));
  for(const x of [.034,.079,.894,.939])components.push(part("button",x,.878,.027,.070,"cat-chassis-power-switch"));
  return {front:{ports,components},rear:{ports:[],components:[part("module-bay",.023,.02,.954,.96,"cat-9606-rear")]}};
}
