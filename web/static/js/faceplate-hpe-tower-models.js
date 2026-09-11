import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const support = "https://support.hpe.com/hpesc/public/api/document/";
const definitions = {
  "ProLiant ML30": { key: "ml30", sku: "P65090-B21", units: 5, bodyMm: 175.3, widthMm: 368.3, source: "a50007008enw", frontPage: 3, rearPage: 5, kit: "874578-B21" },
  "ProLiant ML110": { key: "ml110", sku: "P51518-B21", units: 6, bodyMm: 195, widthMm: 445, source: "a00054055enw", frontPage: 2, rearPage: 3, kit: "P47394-B21" },
  "ProLiant ML350": { key: "ml350", sku: "P48405-B21", units: 5, bodyMm: 174, widthMm: 445, source: "a50004308enw", frontPage: 3, rearPage: 4, kit: "P47394-B21" },
};
const cache = new Map();

/** Fit each selected rack-converted tower into its saved allocation without changing endpoint inventory or rack placement. */
export function resolveHPETowerFaceplate(device) {
  const definition = definitions[device?.model];
  if (!definition || device.faceplate?.vendor !== "HPE" || device.category !== "Server") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, { profile: buildProfile(canonical.device, definition), allocations: new Map() });
  const cached = cache.get(canonical.catalog);
  const units = Math.max(1, Number(device.faceplate.unitsU) || definition.units);
  if (units === definition.units) return cached.profile;
  if (!cached.allocations.has(units)) {
    const scale = Math.min(1, units / definition.units);
    const bodyHeight = definition.units * 100 * cached.profile.chassis.height - 16;
    cached.allocations.set(units, { ...cached.profile, chassis: { x: (1-scale)/2, y: .04*Math.min(1,definition.units/units),
      width: scale, height: (bodyHeight*scale+16)/(units*100) } });
  }
  return cached.allocations.get(units);
}

/** Declare exact installed options and revision maps; the catalog alias never implies all generations or possible tower options. */
function buildProfile(device, d) {
  const small = d.key === "ml30"; const medium = d.key === "ml110";
  const configuration = `${device.model} Gen11 ${d.sku}, ${d.kit} rack tray, ` + (small
    ? "four 801882-B21 1TB SATA NHP disks behind the factory 4LFF cage grille, embedded VROC/SATA, E-2434 CPU, P45212-B21 350W nonredundant ATX supply, embedded BCM5719 four 1Gb NICs and P65741-B21 dedicated iLO/COM kit with serial cable installed. "
    : `eight P40498-B21 960GB SATA Basic Carrier SSDs in ${medium ? "Box1" : "Box3"}, embedded VROC/SATA${medium ? "" : " with P47232-B21 SFF SATA cable kit"}, one 4410Y CPU, two P38995-B21 800W Platinum FlexSlot supplies, ${medium ? "embedded BCM5720 dual 1Gb NICs" : "P51181-B21 BCM5719 four 1Gb OCP3 adapter in slot15"} and dedicated iLO. `) +
    "Access panel faces up; feet and front security bezel removed. Optional optical/tape, boot device, M.2 and additional PCIe cards are absent. " +
    (small ? "Both media bays are covered; front PCI fan is absent in this NHP configuration. " : "Unused drive cages, serial and OCP positions are covered. ") +
    `Physical chassis ${d.widthMm}mm wide × ${d.bodyMm}mm high in rack orientation plus 44.45mm tray. ` +
    (medium ? "The 5.5U rack assembly reserves 6U for new devices. " : "New devices reserve 5U including the 1U tray. ") +
    "Saved rack allocations and every saved connection remain unchanged; smaller saved allocations show a proportionally reduced drawing.";
  return { id: `hpe-${d.key}-gen11-rack`, family: `${device.model} Gen11`, fidelity: "model", inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "rear", inventoryRevision: 1, rearHardwareVerified: true,
    sku: `${device.model} Gen11 · ${d.sku} · ${d.kit} tray`, source: support+d.source,
    sourcePage: `QuickSpecs front page${d.frontPage}, rear page${d.rearPage}; CTO, unique options and physical dimensions tables`,
    evidence: { scope: "model", models: [device.model], sku: d.sku, reviewed: "2026-09-11", configuration,
      front: `${support}${d.source}#page=${d.frontPage}`, rear: `${support}${d.source}#page=${d.rearPage}`,
      rack: "https://support.hpe.com/hpesc/public/docDisplay?docId=sd00002643en_us&page=GUID-773E4FCE-955A-4C64-AB5B-28A550B677F7.html",
      power: "https://www.hpe.com/us/en/collaterals/collateral.c04346217.html",
      powerPhoto: small ? `${support}${d.source}#page=5` : "https://assets.ext.hpe.com/is/image/hpedam/s00004154?$zoom$",
      physicalDimensions: { chassisWidthMm: d.widthMm, chassisHeightMm: d.bodyMm, trayHeightMm: 44.45 },
    }, note: configuration, limitations: [configuration,
      "Source-relative orthographic drawing; perspective, internal hardware, live indicator state and shelf depth are outside this panel projection.",
      "Front iLO Service USB-A is ancillary maintenance hardware, not a serial console or direct Ethernet socket."],
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: medium ? {1:1,2:2,5:3} : {1:1,2:2,3:3,4:4,5:5},
      portLabels: {1:"NIC1",2:"NIC2",3:"NIC3",4:"NIC4",5:"iLO1"} }],
    catalogDiscrepancies: ["Historical 10Gb NIC endpoints retain saved IDs, types, speeds, names and settings on the selected 1Gb sockets.",
      medium ? "Old NIC3/4 remain unmapped; old iLO5 maps explicitly to new physical iLO3. No old inventory is silently replaced." : "Existing network and iLO indices remain unchanged.",
      small ? "Serial6 is the selected kit's DB9 cable connector and is added only to new revision1 instances." : "Optional serial is covered and is not a connectable endpoint.",
      "New rack allocations include the tray; old2U allocations and placements are preserved."],
    chassis: {x:0,y:.04,width:1,height:(690*(d.bodyMm+44.45)/452+16)/(d.units*100)},
    faces: small ? {front: rackFace(frontML30(), d, false), rear:rackFace(rearML30(device),d,true)}
      : medium ? {front:rackFace(frontML110(),d,false),rear:rackFace(rearML110(device),d,true)}
        : {front:rackFace(frontML350(),d,false),rear:rackFace(rearML350(device),d,true)},
  };
}

/** Represent an ancillary component using its measured tower front/rear bounds before rotating the physical panel. */
function part(kind,x,y,width,height,role,variant) {
  return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{})};
}

/** Bind canonical index and connector type, accepting only the explicitly known historical copper type. */
function socket(device,index,x,y,width,height,label) {
  const port=device.ports.find((p)=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,x,y,width,height,physicalLabel:label,
    connectorKind:port.type==="Console"?"db9":"rj45",...(port.type==="RJ45_1G"?{compatibleTypes:["RJ45_10G"]}:{})};
}

/** Rotate front counterclockwise and rear clockwise with the access panel up; reserve the tray and keep ML30's iLO caption above its fixed kit sockets. */
function rackFace(face,d,rear) {
  const bodyHeight=d.bodyMm/(d.bodyMm+44.45); const bodyWidth=d.widthMm/452; const inset=(1-bodyWidth)/2;
  const transform=(p,center=false)=>({ ...p,
    x:inset+(rear?1-p.y-(center?0:p.height):p.y)*bodyWidth,
    y:(rear?p.x:1-p.x-(center?0:p.width))*bodyHeight,
    width:p.height*bodyWidth,height:p.width*bodyHeight,
  });
  const components=face.components.map((p)=>transform(p));
  components.push(part("module-bay",0,bodyHeight+.025,1,1-bodyHeight-.025,"rack-tray"));
  for(const x of [.01,.975]) components.push(part("screw",x,bodyHeight+.10*(1-bodyHeight),.014,.10*(1-bodyHeight),"tray-captive-screw"));
  const ports=face.ports.map((p)=>{
    const placed=transform(p,true);
    return {...placed,descriptionAnchor:{x:placed.x,
      y:d.key==="ml30"&&[3,5].includes(p.portIndex)?.035:d.key==="ml30"&&p.portIndex===4?.29:
        placed.y+placed.height/2+(d.key==="ml110"?.035:.052),fontSize:5.5,boxHeight:7}};
  });
  return {components,ports};
}

/** Draw ML30's two full media covers, central service strip, covered NHP drive cage and lower perforation. */
function frontML30() {
  const components=[part("module-bay",.075,.045,.85,.105,"upper-media-blank"),part("module-bay",.075,.165,.85,.105,"lower-media-blank"),
    part("usb",.18,.307,.085,.022,"ilo-service"),part("usb",.32,.307,.085,.022,"usb-storage"),
    part("module-bay",.47,.305,.17,.06,"boot-device-blank"),part("vent",.095,.41,.82,.275,"nhp-drive-cage-grille"),
    part("vent",.31,.735,.50,.205,"front-airflow")];
  for(const [i,role] of ["status-uid","status-nic","status-health","status-power"].entries()) components.push(part(i===0||i===3?"button":"led",.65+i*.055,.307,.025,.012,role));
  return {components,ports:[]};
}

/** Draw ML30's photographed350W ATX fan/inlet, embedded four NIC arrangement, optional installed iLO/serial kit and four PCIe covers. */
function rearML30(device) {
  const components=[part("module-bay",.12,.025,.78,.24,"atx-supply-frame"),part("fan",.135,.035,.47,.205,"power-supply-fan"),
    part("power",.70,.155,.17,.052,"power-supply-inlet","ac-c14"),part("vent",.42,.385,.45,.24,"rear-system-fan-grille"),
    part("vga",.12,.50,.045,.073,"vga"),part("displayport",.12,.61,.043,.055,"displayport")];
  for(const y of [.31,.39]) for(const x of [.12,.168]) components.push(part("usb",x,y,.035,.04,"usb-storage"));
  for(let i=0;i<4;i++) components.push(part("module-bay",.12,.735+i*.058,.61,.046,`pcie-slot-${i+1}-cover`));
  return {components,ports:[socket(device,1,.265,.335,.065,.043,"1"),socket(device,2,.265,.415,.065,.043,"2"),
    socket(device,3,.125,.472,.065,.043,"3"),socket(device,4,.21,.472,.065,.043,"4"),
    socket(device,5,.16,.695,.067,.042,"iLO"),socket(device,6,.265,.555,.065,.10,"SERIAL")]};
}

/** Add the shared Gen11 top strip without conflating each model's distinct lower cage arrangement. */
function frontStrip() {
  const components=[part("displayport",.22,.025,.072,.020,"displayport"),part("usb",.34,.025,.07,.022,"usb-storage"),
    part("usb",.435,.025,.07,.022,"ilo-service"),part("module-bay",.10,.065,.79,.032,"optical-blank")];
  for(const [i,role] of ["status-uid","status-nic","status-health","status-power"].entries()) components.push(part(i===0||i===3?"button":"led",.57+i*.047,.029,.019,.011,role));
  return components;
}

/** Trace eight Basic Carriers in their tower-native vertical orientation; rack conversion turns them horizontal. */
function carrierBank(y,height) {
  return Array.from({length:8},(_,index)=>({...part("drive-carrier",.105+index*.098,y,.09,height,"sata-drive","hpe-basic"),driveNumber:index+1}));
}

/** Draw ML110's populated upperBox1, coveredBox2 and separate visible lower front fan. */
function frontML110() {
  return {components:[...frontStrip(),part("module-bay",.10,.11,.79,.09,"media-blank"),part("vent",.11,.215,.77,.043,"box1-grille"),
    ...carrierBank(.275,.175),part("vent",.10,.48,.79,.21,"box2-blank"),part("fan",.23,.725,.57,.21,"front-system-fan")],ports:[]};
}

/** Draw ML350's two covered upper cages and sole populated bottomBox3, without inventing the ML110's front fan. */
function frontML350() {
  return {components:[...frontStrip(),part("vent",.10,.115,.79,.195,"box1-blank"),part("vent",.10,.325,.79,.075,"media-blank"),
    part("vent",.10,.425,.79,.235,"box2-blank"),part("vent",.11,.682,.77,.043,"box3-grille"),...carrierBank(.745,.20)],ports:[]};
}

/** Place the specifically photographedP38995 supply pair; its fan-left/C14-right artwork is already rack-oriented. */
function supplies() {
  return [0,1].map((index)=>({...part("psu",.775,.025+index*.17,.19,.16,`power-supply-${index+1}`,"hpe-flexslot-p38995"),
    watts:800,sku:"P38995-B21",inputVoltage:"100–240V AC"}));
}

/** Draw ML110's central exhaust, separate lower standard slots, full GPU-riser blank and bottom-right management column. */
function rearML110(device) {
  return {components:[...supplies(),part("vent",.14,.025,.155,.13,"boot-device-blank"),part("vent",.27,.36,.43,.225,"rear-system-fan-grille"),
    part("vent",.89,.415,.06,.17,"ocp14-blank"),part("module-bay",.10,.615,.72,.060,"pcie-slot-4-cover"),
    part("vent",.10,.78,.59,.125,"gpu-riser-blank"),part("module-bay",.10,.93,.72,.050,"pcie-slot-1-cover"),
    part("module-bay",.64,.698,.063,.070,"serial-blank"),part("vga",.755,.698,.053,.065,"vga"),
    part("usb",.875,.735,.027,.035,"usb-storage"),part("usb",.92,.735,.027,.035,"usb-storage")],
    ports:[socket(device,1,.907,.91,.06,.032,"1"),socket(device,2,.907,.865,.06,.032,"2"),socket(device,3,.907,.815,.06,.032,"iLO")]};
}

/** Draw ML350's four primary PCIe brackets, covered secondary/tertiary positions and installed slot15 quad-port OCP adapter. */
function rearML350(device) {
  const components=[...supplies(),part("vent",.11,.027,.19,.045,"boot-device-blank"),part("vent",.095,.10,.17,.20,"rear-airflow"),
    part("vent",.34,.095,.37,.23,"tertiary-riser-blank"),part("vent",.085,.36,.62,.25,"secondary-riser-blank"),
    part("vga",.84,.34,.058,.064,"vga"),part("module-bay",.84,.605,.066,.073,"serial-blank"),
    part("usb",.845,.74,.026,.035,"usb-storage"),part("usb",.895,.74,.026,.035,"usb-storage"),part("vent",.845,.815,.072,.15,"ocp14-blank"),
    part("module-bay",.755,.78,.05,.057,"external-fan-10-cover"),part("module-bay",.755,.42,.05,.057,"external-fan-9-cover")];
  for(let i=0;i<4;i++) components.push(part("module-bay",.095+i*.151,.70,.132,.235,`pcie-slot-${i+1}-cover`));
  return {components,ports:[...Array.from({length:4},(_,index)=>socket(device,index+1,.877,.575-index*.043,.064,.034,String(index+1))),
    socket(device,5,.877,.709,.062,.034,"iLO")]};
}
