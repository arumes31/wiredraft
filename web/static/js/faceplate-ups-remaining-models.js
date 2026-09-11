import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const cyberSource="https://www.cyberpowersystems.com/product/ups/smart-app-sinewave/pr1500lcdrt2u/";
const cyberData="https://images.salsify.com/image/upload/s--RTx2RxZj--/f9e66b98c2063651a64b3e02c2fe76d67cba5863.pdf";
const cyberCard="https://images.salsify.com/image/upload/s--E0Fbvgth--/08087acda5124c0d10be8209a34e40d9ca3b9b02.pdf";
const vertivSource="https://www.vertiv.com/4977d4/globalassets/products/critical-power/uninterruptible-power-supplies-ups/vertiv-liebert-gxt5-ups-1500-10000va-230vac-ups--international-models/vertiv-liebert-gxt5-installer-user-guide-230v-sl-70547.pdf";
const vertivFront="https://www.vertiv.com/48ef0e/globalassets/shared/liebert-gxt5-750-3000kva-emea-en-mka4l0ukgxt5m-rev4-112023-web.pdf";
const vertivCard="https://www.vertiv.com/globalassets/shared/liebert-intellislot-rdu101-communications-card-installeruser-guide.pdf";
const selections={
  CyberPower:{model:"Smart App UPS family",sku:"PR1500LCDRT2U",height:88.9,width:438.15,depth:400.05,prefix:"RMCARD",source:cyberSource,front:cyberData,rear:cyberSource,card:cyberCard,
    configuration:"CyberPower PR1500LCDRT2U 120V 1500VA/1350W rack configuration, LCD on the right as shown in the1350W datasheet and2025 product photos. Installed RMCARD20510/100 card, with its Universal RJ45 reserved for local serial CLI and no environmental sensor. Eight NEMA5-15R battery-backed outlets: four noncritical and four critical. Captive10ft NEMA5-15P input cord, one input and two output breakers, one fixed rear fan. USB-B and both UPS DB9 connectors are monitoring interfaces. Passive RJ45/RJ11 and F-coax surge pairs and RJ11 EPO remain ancillary. Internal four12V/7Ah VRLA batteries; no external battery cabinet."},
  Vertiv:{model:"Liebert UPS family",sku:"GXT5-1500IRT2UXL",height:85,width:430,depth:470,prefix:"UNITY",source:vertivSource,front:vertivFront,rear:vertivSource,card:vertivCard,
    configuration:"Vertiv Liebert GXT5-1500IRT2UXL base SKU,230V1500VA/1500W,2U rack orientation, explicitly field-installed RDU10110/100 management card. Eight C13 outputs from2024 manual Fig2.4: two non-programmable and six programmable; vertical C14 input and10A input breaker. Native RJ45 RS232 CLI, USB-B monitoring, RS485 temperature sensor and terminal dry-contact block. RDU101 sensor and USB-A storage remain ancillary. Internal GXT5-48VBATKIT VRLA battery; no external battery cabinet, maintenance bypass or sensors. Rear hexagonal ventilation holes conceal the cooling internals; no exposed fan rotor is invented."}
};
const profiles=new Map();

/** Resolve only the two explicit UPS aliases while fitting the real rack body to each preserved allocation. */
export function resolveRemainingUPSFaceplate(device) {
  const selected=selections[device?.faceplate?.vendor];
  if(!selected||device.model!==selected.model||device.category!=="Server")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!profiles.has(canonical.catalog))profiles.set(canonical.catalog,{profile:buildProfile(canonical.device,selected),allocations:new Map()});
  const cached=profiles.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||2);if(units===2)return cached.profile;
  if(!cached.allocations.has(units)) {
    const scale=Math.min(1,units/2),body=(200*cached.profile.chassis.height-16)*scale,raw=body<64?body/.8:body+16;
    cached.allocations.set(units,{...cached.profile,chassis:{x:(1-scale)/2,y:.10*Math.min(1,2/units),width:scale,height:raw/(units*100)}});
  }
  return cached.allocations.get(units);
}

/** Record the selected hardware revision and preserve the two historical endpoint indices without inference. */
function buildProfile(device,s) {
  const cyber=device.faceplate.vendor==="CyberPower";
  return {id:cyber?"cyberpower-pr1500lcdrt2u-rmcard205":"vertiv-gxt5-1500irt2uxl-rdu101",family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryRevision:1,inventoryComplete:true,defaultFace:"rear",rearHardwareVerified:true,source:s.source,sourcePage:cyber?"1350W datasheet pp1–2; product front/rear photos; RMCARD205 manual pp2/33":"GXT5 manual Fig2.4 printed p7; brochure p1; RDU101 manual Fig1.1",
    evidence:{scope:"model",models:[s.model],sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.front,rear:s.rear,card:s.card,
      physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:483},revision:cyber?"1350W / right-side LCD / RMCARD205":"SL-70547 2024 eight-outlet chassis / optional RDU101"},note:s.configuration,
    limitations:[s.configuration,"The family alias selects this exact installed configuration. LCDs, status lights and ancillary connectors are inactive artwork; no simulated runtime voltage, load or operating status is shown.",
      "New management interfaces use100Mbps with the editor's existing RJ45_1G copper enum. Historical1000Mbps values, endpoint types, IDs, names, settings, full cable references and rack allocations are preserved.",
      "Revision0 explicitly maps network1 and power2 only. Console3 is available only in newly created revision1 inventories. Unsupported types and unknown inventory revisions remain unmapped.",
      "Output receptacles, USB monitoring/storage, sensors, battery expansion and relay/surge connectors remain ancillary because this editor has no matching endpoint types. A generic Console or Ethernet port is not substituted.",
      cyber?"The older linked1000W manual has a different left-side LCD. Its common connector-role descriptions are corroborated by the selected1350W rear photo; its old front geometry and power rating are not used.":"The base GXT5 SKU plus explicitly installed RDU101 avoids the N-suffix bundle ambiguity between RDU101 and RDU120 in different manufacturer brochure revisions."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2},portLabels:{1:`${s.prefix}1`,2:"AC1"}}],
    catalogDiscrepancies:["Original endpoint1 remains management and2 input power. New console3 does not enlarge saved inventories.","Output receptacles are visible ancillary hardware; the historical single power endpoint represents the input."],
    chassis:{x:0,y:.10,width:1,height:(690*s.height/483+16)/200},faces:{front:{components:[part("panel",.01,.055,.98,.89,"front-bezel",cyber?"pr1500-front":"gxt5-front")],ports:[]},rear:cyber?cyberRear(device):vertivRear(device)}};
}

/** Create inactive, source-traced ancillary hardware without adding logical inventory endpoints. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind a canonical physical socket to an immutable index and a caption separate from editable names. */
function socket(device,index,x,y,width,height,physicalLabel,captionX,captionY,connectorKind="rj45") {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel,x,y,width,height,connectorKind,
    descriptionAnchor:{x:captionX??x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:.058}};
}

/** Frame an installed card with narrow edges so its real sockets remain unobscured. */
function cardFrame(components,x,y,width,height,role) {
  components.push(part("panel",x,y,width,.008,`${role}-top`),part("panel",x,y+height-.008,width,.008,`${role}-bottom`),
    part("panel",x,y,.003,height,`${role}-left`),part("panel",x+width-.003,y,.003,height,`${role}-right`));
}

/** Trace the PR1500's output banks, input cord, fixed fan and installed RMCARD205 from the product rear photo. */
function cyberRear(device) {
  const components=[],ports=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)components.push(part("power",[.045,.144,.314,.413][col],.105+row*.43,.083,.354,`${col<2?"noncritical":"critical"}-outlet-${row*4+col+1}`,"pr1500-nema15",{critical:col>=2}));
  for(const y of [.257,.689])components.push(part("button",.251,y,.033,.115,"output-15A-breaker","ups-breaker"));
  cardFrame(components,.519,.08,.143,.34,"rmcard205");
  ports.push(socket(device,1,.618,.27,.028,.105,"RMCARD",.618,.491),socket(device,3,.556,.27,.028,.105,"CARD CLI",.552,.491));
  components.push(part("coax",.687,.111,.023,.10,"coax-surge-in"),part("coax",.720,.111,.023,.10,"coax-surge-out"),
    part("usb",.625,.565,.025,.115,"ups-usb-monitor","ups-usb-b"),part("rj11",.680,.550,.026,.12,"epo-rj11"),
    part("db9",.517,.757,.075,.13,"primary-powerpanel-monitor"),part("db9",.614,.757,.075,.13,"secondary-contact-closure-monitor"),
    part("rj45",.708,.758,.026,.118,"passive-surge-in"),part("rj45",.746,.758,.026,.118,"passive-surge-out"),
    part("button",.782,.110,.031,.14,"input-15A-breaker","ups-breaker"),part("fan",.854,.08,.130,.82,"fixed-cooling-fan","pr1500-fan"));
  ports.push(socket(device,2,.800,.53,.040,.22,"AC CORD",.811,.866,"cyberpower-captive-input"));
  return {components,ports};
}

/** Trace the exact1500VA rear figure, eight outputs and an RDU101 fitted in the left IntelliSlot bay. */
function vertivRear(device) {
  const components=[],ports=[];cardFrame(components,.021,.055,.175,.390,"rdu101");
  ports.push(socket(device,1,.054,.294,.030,.106,"RDU101",.054,.537),socket(device,3,.114,.776,.028,.103,"RS232 CLI",.112,.941),
    socket(device,2,.604,.531,.061,.354,"AC IN",.604,.870,"gxt5-c14"));
  components.push(part("rj45",.099,.241,.030,.106,"rdu101-sensor"),part("usb",.166,.209,.015,.165,"rdu101-usb-storage"),
    part("button",.166,.105,.012,.044,"rdu101-reset"),part("led-strip",.102,.111,.030,.033,"rdu101-status","rdu101-status-indicator"),
    part("vent",.219,.075,.233,.74,"rear-hex-vent","gxt5-hex-vent"),part("module-bay",.488,.111,.050,.354,"external-battery-connector","gxt5-ebc"),
    part("button",.493,.648,.041,.177,"input-10A-breaker","ups-breaker"),part("usb",.025,.721,.025,.11,"ups-usb-monitor","ups-usb-b"),
    part("rj45",.064,.721,.028,.11,"native-rs485-temperature-sensor"),part("terminal-block",.143,.621,.054,.229,"dry-contact-terminals","gxt5-terminal"));
  for(let row=0;row<2;row++)components.push(part("power",.672,.223+row*.287,.073,.238,`nonprogrammable-c13-${row+1}`,"gxt5-c13"));
  for(let row=0;row<3;row++)for(let col=0;col<2;col++)components.push(part("power",.786+col*.09,.083+row*.281,.073,.238,`programmable-c13-${row*2+col+1}`,"gxt5-c13"));
  return {components,ports};
}
