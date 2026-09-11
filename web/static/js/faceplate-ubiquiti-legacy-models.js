import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={
  "EdgeMAX legacy family":{sku:"ER-12",width:268.1,height:31.1,depth:136.5,rackWidth:483,copper:10,source:"https://dl.ui.com/guides/edgemax/EdgeRouter_ER-12_QSG.pdf",pages:"PDFpp4–8,16",
    configuration:"ER-12 desktop chassis with supplied24V1A external adapter, ten1Gb RJ45 ports0–9, two1Gb SFP cages10/11 and RJ45 serial console. Port0 supports24V passivePoE input; port9 supports passivePoE output, disabled by default. The USB-A receptacle is reserved for future use. No optional ER-RMKIT, optical modules, internal rack PSU or externally exposed fan assembly is installed. The268.1×31.1mm front is displayed at its real compact width inside the preserved1U allocation; saved rack placement is an editor allocation, not evidence of an installed mounting kit."},
  "EdgeRouter legacy family":{sku:"ER-8",width:484,height:44,depth:164,rackWidth:484,copper:8,source:"https://dl.ui.com/datasheets/edgemax/EdgeRouter_DS.pdf",pages:"PDFp12 straight front/rear photographs and C5 cord specification",
    configuration:"ER-8 rack configuration from EdgeRouter datasheetp12: eight1Gb RJ45 ports eth0–eth7, RJ45 serial console and reserved USB-A receptacle on the front. Integral19in rack ears, fixed60W24V2.5A internal AC/DC supply and C6 cloverleaf rear inlet with C5 cord. Two fixed rear cooling locations have perforated concentric guards; no exposed rotor blades or removable PSU modules are invented. No SFP cages, PoE outputs or separate out-of-band Ethernet interface."},
  "EdgeSwitch legacy family":{sku:"ES-16-150W",width:443,height:43,depth:221,rackWidth:483,copper:16,source:"https://dl.ui.com/guides/edgemax/EdgeSwitch_ES-16-150W_QSG.pdf",pages:"PDFpp3–8,10,17; HTML whole rear diagram",
    configuration:"ES-16-150W with supplied pair of rack brackets installed in the front position, fixed150W internal AC/DC supply and C14 input. Sixteen1Gb RJ45 PoE+/24V passive-capable sockets in eight two-high columns, two vertically stacked1Gb SFP cages with no optical modules installed, and a rear RJ45 serial console. Two fixed rear fan guards; no removable PSU bays, extra fans or separate out-of-band Ethernet socket. The catalog Router category is retained for saved compatibility."}
};
const cache=new Map();

/** Resolve the three explicit legacy aliases and fit native physical bodies without altering saved allocations. */
export function resolveUbiquitiLegacyFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Ubiquiti"||device.category!=="Router")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Describe source boundaries and explicit19-port legacy mappings independently of users' editable inventories. */
function buildProfile(device,s) {
  const compact=s.sku==="ER-12",bodyWidth=compact?s.width/s.rackWidth:1,bodyHeight=690*s.height/s.rackWidth,
    rawHeight=bodyHeight<64?bodyHeight/.8:bodyHeight+16;
  const portIndexMap=Object.fromEntries(Array.from({length:s.copper},(_,i)=>[i+1,i+1]));
  if(s.sku!=="ER-8")Object.assign(portIndexMap,{17:s.sku==="ER-12"?11:17,18:s.sku==="ER-12"?12:18});
  return {id:`ubiquiti-legacy-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryRevision:1,inventoryComplete:true,defaultFace:"front",rearHardwareVerified:true,source:s.source,sourcePage:s.pages,
    evidence:{scope:"model",models:[device.model],sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.source,rear:s.source,
      physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:s.rackWidth},revision:s.sku==="ER-8"?"EdgeRouter datasheetp12 C6 inlet chassis":"2018 QSG hardware"},note:s.configuration,
    limitations:[s.configuration,"The alias selects this exact SKU and installed hardware. All indicators are inactive artwork; no running status is simulated. Source SFP cages are shown without installed optical modules.",
      "Original devices had16RJ45_1G, twoSFP_PLUS_10G and oneMGMT RJ45_1G. Explicit revision0 maps only documented matching sockets. Excess copper,10Gb SFP+ and fictitious separate MGMT endpoints remain unmapped with their IDs, settings and complete cables unchanged.",
      "New instances have exact documented1Gb SFP types and console/input endpoints. Existing inventory is never enlarged or retyped; sparse/reordered inventories and unknown revisions remain intact.",
      s.sku==="ER-8"?"The older QSG hookup illustration depicts a rectangular C14 inlet. This layout instead uses the coherent datasheetp12 revision: straight rear photograph clearly shows the C6 cloverleaf inlet and its table specifies a C5 cord.":
        compact?"ER-RMKIT is a compatible optional accessory but is not installed in this selected desktop configuration. No generic full-width rack body or mounting ears are added.":"The16PoE-capable ports use new PoE defaults; saved PoE settings remain unchanged. Rear management is serial CLI; Ethernet management shares the data ports."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{...Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,String(i+1)])),17:"SFP+1",18:"SFP+2",19:"MGMT1"}}],
    catalogDiscrepancies:[`Only the first${s.copper} original copper interfaces map to this model's copper sockets.`,"The original10Gb fiber entries cannot be relabeled as1Gb optics. OriginalMGMT19 does not become a console or data port."],
    chassis:{x:(1-bodyWidth)/2,y:.10,width:bodyWidth,height:rawHeight/100},faces:compact?er12Panels(device):s.sku==="ER-8"?er8Panels(device):es16Panels(device)};
}

/** Define inactive normalized ancillary hardware with a source-specific semantic role. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind physical positions to canonical indices, keeping physical captions independent of edited labels. */
function socket(device,index,x,y,width,height,physicalLabel,captionY,kind,captionWidth=.06) {
  const p=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:p.type,label:p.label,physicalLabel,x,y,width,height,connectorKind:kind||(p.type==="SFP_1G"?"sfp":"rj45"),
    descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add only the actual two front mounting ears, with correct inset chassis width on the EdgeSwitch. */
function rackEars(components,width=.035) {
  for(const x of [.001,1-width-.001])components.push(part("rack-ear",x,.035,width,.93,`rack-ear-${x<.5?"left":"right"}`,"ubiquiti-legacy-ear"));
}

/** Trace the compact ER-12 front row, reserved USB and ventilated rear/DC barrel from the2018 guide. */
function er12Panels(device) {
  const front={components:[part("text",.012,.395,.042,.20,"ubiquiti-logo",undefined,{text:"U",fontSize:8}),part("led-strip",.060,.452,.012,.09,"system-led","ubiquiti-legacy-led"),
    part("usb",.166,.285,.021,.40,"usb-reserved"),part("button",.959,.45,.016,.13,"reset-button")],ports:[]};
  for(let n=0;n<10;n++)front.ports.push(socket(device,n+1,.231+n*.0594,.490,.054,.382,String(n),.850,undefined,.052));
  for(let n=0;n<2;n++)front.ports.push(socket(device,11+n,.839+n*.068,.518,.055,.296,String(10+n),.850,"sfp",.059));
  front.ports.push(socket(device,13,.118,.490,.055,.382,"CON",.850));
  const rear={components:[part("vent",.052,.275,.455,.49,"rear-passive-vent","ubiquiti-legacy-perforations"),
    part("button",.968,.658,.020,.17,"ground-bond"),part("screw",.012,.13,.012,.11,"rear-left-screw"),part("screw",.968,.13,.012,.11,"rear-right-screw")],
    ports:[socket(device,14,.726,.480,.036,.308,"24V DC",.855,"ubiquiti-er12-dc",.11)]};
  return {front,rear};
}

/** Trace the ER-8's widely spaced front row and guarded rear fans from the datasheet's straight elevations. */
function er8Panels(device) {
  const front={components:[part("text",.041,.39,.098,.20,"product-name",undefined,{text:"U  |  EdgeRouter",fontSize:7}),
    part("usb",.224,.335,.013,.32,"usb-reserved"),part("button",.914,.53,.008,.10,"reset-button"),part("led-strip",.914,.36,.008,.075,"power-led","ubiquiti-legacy-led"),
    part("led-strip",.737,.40,.022,.22,"port-indicator-legend","ubiquiti-legacy-legend")],ports:[]};rackEars(front.components,.034);
  for(let n=0;n<8;n++)front.ports.push(socket(device,n+1,.280+n*.0598,.50,.034,.316,`eth${n}`,.81,undefined,.055));
  front.ports.push(socket(device,9,.180,.50,.034,.316,"CONSOLE",.81,undefined,.064));
  const rear={components:[part("vent",.095,.25,.222,.49,"rear-left-vent","ubiquiti-legacy-perforations"),part("vent",.430,.25,.135,.49,"rear-center-vent","ubiquiti-legacy-perforations"),
    part("fan",.342,.16,.068,.71,"fixed-fan-1","ubiquiti-legacy-guard"),part("fan",.590,.16,.068,.71,"fixed-fan-2","ubiquiti-legacy-guard"),
    part("text",.699,.26,.125,.41,"regulatory-panel",undefined,{text:"EdgeRouter ER-8\nAC 60W",fontSize:6}),part("screw",.062,.82,.006,.09,"rear-left-screw"),part("screw",.924,.82,.006,.09,"rear-right-screw")],
    ports:[socket(device,10,.867,.53,.049,.48,"AC IN",.90,"ubiquiti-er8-c6",.07)]};rackEars(rear.components,.034);
  return {front,rear};
}

/** Trace the ES-16's right-side odd/even columns, stacked SFP cages and left-side rear console/two fans. */
function es16Panels(device) {
  const front={components:[part("text",.072,.51,.225,.20,"product-name",undefined,{text:"U  |  EdgeSwitch 16 150W",fontSize:8}),
    part("led-strip",.059,.555,.009,.085,"system-led","ubiquiti-legacy-led"),part("led-strip",.542,.35,.014,.30,"poe-legend","ubiquiti-legacy-legend"),part("led-strip",.854,.35,.014,.30,"link-legend","ubiquiti-legacy-legend"),
    part("button",.944,.71,.006,.08,"reset-button")],ports:[]};rackEars(front.components,.035);
  for(let n=0;n<16;n++)front.ports.push(socket(device,n+1,.587+Math.floor(n/2)*.0346,n%2?.666:.334,.031,.261,String(n+1),n%2?.895:.105,undefined,.033));
  for(let n=0;n<2;n++)front.ports.push(socket(device,17+n,.912,n?.671:.367,.030,.215,`SFP${n+1}`,n?.900:.115,"sfp",.058));
  const rear={components:[part("fan",.230,.17,.064,.70,"fixed-fan-1","ubiquiti-legacy-guard"),part("fan",.419,.17,.064,.70,"fixed-fan-2","ubiquiti-legacy-guard"),
    part("text",.645,.30,.145,.38,"regulatory-panel",undefined,{text:"EdgeSwitch 16 150W\n100–240V AC",fontSize:6}),
    part("screw",.065,.11,.007,.10,"rear-left-screw"),part("screw",.485,.11,.007,.10,"rear-center-screw"),part("screw",.936,.11,.007,.10,"rear-right-screw")],
    ports:[socket(device,19,.166,.51,.029,.319,"CONSOLE",.85,undefined,.070),socket(device,20,.859,.49,.055,.48,"AC IN",.86,"ubiquiti-legacy-c14",.070)]};
  return {front,rear};
}
