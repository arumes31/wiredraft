import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"EX4100 family":{sku:"EX4100-48P",height:43.7,width:440.9,rack:482.6,depth:382.4,source:"https://www.juniper.net/documentation/us/en/hardware/ex4100/ex4100.pdf",pages:"PDF34 fig12;35 fig13/base table;36 dimensions;67–71 PSU",
  configuration:"EX4100-48P with four front10G SFP+ uplinks and four separate25G SFP28 Virtual Chassis ports, empty optical cages, one factory JPSU-920-AC-AFO inPSU0, PSU1 covered, two supplied AIR OUT fan modules and supplied front rack ears. USB-C console on front; MGMT, RJ45 console and USB-A storage on rear. Native43.7mm chassis; nominal19in bracket span482.6mm. The rear diagram with one supply and its factory shipment table govern population, rather than the separate dual-PSU photograph."},
  "EX4300 family":{sku:"EX4300-48P",height:43.7,width:441,rack:482,depth:457.3,source:"https://www.juniper.net/documentation/us/en/hardware/ex4300/ex4300.pdf",pages:"PDF23 base hardware;30 uplink module;38 fig11;39 fig13;63 dimensions;96 fan;104 PSU;117 C15 cord;122 fig43",
    configuration:"EX4300-48P with installed optional EX-UM-4X4SFP four10G uplink module, four rear40G QSFP+ Virtual Chassis ports and no optics. Factory JPSU-1100-AC-AFO-A inPSU0 plus an identical optional supply inPSU1, two EX4300-FAN AIR OUT modules and supplied rack brackets. Two source high-temperature C16 inlets accept C15 cords. Front Mini-USB console and inactive LCD; rear RJ45 management/console and USB-A storage. Selected dual-PSU configuration follows figure13 and documented1100W+1100W power table; the second supply and uplink module are explicitly installed options."}};
const cache=new Map();

/** Resolve only EX4100/EX4300 aliases and fit the native1U body inside unchanged larger saved allocations. */
export function resolveJuniperEXNextFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Record exact selected hardware and type-guarded revision maps from the executed frozen438 constructor. */
function buildProfile(device,s) {
  const ex4100=s.sku==="EX4100-48P",body=690*s.height/s.rack,portIndexMap=Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,i+1]));
  portIndexMap[59]=57;if(ex4100)Object.assign(portIndexMap,{49:53,50:54,51:55,52:56,60:58});else Object.assign(portIndexMap,{57:53,58:54});
  return {id:`juniper-ex-next-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,
    defaultFace:"front",rearHardwareVerified:true,source:s.source,sourcePage:s.pages,note:s.configuration,
    evidence:{scope:"model",models:[s.sku],catalogAlias:device.model,selectedModel:s.sku,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.source,rear:s.source,
      physicalDimensions:{heightMm:s.height,widthMm:s.width,rackWidthMm:s.rack,depthMm:s.depth}},
    limitations:[s.configuration,"All LEDs and LCDs are inactive artwork; empty optical cages do not assert installed transceivers. USB-A storage is ancillary, not a new logical interface.",
      "Executed snapshot438 constructor:48 copper, SFP28_25G49–56,40G Stack57/58,MGMT59,USB_C_CONSOLE60 in1U. EX4100 maps only49–52 to its four25G VCP-capable cages plus compatible copper,MGMT andUSB-C; old40G Stack and excess25G remain unmapped. EX4300 maps two40G Stack entries to actualVCP0/1 plus copper/MGMT; old25G andUSB-C remain unmapped.",
      "Factory VCP role is physical metadata; existing speed/role/VLAN/PoE settings and cable objects are never changed. New RJ45 console, power and other verified endpoints occur only on new instances. Missing logical endpoints remain noninteractive canonical socket artwork; unknown revisions and incompatible edited types remain unmapped."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{...Object.fromEntries(Array.from({length:56},(_,i)=>[i+1,String(i+1)])),57:"VC1",58:"VC2",59:"MGMT",60:"CONSOLE"}}],
    chassis:{x:0,y:.1,width:1,height:(body<64?body/.8:body+16)/100},faces:ex4100?{front:ex4100Front(device),rear:ex4100Rear(device)}:{front:ex4300Front(device),rear:ex4300Rear(device)}};
}

/** Describe an inactive source-local ancillary rectangle in normalized chassis coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Convert traced top-left socket extents to the scene's center convention and bind immutable canonical identity. */
function socket(device,index,x,y,width,height,label,captionY,kind="rj45",captionWidth=.035) {
  const p=device.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add only the supplied front ears, with source slotted upper/lower holes and central fastener. */
function ears(components) {for(const x of [.001,.963])components.push(part("rack-ear",x,.015,.036,.97,`rack-ear-${x<.5?"left":"right"}`,"juniper-ex-next-ear"));}

/** Trace EX4100's three16-port banks, separate2x2 VCP/uplink blocks,8status lamps andUSB-C console. */
function ex4100Front(d) {
  const components=[part("vent",.06,.015,.68,.10,"front-intake","juniper-ex-next-mesh"),part("text",.055,.04,.10,.09,"model-mark",undefined,{text:"EX4100 PoE+",fontSize:5}),
    part("status",.921,.14,.030,.36,"front-status","juniper-ex-next-status8"),part("button",.922,.557,.012,.09,"factory-reset-mode"),part("button",.741,.57,.007,.065,"reset")];ears(components);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.054+col*.028+Math.floor(col/8)*.009,n%2?.635:.290,.0245,.235,String(n),n%2?.928:.190,"rj45",.0245));}
  for(let n=0;n<4;n++) {
    ports.push(socket(d,53+n,.765+Math.floor(n/2)*.035,n%2?.670:.330,.030,.18,`V${n}`,n%2?.915:.210,"sfp",.031));
    ports.push(socket(d,49+n,.837+Math.floor(n/2)*.035,n%2?.670:.330,.030,.18,String(n),n%2?.915:.210,"sfp",.031));
  }
  ports.push(socket(d,58,.922,.725,.028,.11,"CON",.925,"usb-c",.034));return {components,ports};
}

/** Trace the EX4100 one-supply rear figure, including orange AFO hardware and the source-covered spare bay. */
function ex4100Rear(d) {
  return {components:[part("usb",.073,.63,.029,.10,"usb-storage"),part("panel",.153,.38,.026,.28,"claim-code","juniper-ex-next-label"),
    part("fan",.199,.03,.092,.94,"chassis-fan-1","juniper-ex-next-fan4100"),part("fan",.303,.03,.092,.94,"chassis-fan-2","juniper-ex-next-fan4100"),
    part("button",.464,.155,.011,.11,"earth-1"),part("button",.497,.155,.011,.11,"earth-2"),part("button",.464,.485,.016,.15,"esd"),
    part("panel",.510,.53,.060,.16,"clei-label","juniper-ex-next-label"),part("panel",.510,.76,.060,.13,"serial-label","juniper-ex-next-label"),
    part("fan",.615,.075,.073,.82,"psu0-fan","juniper-ex-next-psu4100"),part("panel",.690,.08,.012,.78,"psu0-handle","juniper-ex-next-orange-handle"),
    part("status",.711,.06,.041,.09,"psu0-leds","juniper-ex-next-status2"),part("panel",.778,.03,.163,.94,"spare-psu-cover","juniper-ex-next-cover4100")],
    ports:[socket(d,57,.073,.295,.030,.26,"MGMT",.14,"rj45",.051),socket(d,59,.117,.46,.030,.26,"CON",.285,"rj45",.036),
      socket(d,60,.712,.27,.039,.545,"AC IN",.92,"juniper-ex-next-c14-portrait",.062)]};
}

/** Trace EX4300's four12-port banks, inactive LCD/menus and explicitly installed EX-UM-4X4SFP module. */
function ex4300Front(d) {
  const components=[part("vent",.060,.015,.729,.105,"front-intake","juniper-ex-next-mesh"),part("panel",.835,.12,.067,.255,"lcd","juniper-ex-next-lcd"),
    part("button",.914,.19,.012,.11,"lcd-menu"),part("button",.914,.40,.012,.11,"lcd-enter"),part("status",.937,.17,.014,.30,"front-status","juniper-ex-next-status3"),
    part("panel",.818,.53,.127,.025,"uplink-module-top","juniper-ex-next-edge"),part("panel",.818,.990,.127,.007,"uplink-module-bottom","juniper-ex-next-edge"),
    part("screw",.807,.72,.010,.09,"uplink-module-left-screw"),part("screw",.948,.72,.010,.09,"uplink-module-right-screw")];ears(components);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.052+col*.02955+Math.floor(col/6)*.0075,n%2?.635:.290,.0265,.235,String(n),n%2?.928:.190,"rj45",.0265));}
  for(let n=0;n<4;n++)ports.push(socket(d,49+n,.820+n*.032,.643,.028,.205,String(n),.921,"sfp",.029));
  ports.push(socket(d,59,.800,.095,.019,.093,"USB",.335,"usb-mini",.033));return {components,ports};
}

/** Trace EX4300 rear management stack, fourQSFP+ VCPs between fans and the selected two1100W supplies. */
function ex4300Rear(d) {
  const components=[part("button",.106,.16,.014,.14,"esd"),part("usb",.107,.535,.011,.265,"usb-storage"),
    part("fan",.142,.04,.102,.93,"chassis-fan-1","juniper-ex-next-fan4300"),part("fan",.449,.04,.102,.93,"chassis-fan-2","juniper-ex-next-fan4300"),
    part("vent",.319,.06,.106,.245,"center-exhaust","juniper-ex-next-mesh"),part("panel",.258,.34,.060,.11,"serial-label","juniper-ex-next-label")];
  const ports=[socket(d,57,.066,.275,.030,.25,"MGMT",.12,"rj45",.048),socket(d,58,.066,.610,.030,.25,"CON",.94,"rj45",.038)];
  for(let n=0;n<4;n++)ports.push(socket(d,53+n,.265+n*.043,.565,.039,.24,`VCP${n}`,.914,"qsfp",.042));
  for(let n=0;n<2;n++) {
    const x=.568+n*.196;components.push(part("vent",x,.22,.096,.67,`psu${n}-fan`,"juniper-ex-next-psu4300"),part("panel",x+.097,.095,.014,.79,`psu${n}-handle`,"juniper-ex-next-handle"),
      part("status",x+.009,.06,.044,.11,`psu${n}-leds`,"juniper-ex-next-status2"),part("panel",x+.185,.04,.003,.93,`psu${n}-divider`,"juniper-ex-next-edge"));
    ports.push(socket(d,60+n,x+.117,.285,.065,.445,`PSU${n}`,.885,"juniper-ex-next-c16",.070));
  }
  return {components,ports};
}
