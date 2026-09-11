import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"EX2300 family":{sku:"EX2300-48P",height:44.5,width:441.9,rack:482.6,depth:309.8,pages:"PDF17 fig4; PDF21 fig10; PDF32–33 dimensions; PDF49 cooling; PDF55–56 power",source:"https://www.juniper.net/documentation/us/en/hardware/ex2300/ex2300.pdf",
  configuration:"EX2300-48P with supplied front rack brackets, built-in AC supply (740W PoE budget), two fixed rear fans with honeycomb exhaust guards and front-to-back airflow. Four front 10G SFP+ cages with no optics, Mini-USB Type-B console, rear RJ45 management and RJ45 console, rear USB-A storage and C14 input. No dedicated Virtual Chassis sockets or removable PSU modules."},
  "EX3400 family":{sku:"EX3400-48P",height:43.7,width:441,rack:482,depth:382.4,pages:"PDF16 base PSU; PDF20–21 dimensions; PDF24 fig2; PDF25 fig3; PDF34–36 cooling; PDF39–41 PSU",source:"https://www.juniper.net/documentation/us/en/hardware/ex3400/ex3400.pdf",
    configuration:"EX3400-48P factory configuration with supplied front rack brackets, one JPSU-920-AC-AFO in PSU0, PSU1 covered, two front-to-back AFO fan modules and the PSU's own fan. Four front 10G SFP+ cages and two rear 40G QSFP+ cages in default Virtual Chassis mode, without optics; front Mini-USB Type-B console, rear RJ45 management/console and USB-A storage. The guide requires redundant PSUs in the EU and other listed regions; this explicitly selected single-supply factory configuration does not depict that regional installation."}};
const cache=new Map();

/** Resolve only the two documented aliases and retain the native1U physical body in larger saved allocations. */
export function resolveJuniperEXFamilyFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Establish immutable source geometry and an explicit type-guarded map for the historical60-port revision. */
function buildProfile(device,s) {
  const ex3400=s.sku==="EX3400-48P",bodyHeight=690*s.height/s.rack,rawHeight=bodyHeight<64?bodyHeight/.8:bodyHeight+16;
  const portIndexMap=Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,i+1]));portIndexMap[59]=ex3400?55:53;
  if(ex3400)Object.assign(portIndexMap,{57:53,58:54});
  return {id:`juniper-ex-family-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,
    defaultFace:"front",rearHardwareVerified:true,source:s.source,sourcePage:s.pages,note:s.configuration,
    evidence:{scope:"model",models:[s.sku],selectedModel:s.sku,catalogAlias:device.model,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.source,rear:s.source,
      physicalDimensions:{heightMm:s.height,widthMm:s.width,rackWidthMm:s.rack,depthMm:s.depth}},
    limitations:[s.configuration,"Indicators are inactive artwork. Empty SFP+/QSFP+ cages represent physical interfaces, not installed optical modules. USB-A is storage, not an Ethernet or serial endpoint.",
      "Original snapshot438 devices have48 copper, eight25Gb SFP28, two Stack VC57/58, MGMT59 and USB-C console60 in1U. Revision0 maps48 compatible copper ports and MGMT only; EX3400 also maps its two source-backed40Gb VCPs. Incompatible25Gb/USB-C endpoints and EX2300's nonexistent dedicated VC remain unmapped.",
      "Existing endpoint IDs, labels, types, settings, complete cable references, ordering and rack placements are unchanged. New console and power endpoints occur only on new instances; missing canonical sockets remain noninteractive ancillary artwork."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{...Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,String(i+1)])),59:"MGMT",57:"VC1",58:"VC2"}}],
    chassis:{x:0,y:.1,width:1,height:rawHeight/100},faces:{front:frontPanel(device,ex3400),rear:ex3400?ex3400Rear(device):ex2300Rear(device)}};
}

/** Create a normalized source-specific inactive ancillary component. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind a physical source socket to a stable canonical index, with independent physical captions. */
function socket(device,index,x,y,width,height,physicalLabel,captionY,kind,captionWidth=.04) {
  const p=device.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel,x:x+width/2,y:y+height/2,width,height,connectorKind:kind||"rj45",
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Represent supplied front mounting brackets and their two elongated rack holes. */
function ears(components) {for(const x of [.001,.963])components.push(part("rack-ear",x,.015,.036,.97,`rack-ear-${x<.5?"left":"right"}`,"juniper-ex-ear"));}

/** Trace each model's48-port odd/even columns, four bank gaps and low single-row SFP+ uplinks from its own front figure. */
function frontPanel(device,ex3400) {
  const components=[part("vent",.060,.015,.737,.105,"front-intake","juniper-ex-honeycomb"),part("text",.807,.07,.092,.25,"model-mark",undefined,{text:ex3400?"EX3400 PoE+":"EX2300 PoE+",fontSize:6}),
    part("status",.911,.14,.042,.37,"system-and-mode-leds","juniper-ex-status"),part("button",.948,.56,.010,.09,"factory-reset")];ears(components);
  const ports=[];
  for(let n=0;n<48;n++) {
    const col=Math.floor(n/2),x=.052+col*.02955+Math.floor(col/6)*.0075;
    ports.push(socket(device,n+1,x,n%2?.635:.290,.0265,.235,String(n),n%2?.928:.190,"rj45",.0265));
  }
  for(let n=0;n<4;n++)ports.push(socket(device,49+n,.807+n*.0314,ex3400?.634:.638,.029,.212,String(n),.918,"sfp",.028));
  const mini=socket(device,ex3400?57:55,.947,.727,.012,.112,"USB",.915,"usb-mini",.028);mini.descriptionAnchor.x=.947;ports.push(mini);
  return {components,ports};
}

/** Trace EX2300-48P's fixed fan exhaust locations and single fixed supply from figure10, without invented module seams. */
function ex2300Rear(device) {
  return {components:[part("usb",.072,.640,.032,.095,"usb-storage"),part("button",.154,.165,.011,.11,"protective-earth-1"),part("button",.187,.165,.011,.11,"protective-earth-2"),
    part("button",.244,.165,.016,.15,"esd-point"),part("fan",.279,.070,.084,.80,"chassis-fan-1","juniper-ex-fixed-guard"),part("fan",.409,.070,.084,.80,"chassis-fan-2","juniper-ex-fixed-guard"),
    part("panel",.669,.13,.16,.51,"serial-label","juniper-ex-label"),part("panel",.758,.745,.070,.10,"clei-label","juniper-ex-label")],
    ports:[socket(device,53,.072,.310,.032,.265,"MGMT",.147,"rj45",.055),socket(device,54,.117,.485,.032,.265,"CON",.312,"rj45",.040),
      socket(device,56,.892,.300,.057,.465,"AC IN",.880,"juniper-ex-c14",.075)]};
}

/** Trace EX3400's rear two VCPs, removable fans, single populated920W PSU and empty second bay from figure3. */
function ex3400Rear(device) {
  return {components:[part("usb",.070,.670,.031,.095,"usb-storage"),part("button",.153,.125,.011,.11,"protective-earth-1"),part("button",.187,.125,.011,.11,"protective-earth-2"),
    part("button",.251,.135,.016,.15,"esd-point"),part("fan",.296,.02,.093,.96,"chassis-fan-1","juniper-ex-fan-module"),part("fan",.399,.02,.093,.96,"chassis-fan-2","juniper-ex-fan-module"),
    part("panel",.506,.19,.066,.23,"serial-clei-label","juniper-ex-label"),part("fan",.604,.065,.085,.83,"psu0-fan","juniper-ex-psu-fan"),
    part("panel",.700,.065,.010,.81,"psu0-handle","juniper-ex-handle"),part("status",.721,.08,.042,.09,"psu0-status","juniper-ex-status"),
    part("panel",.787,.02,.177,.96,"spare-psu-cover","juniper-ex-psu-cover")],
    ports:[socket(device,53,.158,.645,.036,.212,"VCP0",.472,"qsfp",.037),socket(device,54,.203,.645,.036,.212,"VCP1",.472,"qsfp",.037),
      socket(device,55,.070,.345,.031,.254,"MGMT",.180,"rj45",.052),socket(device,56,.113,.550,.031,.254,"CON",.362,"rj45",.041),
      socket(device,58,.725,.265,.039,.548,"AC IN",.910,"juniper-ex-c14-portrait",.062)]};
}
