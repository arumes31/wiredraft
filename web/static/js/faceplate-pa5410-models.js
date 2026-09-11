import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const root = "https://docs.paloaltonetworks.com/hardware/pa-5400-hardware-reference/";
const frontSource = `${root}pa-5400-series-firewall-overview/pa-5400-series-front-and-back-panel-descriptions/pa-5400-series-front-panel`;
const rearSource = `${root}pa-5400-series-firewall-overview/pa-5400-series-front-and-back-panel-descriptions/pa-5400-series-back-panel`;
const allocations = new Map();
let profile;

/** Fit the documented 2U chassis into saved allocations without changing rack occupancy. */
export function resolvePA5410Faceplate(device) {
  if (device?.faceplate?.vendor !== "Palo Alto" || device.model !== "PA-5400 family") return null;
  if (!profile) { const canonical = canonicalFaceplateDevice(device); if (!canonical) return null; profile = buildProfile(canonical.device); }
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (!allocations.has(units)) {
    const body = 690 * 87.4 / 482.6, scale = Math.min(1, (units * 100 - 28) / body);
    const width = 440.4 / 482.6 * scale, height = body * scale;
    allocations.set(units, { ...profile, chassis: { x: (1 - width) / 2, y: .06 / units, width, height: (height + Math.min(16, height / 4)) / (units * 100) } });
  }
  return allocations.get(units);
}

/** Disclose the selected fixed chassis, physical cage numbering and compatible former endpoints. */
function buildProfile(device) {
  const configuration="PA-5410 fixed2U chassis with two PAN-PWR-1200W-AC supplies, three dual-rotor fan assemblies, covered system drive module, empty optical cages and no breakout endpoints.";
  return {id:"paloalto-pa5410",sku:"PA-5410",family:"PA-5410",fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source:frontSource,
    sourcePage:"Fixed PA-5410/5420/5430/5440/5445 front/back illustrations; physical and electrical tables",
    evidence:{scope:"model",models:["PA-5410"],catalogAlias:device.model,selectedModel:"PA-5410",configuration,front:frontSource,rear:rearSource,
      supplemental:[`${root}pa-5400-series-firewall-specifications/pa-5400-series-firewall-physical-specifications`,`${root}pa-5400-series-firewall-specifications/pa-5400-series-firewall-electrical-specifications`]},
    limitations:[configuration,"The source illustration is badged PA-5420 and explicitly applies to PA-5410. Modular PA-5450 cards are excluded. The four physical100G cages are41-44; logical breakout25-40 is not synthesized.",
      "Each rear assembly contains two in-line rotors. Only its single visible grille is drawn, with a diagonal handle; hidden blade geometry, small safety legends and mesh density are simplified.",
      "Old copper1-8 and25G ports21-24 retain matching physical numbers; RJ45 console27 maps to33. Unsupported copper9-16,optics17-20 and copper management25/26 stay unmapped. Optical management and HA are not reinterpreted as empty copper sockets.",
      "All saved inventory, IDs, settings, labels, cables and rack allocations remain unchanged. Native mechanical aspect is matched at690 under the existing normalized-width contract; smaller allocations scale the entire body."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,21:21,22:22,23:23,24:24,27:33},portLabels:{25:"MGMT1",26:"MGMT2",27:"CONSOLE"}}],
    faces:{front:frontPanel(device),rear:rearPanel()}};
}

/** Attach immutable socket identities and physical captions to the inspected front openings. */
function socket(device,index,x,y,kind,width=.030,height=.105,captionY=y<.75?.535:.962,captionWidth=.039) {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:index<=24?String(index):index<=28?String(index+16):({29:"HSCI",30:"HA1-A",31:"HA1-B",32:"MGT",33:"CON",34:"USB"})[index],
    x,y,width,height,connectorKind:kind,...(index<=8?{compatibleTypes:["RJ45_1G","RJ45_10G"]}:{}),
    descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Describe a source component without adding a network endpoint. */
function part(kind,x,y,width,height,role,variant,label) {return {kind,x,y,width,height,role,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the eight copper, sixteen small optical and five large optical openings with separate services. */
function frontPanel(device) {
  const ports=[],components=[part("text",.006,.015,.125,.11,"brand",undefined,"PALO ALTO"),part("text",.882,.018,.110,.10,"model",undefined,"PA-5410"),
    part("vent",.018,.17,.963,.29,"upper-intake","pa5410-mesh"),part("usb",.844,.727,.014,.14,"storage-usb"),
    part("module-bay",.918,.485,.076,.49,"drive-cover","pa5410-drive-cover")];
  for(let i=0;i<8;i++)ports.push(socket(device,i+1,.063+Math.floor(i/2)*.032,i%2?.84:.66,i%2?"rj45":"rj45-inverted"));
  for(let i=0;i<12;i++)ports.push(socket(device,i+9,.213+Math.floor(i/2)*.032,i%2?.84:.66,"sfp",.031,.108));
  for(let i=0;i<4;i++)ports.push(socket(device,i+21,.419+Math.floor(i/2)*.034,i%2?.84:.66,"sfp",.031,.108));
  for(let i=0;i<4;i++)ports.push(socket(device,i+25,.524+Math.floor(i/2)*.077,i%2?.84:.66,"qsfp",.044,.108,undefined,.050));
  ports.push(socket(device,29,.666,.84,"qsfp",.042,.108,.962,.05),
    socket(device,30,.719,.66,"sfp",.031,.108,.535,.048),socket(device,31,.719,.84,"sfp",.031,.108,.962,.048),
    socket(device,32,.767,.84,"sfp",.031,.108,.962,.044),socket(device,33,.813,.812,"rj45",.031,.112,.962,.042),
    socket(device,34,.874,.885,"usb-micro",.018,.034,.974,.032));
  for(let i=0;i<8;i++)components.push(part("led",.884+i%2*.013,.640+Math.floor(i/2)*.045,.006,.026,"status-indicator"));
  return {ports,components};
}

/** Show three replaceable dual-rotor assemblies between the separately positioned AC supplies. */
function rearPanel() {
  const components=[part("psu",.028,.477,.123,.485,"ac-supply","pa5410-ac"),part("psu",.857,.477,.123,.485,"ac-supply","pa5410-ac"),
    part("text",.027,.403,.120,.055,"supply-name",undefined,"PWR 1"),part("text",.856,.403,.120,.055,"supply-name",undefined,"PWR 2"),
    part("module-bay",.865,.065,.105,.090,"ground-lug","pa5410-ground"),part("button",.966,.265,.016,.078,"esd-socket")];
  for(const x of [.174,.405,.636])components.push(part("fan",x,.022,.187,.955,"fan-assembly","pa5410-fan"));
  return {ports:[],components};
}
