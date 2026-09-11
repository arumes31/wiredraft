import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { buildCiscoCatalystModelFaceplate } from "./faceplate-cisco-catalyst-models.js";

const definitions = new Map([
  ["Catalyst 9200 family", {sku:"C9200L-48P-4X",series:9200,supply:"PWR-C5-1KWAC",frontPage:3,rearPage:8}],
  ["Catalyst 9300 family", {sku:"C9300L-48P-4X",series:9300,supply:"PWR-C1-715WAC-P",frontPage:8,rearPage:26}],
  ["Catalyst 9500 family", {sku:"C9500-48Y4C",series:9500,supply:"C9K-PWR-650WAC-R",frontPage:5,rearPage:16}],
]);
const cache=new Map();

/** Resolve an explicitly selected family SKU from canonical inventory without touching installed endpoints. */
export function resolveCatalystFamilyFaceplate(device) {
  const definition=definitions.get(device?.model);
  if (!definition || device.faceplate?.vendor!=="Cisco") return null;
  if (!cache.has(device.model)) {
    const canonical=canonicalFaceplateDevice(device);
    if (!canonical) return null;
    cache.set(device.model,buildProfile(canonical.device,definition));
  }
  return cache.get(device.model);
}

/** Record source scope, installed options and the real historical zone-ordered revision map. */
function buildProfile(device,definition) {
  const {sku,series,supply,frontPage,rearPage}=definition;
  const source=series===9200 ? "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/hardware/install/b-c9200-hig/product_overview.pdf"
    : series===9300 ? "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/hardware/install/b_c9300_hig/Product-overview.pdf"
    : "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9500/hardware/install/b_catalyst_9500_hig/9500_product-overview.pdf";
  const configuration=series===9500 ? `${sku}: fixed48 SFP28 and4 QSFP28; one ${supply} in PSU0, PSU1 and optional SATA SSD covered; two C9K-T1-FANTRAY units, front-to-back airflow.`
    : `${sku}: fixed48 PoE+ copper and4 SFP+ uplinks; one ${supply}, spare PSU covered; optional StackWise adapters uninstalled and covered; ${series===9200?"two fixed fans":"three FAN-T2 fan modules"}.`;
  const faces=series===9500 ? panels9500(device) : panelsL(device,definition);
  for (const face of Object.values(faces)) for (const slot of face.ports) {
    if(slot.portIndex===54) {slot.compatibleTypes=["USB_C_CONSOLE"];slot.connectorKind="usb-mini";}
  }
  return {id:`cisco-family-${sku.toLowerCase()}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryComplete:true,rearHardwareVerified:true,inventoryRevision:1,defaultFace:"front",source,
    sourcePage:`Product Overview PDF front page${frontPage}; rear page${rearPage}; model/power tables and series datasheet optional stack ordering`,
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,front:`${source}#page=${frontPage}`,rear:`${source}#page=${rearPage}`,
      supplemental:`https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-${series}-series-switches/nb-06-cat${series}-ser-data-sheet-cte-en.html`},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:52},(_,i)=>[i+1,i+1])),55:55,56:54},portLabels:{55:"MGMT",56:"CONSOLE"}}],
    catalogDiscrepancies:["Historical stack indices53/54 have no installed physical socket in this selected configuration and stay unmapped. Old management55 stays55; old USB-C56 maps to physical Mini-B54 without changing saved type. RJ45 console53 is new only."],
    limitations:[configuration,"The family alias selects this specific SKU and installed configuration. Other family SKUs/modules require different geometry. USB storage and power connectors are decorative.","Physical positions are traced from manufacturer illustrations; small printing is simplified for rack-scale rendering."],
    chassis:{x:0,y:.05,width:1,height:.9},faces};
}

/** Reuse the identical documented L-series geometry, adding local captions and source-specific rear hardware. */
function panelsL(device,definition) {
  const base=buildCiscoCatalystModelFaceplate({...device,model:`Catalyst ${definition.sku}`});
  const faces=structuredClone(base.faces);
  for(const [faceName,face] of Object.entries(faces)) {
    for(const slot of face.ports) {
      let y=slot.y+slot.height/2+.07; let width=.030;
      if(slot.portIndex<=48) y=slot.portIndex%2 ? .53 : .925;
      if(slot.portIndex>=49 && slot.portIndex<=52) y=.925;
      if(slot.portIndex===54) {y=.20;width=.058;slot.physicalLabel="USB";}
      if(faceName==="rear") {y=slot.portIndex===53?.535:.945;width=.046;}
      slot.descriptionAnchor={x:slot.x,y,fontSize:5.5,boxHeight:6,boxWidth:width};
    }
    for(const component of face.components) {
      if(faceName!=="rear") continue;
      if(component.kind==="fan") component.variant=definition.series===9200?"catalyst-9200-fixed-fan":"catalyst-9300-fan-t2";
      if(component.kind==="psu") {component.variant=definition.series===9200?"catalyst-c5-ac":"catalyst-c1-ac";component.supply=definition.supply;delete component.label;}
      if(component.label?.startsWith("STACK BAY")) {component.variant="catalyst-stack-cover";delete component.label;}
    }
  }
  return faces;
}

/** Bind a canonical socket to measured coordinates and its separate caption space. */
function socket(device,index,x,y,width,height,label,captionY,captionWidth=.029) {
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,
    descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:6,boxWidth:captionWidth}};
}

/** Describe one measured piece of nonconnectable hardware. */
function part(kind,x,y,width,height,variant,label) {
  return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}: {})};
}

/** Trace the 48Y4C optical banks, left service cluster and two-tray rear without borrowing the five-fan 32C chassis. */
function panels9500(device) {
  const ports=[];
  for(let i=0;i<48;i++) ports.push(socket(device,i+1,.120+Math.floor(i/2)*.0323+(i>=24?.012:0),i%2?.70:.36,.029,.24,String(i+1),i%2?.925:.53));
  for(let i=0;i<4;i++) ports.push(socket(device,i+49,.917+Math.floor(i/2)*.044,i%2?.70:.36,.040,.24,String(i+49),i%2?.925:.53,.040));
  ports.push(socket(device,55,.049,.36,.029,.24,"MGMT",.535,.044),socket(device,53,.049,.74,.029,.24,"CONSOLE",.945,.062),
    socket(device,54,.083,.19,.022,.075,"USB",.295,.025));
  const components=[part("vent",.103,.025,.878,.115,"mesh"),part("usb",.079,.48,.014,.32),
    part("text",.031,.015,.047,.070,undefined,"CISCO"),part("button",.079,.025,.008,.070),
    ...Array.from({length:4},(_,i)=>part("led",.071,.41+i*.1,.004,.027))];
  const rear=[part("module-bay",.018,.035,.222,.93,"blank","PSU 1 COVER"),
    part("screw",.252,.15,.012,.09),part("screw",.252,.53,.012,.09),
    part("fan",.280,.035,.188,.93,"catalyst-9500-fantray"),part("fan",.489,.035,.188,.93,"catalyst-9500-fantray"),
    part("module-bay",.694,.055,.043,.88,"catalyst-9500-ssd-cover"),
    part("psu",.752,.035,.229,.93,"catalyst-9500-ac")];
  return {front:{ports,components},rear:{ports:[],components:rear}};
}
