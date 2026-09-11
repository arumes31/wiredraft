import { lenovoServerConfigurations } from "./catalog-lenovo-servers.js";
const cache = new Map();

/** Resolve only the exact registered vendor/model pair without consulting mutable saved inventories. */
export function resolveLenovoServerFaceplate(device) {
  if (device?.category !== "Server") return null;
  const key = `${device.faceplate?.vendor}\0${device.model}`, definition = lenovoServerConfigurations.get(key);
  if (!definition) return null;
  const units = Math.max(1, Number(device.faceplate.unitsU) || definition.units), cacheKey = `${key}:${units}`;
  if (!cache.has(cacheKey)) cache.set(cacheKey, buildProfile(definition, units));
  return cache.get(cacheKey);
}

/** Fit a source body to the saved allocation, retain conservative revision semantics and record its complete configuration. */
function buildProfile(d, units) {
  const scale = Math.min(1, units / d.units), body = 690 * d.height / 482.6 * scale, width = d.width / 482.6 * scale;
  const faces = { front: front(d), rear: rear(d) };
  for (const face of Object.values(faces)) for (const p of face.ports) p.descriptionAnchor.hidden = p.descriptionAnchor.hidden || scale < .8;
  return { id: `lenovo-server-${d.key}`, family: d.model, sku: d.sku, defaultFace: "rear", fidelity: "model", panelFidelity: { front: "model", rear: "model" }, inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
    source: d.source, sourcePage: d.pages, note: d.configuration,
    evidence: { scope: "model", models: [d.model], selectedModel: d.model, selectedSku: d.sku, configuration: d.configuration, reviewed: "2026-09-11", front: d.source, rear: d.source, physicalDimensions: { widthMm: d.width, heightMm: d.height, depthMm: d.depth },
      adapter: d.key === "sr650v2" ? "https://lenovopress.lenovo.com/tips1155.pdf#page=1" : d.key === "sr650" ? "https://lenovopress.lenovo.com/lp0654.pdf" : d.source },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: {} }],
    catalogDiscrepancies: ["These are new catalog entries. No historical inventory namespace is established; absent/zero and unknown revisions remain unmapped rather than guessing identities."],
    limitations: [d.configuration, "This illustration represents only the selected configuration. USB host/XCC service, VGA, diagnostic handset sockets, storage carriers and internal SATA/SAS links are ancillary hardware, not Ethernet or serial-console endpoints. No external SAS HBA is installed.", "Stored IDs, names, cable references, settings and rack placements are never rewritten. Unclaimed physical sockets remain inactive artwork. AC-L/AC-R identify physical rear left/right supplies without inventing manufacturer supply numbering.", "Body dimensions follow the canonical 690-wide rack convention; saved allocations fit proportionally. The 460-wide renderer retains its existing vertical rack grid. Power captions are omitted on the dense 1U supply face; full endpoint labels remain in metadata."],
    chassis: { x: (1-width)/2, y: .1/units, width, height: (body < 64 ? body/.8 : body+16)/(units*100), componentDrawn: true }, faces };
}

/** Place inactive source hardware using its top-left normalized chassis bounds. */
function part(kind, role, x, y, width, height, variant, extra = {}) { return { kind, role, x, y, width, height, variant, active: false, ...extra }; }
/** Use a socket centered at its authored position; the caption is independent from the cable anchor. */
function socket(index, label, type, x, y, width, height, captionY, hidden = false) {
  return { portIndex: index, label, physicalLabel: label, type, connectorKind: type === "Power" ? "lenovo-server-c14" : "rj45", x, y, width, height,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: Math.max(width, .05), hidden } };
}
/** Draw one source-sized front or rear metal body; contained sockets remain independently interactive. */
function body(front) { return part("panel", "body", 0, 0, 1, 1, front ? "lenovo-server-front" : "lenovo-server-rear", { hardwareLayer: "chassis-container" }); }
/** Add horizontal closed drive carriers with the selected generation's release-latch construction. */
function drives(parts, d, x, y, columns, rows, width, height) {
  for (let c=0;c<columns;c++) for(let r=0;r<rows;r++) parts.push(part("drive-bay", `drive-${c*rows+r}`, x+c*width, y+r*height, width-.006, height-.012, d.key === "x3550m5" ? "lenovo-server-g3hs" : "lenovo-server-lff", { label: String(c*rows+r), drivePart: d.key === "x3550m5" ? "00AJ141" : "7XB7A00049" }));
}
/** Trace each front separately: 8LFF top controls, 12LFF side controls, or 8SFF plus media/LCD. */
function front(d) {
  const p=[body(true)], x=d.key === "x3550m5";
  p.push(part("panel","left-latch",.005,.045,.052,.91,"lenovo-server-ear"),part("panel","right-latch",.947,.045,.048,.91,"lenovo-server-ear"));
  if(x){
    drives(p,d,.067,.15,4,2,.153,.37);
    p.push(part("panel","lcd",.692,.14,.12,.28,"lenovo-server-lcd"),part("panel","optical-blank",.687,.58,.241,.30,"lenovo-server-blank"),part("usb","front-usb3",.83,.21,.032,.12,"a"),part("usb","front-usb2",.83,.49,.032,.12,"a"),part("vga","front-vga",.891,.42,.047,.20),part("button","power",.886,.17,.015,.12),part("led","status",.916,.20,.009,.08));
  } else {
    const v2=d.key === "sr650v2";
    drives(p,d,.067,v2?.045:.35,4,v2?3:2,.218,v2?.305:.305);
    p.push(part("vga","front-vga",.019,v2?.25:.17,.022,.25,"portrait"));
    if(v2){
      p.push(part("panel","diagnostics-port",.016,.062,.027,.062,"lenovo-server-diagnostic"),part("usb","front-usb2-xcc",.95,.39,.032,.065,"a"),part("usb","front-usb3",.95,.53,.032,.065,"a"),part("button","power",.955,.07,.015,.07),part("led","status",.975,.18,.01,.05));
    } else {
      p.push(part("vent","front-air-inlet",.067,.035,.64,.27,"perforated"),part("usb","front-usb2-xcc",.745,.07,.034,.07,"a"),part("usb","front-usb3",.796,.07,.034,.07,"a"),part("button","power",.845,.05,.028,.09),part("led","status",.906,.07,.01,.05));
    }
  }
  return { components:p, ports:[] };
}

/** Add bounded perforated slot covers using the actual riser population and orientation. */
function covers(p, x, y, count, width, height, step, vertical=false) {
  for(let n=0;n<count;n++) p.push(part("panel",`pcie-cover-${x}-${n}`,x+(vertical?n*step:0),y+(vertical?0:n*step),width,height,"lenovo-server-slot"));
}
/** Add each selected AC supply as a housing around its separate C14 endpoint. */
function supplies(p, ports, d, xs, y, width, height) {
  xs.forEach((x,n)=>{
    p.push(part("panel",`psu-${n+1}`,x,y,width,height,"lenovo-server-psu",{hardwareLayer:"chassis-container",label:d.key==="x3550m5"?"550W":d.key==="sr650v2"?"1100W":"750W"}));
    ports.push(socket(n+6,n?"AC-R":"AC-L","Power",x+width*.75,y+height*.49,width*.235,height*.66,d.key==="x3550m5"?.5:d.key==="sr650"?.035:y-.045,d.key==="x3550m5"));
  });
}
/** Trace the independently documented motherboard, LOM/OCP, risers, supplies and ventilation on each rear. */
function rear(d) {
  const p=[body(false)], ports=[], x=d.key==="x3550m5", v2=d.key==="sr650v2";
  if(x){
    covers(p,.03,.07,1,.17,.38,.4);covers(p,.28,.07,2,.14,.38,.16,true);
    p.push(part("vent","rear-left-vent",.212,.10,.053,.34,"perforated"),part("usb","rear-usb3a",.078,.66,.039,.16,"a"),part("usb","rear-usb3b",.135,.66,.039,.16,"a"),part("usb","rear-usb2",.265,.66,.039,.16,"a"),part("vga","rear-vga",.535,.61,.055,.23),part("led","locator",.44,.39,.008,.09));
    ports.push(socket(5,"IMM","RJ45_1G",.039,.75,.032,.23,.936));
    [.355,.399,.455,.499].forEach((left,n)=>ports.push(socket(n+1,`NIC${n+1}`,"RJ45_1G",left,.75,.032,.23,.936)));
    supplies(p,ports,d,[.63,.814],.04,.177,.90);
  } else if(v2){
    covers(p,.062,.045,3,.231,.19,.205);covers(p,.338,.045,3,.231,.19,.205);covers(p,.707,.045,2,.239,.19,.205);
    p.push(part("vent","rear-riser3-vent",.591,.055,.091,.40,"perforated"),part("led","locator",.193,.84,.012,.06),part("led","error",.282,.84,.008,.06),part("usb","rear-usb3a",.389,.755,.036,.055,"a"),part("usb","rear-usb3b",.389,.845,.036,.055,"a"),part("usb","rear-usb3c",.52,.845,.036,.055,"a"),part("vga","rear-vga",.451,.765,.054,.09),part("button","nmi",.58,.89,.008,.045));
    [.063,.098,.133,.168].forEach((left,n)=>ports.push(socket(n+1,`NIC${n+1}`,"RJ45_1G",left,.85,.029,.115,.964)));
    ports.push(socket(5,"XCC","RJ45_1G",.246,.85,.034,.115,.964));
    supplies(p,ports,d,[.61,.801],.53,.188,.41);
  } else {
    p.push(part("vent","rear-left-vent",.02,.10,.155,.62,"perforated"),part("panel","pcie-cover-4",.482,.095,.036,.65,"lenovo-server-slot"),part("vent","rear-upper-right-vent",.84,.085,.14,.35,"perforated"),part("vent","rear-io-vent",.294,.79,.117,.14,"perforated"),part("usb","rear-usb3a",.533,.76,.036,.055,"a"),part("usb","rear-usb3b",.533,.85,.036,.055,"a"),part("vga","rear-vga",.425,.80,.052,.09));
    covers(p,.207,.075,3,.255,.16,.235);covers(p,.555,.075,2,.253,.16,.235);
    [.058,.098,.138,.178].forEach((left,n)=>ports.push(socket(n+1,`NIC${n+1}`,"RJ45_1G",left,.85,.033,.115,.964)));
    ports.push(socket(5,"XCC","RJ45_1G",.254,.85,.034,.115,.964));
    supplies(p,ports,d,[.607,.802],.51,.187,.43);
  }
  return { components:p, ports };
}
