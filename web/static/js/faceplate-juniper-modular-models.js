import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections = {
  "EX9200 family": {sku:"EX9204-AC-BND2",series:"ex9204",units:5,height:220.98,width:444.5,depth:622.3,
    configuration:"EX9204-AC-BND2: EX9204-BASE3B-AC, one EX9200-32XS in LC1, EX9200-SF2/RE2 in SF0, two 2520W low-line100–120V AC supplies in PEM0/1, one supplied side-cooling fan tray with three internal fans and air filter. LC2, multifunction LC0/SF1 and PEM2/3 covered. Front mounting flanges fitted."},
  "QFX10000 family": {sku:"QFX10008-BASE",series:"qfx10008",units:13,height:574.04,width:441.96,depth:812.8,
    configuration:"QFX10008-BASE plus one QFX10000-30C in LC0 at native100G: one QFX10000-RE in CB0, five QFX10008-SF SIBs, two QFX10008-FAN trays (11 internal fans each), two QFX10008-FAN-CTRL, three QFX10000-PWR-AC2700W dual-input supplies in PSU0–2. CB1, LC1–7, PSU3–5 and optional external SSD covered. Original power bus; front EMI door opened for service view; standard four-post brackets fitted."}
};
const cache = new Map();

/** Resolve exact modular populations and fit native proportions without changing saved rack allocations. */
export function resolveJuniperModularFaceplate(device) {
  const s=selections[device?.model];
  if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  const units=Math.max(1,Number(device.faceplate.unitsU)||s.units),key=`${canonical.catalog.id}:${device.model}:${units}`;
  if(!cache.has(key))cache.set(key,buildProfile(canonical.device,s,units));
  return cache.get(key);
}

/** Disclose installed parts, conservative revisions and title-aware native geometry for the selected allocation. */
function buildProfile(d,s,units) {
  const source=`https://www.juniper.net/documentation/us/en/hardware/${s.series}/${s.series}.pdf`,scale=Math.min(1,units/s.units);
  const body=690*s.height/482.6*scale,raw=body<64?body/.8:body+16;
  const faces=s.series==="ex9204"?{front:exFront(d),rear:exRear(d)}:{front:qfxFront(d),rear:qfxRear(d)};
  // Existing shared caption support keeps tiny historical allocations usable without enlarging physical parts.
  if(scale<.8)for(const face of Object.values(faces))for(const port of face.ports)port.descriptionAnchor.hidden=true;
  return {id:`juniper-modular-${s.sku.toLowerCase()}`,sku:s.sku,family:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    defaultFace:"front",inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,source,
    sourcePage:s.series==="ex9204"?"PDF29 chassis,53 craft,63 fan,66 PSU,84 RE2,90 SF2,122 32XS,19 rack":"PDF15/16 chassis,44 fans,58/72 PSU,94 RCB,100 30C,217 rack",
    evidence:{scope:"model",models:[s.sku],selectedModel:s.sku,catalogAlias:d.model,configuration:s.configuration,front:source,rear:source,reviewed:"2026-09-11",
      physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:482.6}},note:s.configuration,
    limitations:[s.configuration,
      "Only new devices receive complete selected inventory and native height. Saved IDs/types/speeds/labels/settings/full cable references and rack allocations remain unchanged. Missing revision means original0; unknown revisions and unsupported edited types remain unmapped.",
      "Native body proportions include the existing title reserve. Very small saved allocations hide unreadable physical captions through existing scene support; endpoint interaction and stored labels remain available. No body, socket or rack allocation is enlarged to fit captions.",
      "EX original1U60-port generic inventory maps only RJ45 MGMT59. Copper data,25G,Stack and USB-C console placeholders are incompatible. QFX original2U58-port inventory maps only RJ45 MGMT57 and Console58;25G/DD placeholders are incompatible.",
      "EX SF2 external SFP operational support is not established by its guide; its two visible cages and EXT CLK RJ45 remain ancillary. RE2 AUX is a separate RS232 connector, not a second management Ethernet port. Two USB storage ports and alarm contacts are ancillary. EX fan rotors are internal to the side-cooling tray, not visible rear fans.",
      "QFX RCB four SFP+ ports are explicitly reserved for future use; timing, USB storage and the covered optional SSD remain ancillary. Copper/fiber management are alternative media with copper default. No optics, breakout or Virtual Chassis configuration asserted.",
      "QFX rear overview incorrectly labels PSU slots0–7; detailed power chapter, packing list and drawing establish six slots0–5. Selected three PSUs each have two independent C20 inlets, with source2 above source1. Cord retainers and cords are not fitted in this uncabled service view.",
      "QFX front EMI panel is supplied and opened for the depicted service view; its required normal operating closure is not simulated. SIBs and fan controllers are internal behind installed fan trays. Original bus status panel has no enhanced-bus blue stripe.",
      "EX power overview and detailed table disagree on derated wattage. The selected one32XS load fits either low-line figure. QFX base power-table arithmetic differs by20W; conservative3370W including the30C remains below two2700W supplies plus the third redundancy unit. All indicator lamps inactive."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:s.series==="ex9204"?{59:33}:{57:31,58:33}}],
    chassis:{x:(1-scale)/2,y:.1/units,width:scale,height:raw/(units*100)},faces};
}

/** Define a noninteractive source component in normalized top-left coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {
  return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};
}

/** Bind a physical socket to its canonical identity, never to its mutable user label. */
function socket(d,index,x,y,width,height,label,captionY,kind="sfp",captionWidth=width) {
  const p=d.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add source mounting flanges with the appropriate chassis-specific screw-hole population. */
function ears(c,ex) {
  for(const x of [.002,.970])c.push(part("rack-ear",x,.012,.028,.976,`rack-ear-${x<.5?"left":"right"}`,ex?"juniper-modular-ex-ear":"juniper-modular-qfx-ear"));
}

/** Draw module borders and ejectors as separate strips so none covers an interactive socket. */
function rails(c,y,height,role,ex=false) {
  for(const edge of [y,y+height-.003])c.push(part("panel",.04,edge,.92,.003,`${role}-rail`,"juniper-modular-strip"));
  for(const x of [.046,.925])c.push(part("handle",x,y+.02,.032,height-.04,`${role}-ejector`,ex?"juniper-modular-ex-ejector":"juniper-modular-qfx-ejector"));
}

/** Cover a documented empty module slot without inventing sockets under its blank plate. */
function cover(c,y,height,role,ex=false) {
  c.push(part("panel",.04,y,.92,height,role,ex?"juniper-modular-ex-cover":"juniper-modular-qfx-cover"));
}

/** Trace EX9204's craft interface, two covered slots,32XS in LC1 and SF2/RE2 in SF0. */
function exFront(d) {
  const components=[part("vent",.06,.025,.88,.065,"upper-vent","juniper-modular-mesh"),part("status",.05,.11,.90,.17,"craft-interface","juniper-modular-ex-craft"),part("button",.042,.045,.012,.026,"esd")],ports=[];
  ears(components,true);cover(components,.32,.165,"lc2-cover",true);cover(components,.67,.14,"lc0-sf1-cover",true);rails(components,.495,.17,"lc1",true);rails(components,.815,.16,"sf0",true);
  for(let n=0;n<32;n++) {
    const bank=Math.floor(n/8),local=n%8,col=local%4,row=Math.floor(local/4),x=.162+bank*.199+col*.033;
    ports.push(socket(d,n+1,x,row?.598:.536,.029,.030,`${bank}/${local}`,row?.650:.514,"sfp",.031));
  }
  for(let bank=0;bank<4;bank++)components.push(part("status",.11+bank*.199,.535,.037,.09,`lc1-bank-${bank}-status`,"juniper-modular-ex-bank-leds"));
  ports.push(socket(d,35,.177,.866,.035,.055,"AUX",.844,"rj45",.041),socket(d,34,.231,.866,.035,.055,"CON",.844,"rj45",.041),socket(d,33,.286,.866,.035,.055,"MGMT",.844,"rj45",.043));
  components.push(part("status",.337,.858,.06,.08,"re2-status","juniper-modular-re2-status"),part("usb",.414,.86,.012,.073,"usb1-storage"),part("usb",.435,.86,.012,.073,"usb2-storage"),
    part("button",.465,.91,.006,.015,"re2-reset"),part("panel",.494,.837,.229,.09,"re2-dual-ssd","juniper-modular-re2-ssd"),
    part("status",.085,.86,.041,.07,"sf2-status","juniper-modular-status3"),part("sfp",.782,.871,.036,.034,"sf2-external-sfp0-undocumented"),part("sfp",.824,.871,.036,.034,"sf2-external-sfp1-undocumented"),
    part("rj45",.87,.857,.034,.052,"sf2-external-clock"));
  return {components,ports};
}

/** Trace two EX low-line PEMs, two covers and the exposed endplates of the side-cooling tray/filter. */
function exRear(d) {
  const components=[part("panel",.095,.57,.81,.405,"rear-lower-panel","juniper-modular-ex-rear"),part("handle",.035,.51,.04,.43,"air-filter-endplate","juniper-modular-ex-tray"),
    part("handle",.922,.51,.04,.43,"fan-tray-endplate","juniper-modular-ex-tray"),part("panel",.970,.04,.026,.17,"protective-earth","juniper-modular-earth")],ports=[];
  for(let n=0;n<4;n++) {
    const x=.042+n*.228;
    if(n>=2){components.push(part("panel",x,.025,.221,.505,`pem${n}-cover`,"juniper-modular-psu-cover"));continue;}
    components.push(part("vent",x+.009,.04,.194,.17,`pem${n}-upper-grille`,"juniper-modular-mesh"));
    components.push(part("vent",x+.111,.225,.064,.21,`pem${n}-side-grille`,"juniper-modular-mesh"),part("status",x+.184,.07,.014,.19,`pem${n}-status`,"juniper-modular-status3"),
      part("panel",x+.02,.458,.176,.028,`pem${n}-handle`,"juniper-modular-strip"),part("panel",x+.009,.29,.029,.087,`pem${n}-switch`,"juniper-modular-rocker"));
    ports.push(socket(d,36+n,x+.05,.26,.055,.138,`PEM${n}`,.43,"juniper-modular-ex-c20",.068));
  }
  return {components,ports};
}

/** Trace QFX10008's sole RCB,30C card, reserved service cages and seven covered line slots. */
function qfxFront(d) {
  const components=[part("status",.914,.026,.048,.12,"original-bus-status","juniper-modular-qfx-status"),part("button",.929,.012,.01,.009,"front-esd")],ports=[];
  ears(components,false);rails(components,.023,.052,"cb0");cover(components,.086,.057,"cb1-cover");rails(components,.191,.092,"lc0");
  for(let n=1;n<8;n++)cover(components,.191+n*.09,.086,`lc${n}-cover`);
  ports.push(socket(d,33,.132,.044,.029,.023,"CON",.033,"rj45",.041),socket(d,31,.265,.043,.029,.023,"em0",.032,"rj45",.038),socket(d,32,.307,.046,.034,.018,"em1",.033,"sfp",.038));
  components.push(part("status",.095,.031,.018,.034,"rcb-status","juniper-modular-status3"),part("usb",.362,.052,.03,.010,"usb-storage"),
    part("panel",.421,.035,.217,.03,"optional-ssd-cover","juniper-modular-psu-cover"),part("button",.663,.060,.006,.007,"rcb-reset"));
  for(let n=0;n<4;n++)components.push(part("coax",.185+n*.017,.049,.012,.013,`timing-${["pps-in","pps-out","10mhz-in","10mhz-out"][n]}`,"juniper-modular-smb"));
  for(let n=0;n<4;n++)components.push(part("sfp",.71+n*.040,.046,.037,.018,`reserved-sfp-${n}`));
  for(let n=0;n<30;n++) {
    const bank=Math.floor(n/6),local=n%6,col=Math.floor(local/2),row=local%2,x=.112+bank*.165+col*.043;
    ports.push(socket(d,n+1,x,row?.251:.216,.038,.020,String(n),row?.2755:.204,"qsfp",.042));
  }
  components.push(part("status",.085,.221,.016,.035,"lc0-status","juniper-modular-status3"));
  return {components,ports};
}

/** Trace six PSU bays with three dual-feed supplies and two installed fan-tray guards. */
function qfxRear(d) {
  const components=[part("fan",.238,.027,.355,.944,"fan-tray0","juniper-modular-qfx-fan"),part("fan",.599,.027,.355,.944,"fan-tray1","juniper-modular-qfx-fan"),
    part("panel",.08,.967,.074,.026,"protective-earth","juniper-modular-earth"),part("button",.190,.975,.014,.013,"rear-esd")],ports=[];
  for(let n=0;n<6;n++) {
    const y=.028+n*.155;
    if(n>=3){components.push(part("panel",.041,y,.186,.15,`psu${n}-cover`,"juniper-modular-psu-cover"));continue;}
    components.push(part("vent",.051,y+.005,.163,.016,`psu${n}-upper-grille`,"juniper-modular-mesh"),part("vent",.131,y+.027,.077,.07,`psu${n}-side-grille`,"juniper-modular-mesh"),
      part("status",.142,y+.006,.055,.012,`psu${n}-status`,"juniper-modular-status4-horizontal"),part("panel",.054,y+.081,.153,.012,`psu${n}-handle`,"juniper-modular-strip"),
      part("panel",.169,y+.113,.032,.023,`psu${n}-switch`,"juniper-modular-rocker"),part("button",.14,y+.119,.023,.02,`psu${n}-ejector`));
    ports.push(socket(d,34+n*2,.059,y+.101,.064,.033,`${n}/1`,y+.146,"juniper-modular-qfx-c20",.074),socket(d,35+n*2,.059,y+.033,.064,.033,`${n}/2`,y+.027,"juniper-modular-qfx-c20",.074));
  }
  return {components,ports};
}
