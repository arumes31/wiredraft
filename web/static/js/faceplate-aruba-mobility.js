import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const source = "https://arubanetworking.hpe.com/techdocs/hardware/controllers/7205/ig/7205-IG-EN.pdf";
let profile;

/** Resolve the disclosed 7205-RW configuration for the broad mobility-controller alias. */
export function resolveArubaMobilityFaceplate(device) {
  if (device?.faceplate?.vendor !== "HPE Aruba" || device.model !== "Mobility Controller family") return null;
  if (!profile) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    profile = build7205(canonical.device);
  }
  return profile;
}

/** Bind canonical identities to photographed physical ports while keeping historical serial types compatible. */
function socket(port, x, y, width, height, physicalLabel, captionY, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7 }, ...(connectorKind ? { connectorKind } : {}),
    ...(port.type === "USB_MICRO_CONSOLE" ? { compatibleTypes: ["USB_C_CONSOLE"] } : {}) };
}

/** Describe one source-positioned nonconnectable front or rear hardware element. */
function part(kind, x, y, width, height, variant, label) {
  return { kind, x, y, width, height, ...(variant ? { variant } : {}), ...(label ? { label } : {}) };
}

/** Record the exact fixed-power chassis and the separately modeled alternatives of its four dual-media interfaces. */
function build7205(device) {
  const ports=device.ports; const front=[];
  for (let index=0;index<4;index++) {
    front.push(socket(ports[index],.294+index*.12,.66,.032,.24,String(index),.89,"rj45-inverted"),
      socket(ports[4+index],.244+index*.12,.70,.034,.19,String(index),.89));
  }
  front.push(socket(ports[8],.73,.70,.032,.19,"4",.89),socket(ports[9],.764,.70,.032,.19,"5",.89),
    socket(ports[10],.963,.66,.032,.24,"MGMT",.89,"rj45-inverted"),
    socket(ports[11],.923,.80,.021,.07,"USB",.95,"usb-micro"),
    socket(ports[12],.881,.66,.032,.24,"CONSOLE",.89,"console-inverted"));
  const components=[part("vent",.01,.49,.207,.41,"aruba-7205-vent"),part("display",.871,.13,.086,.21,"aruba-7205-lcd"),
    part("button",.970,.13,.014,.075),part("button",.970,.30,.014,.075),
    part("usb",.814,.53,.012,.27),part("text",.012,.10,.08,.18,undefined,"aruba"),
    part("text",.790,.07,.038,.12,undefined,"7205"),
    ...Array.from({length:3},(_,index)=>part("led",.839,.16+index*.105,.004,.025))];
  const rear=[part("module-bay",.012,.06,.60,.88,"aruba-7205-cpu"),
    part("power",.824,.22,.065,.64,"ac-c14"),part("module-bay",.645,.18,.150,.62,"aruba-7205-label"),
    part("screw",.917,.22,.015,.12),part("screw",.917,.56,.015,.12),
    part("screw",.986,.83,.012,.09)];
  const configuration="JW735A 7205-RW: four 1G dual-media interfaces (four RJ45 plus four SFP sockets), two10G SFP+ interfaces, front management and RJ45/Micro-USB serial consoles, preinstalled7205-MCC-1 CPU module and one integrated180W AC supply.";
  return {id:"aruba-jw735a",sku:"JW735A",family:"Aruba7205",defaultFace:"front",fidelity:"model",
    panelFidelity:{front:"model",rear:"model"},inventoryComplete:true,rearHardwareVerified:true,inventoryRevision:1,
    source,sourcePage:"Installation PDF pages10–20; QuickSpecs page1 labeled7205 front/rear photographs; ordering guide page2",
    evidence:{scope:"model",models:["JW735A"],catalogAlias:device.model,selectedModel:"JW735A",configuration,
      front:"https://support.hpe.com/hpesc/public/api/document/c05272677#page=1",
      rear:"https://support.hpe.com/hpesc/public/api/document/c05272677#page=1",inventory:source,
      ordering:"https://support.hpe.com/hpesc/public/api/document/a00059065enw#page=2"},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2,3:3,4:4,9:9,10:10,13:11,14:12},portLabels:{13:"MGMT",14:"CONSOLE"}}],
    note:"The family alias selects the manufacturer's7205-RW fixed-power chassis; other controller models use different panels.",
    limitations:[configuration,"Each dual-media pair numbered0–3 is a single interface: SFP link takes precedence over copper. Both physical sockets are drawn for patch planning; this does not add switch-level exclusivity enforcement.",
      "The QuickSpecs is officially retired and used as historical hardware evidence. The rear has a fixed AC inlet and CPU drawer, without the removable supply/fan banks of7210/7220/7240.",
      "Relative panel topology is traced from the manufacturer's photographs. Side vents and internal cooling are outside the front/rear projection."],
    catalogDiscrepancies:["Old copper5–8 and optical11–12 have no equivalent installed sockets and stay unmapped. Old MGMT13 maps to11; USB-C console14 maps to physical Micro-USB12, preserving saved type/settings. The four1G SFP alternatives and RJ45 serial console13 are new only."],
    chassis:{x:.025,y:.04,width:.95,height:.92},faces:{front:{ports:front,components},rear:{ports:[],components:rear}}};
}
