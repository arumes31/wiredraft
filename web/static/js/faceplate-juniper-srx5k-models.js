import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selected={SRX5400:{units:5,height:221.234,width:443.23,depth:622.3,scbs:1,fans:3},SRX5600:{units:8,height:355.6,width:443.23,depth:622.3,scbs:2,fans:6},SRX5800:{units:16,height:704.85,width:441.198,depth:647.7,scbs:2,fans:24}};
const cache=new Map();

/** Resolve the explicitly populated SRX chassis without altering saved identity, inventory or rack allocation. */
export function resolveJuniperSRX5KFaceplate(device) {
  const s=selected[device?.model];if(!s||device.category!=="Firewall"||device.faceplate?.vendor!=="Juniper")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  const units=Math.max(1,Number(device.faceplate.unitsU)||s.units),key=`${device.model}:${units}`;
  if(!cache.has(key))cache.set(key,build(canonical.device,s,units));return cache.get(key);
}

/** Build model evidence, strict original revision mapping and title-aware body dimensions. */
function build(d,s,units) {
  const large=d.model==="SRX5800",scale=Math.min(1,units/s.units),body=690*s.height/482.6*scale,raw=body<64?body/.8:body+16;
  const source=`https://www.juniper.net/documentation/us/en/hardware/${d.model.toLowerCase()}/${d.model.toLowerCase()}.pdf`;
  const configuration=`${d.model} AC chassis: one SRX5K-IOC4-MRAT at12x40G, one SRX5K-SPC3, ${s.scbs} SRX5K-SCB3 and one SRX5K-RE3-128G in SCB0. ${large?"IOC slot5, SPC slot0; four SRX5800-PWR-4100-AC supplies with two independent feeds each; two SRX5800-HC-FAN trays and high-capacity filter tray":"Four2050W high-line AC supplies in PEM0-3 and a high-capacity side-cooling fan tray/filter; "+(d.model==="SRX5400"?"IOC slot1, SPC slot2":"IOC slot0, SPC slot1")}. Other card/RE slots covered; front mounting flanges fitted.`;
  const faces={front:front(d,s),rear:large?largeRear(d):smallRear(d,s)};
  if(scale<.8)for(const f of Object.values(faces))for(const p of f.ports)p.descriptionAnchor.hidden=true;
  return {id:`juniper-srx5k-${d.model.toLowerCase()}`,sku:d.model,family:d.model,fidelity:"model",panelFidelity:{front:"model",rear:"model"},defaultFace:"front",inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,source,
    sourcePage:"SRX5400 PDF21/22/25/36/40/64/76/102/143; SRX5600 PDF21/22/36/43; SRX5800 PDF22/23/29/39/49; official front/rear photographs",
    evidence:{scope:"model",models:[d.model],selectedModel:d.model,catalogAlias:d.model,configuration,front:source,rear:source,reviewed:"2026-09-11",physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:482.6}},note:configuration,
    limitations:[configuration,"SRX5800 front port legends rotate with the vertical cards; vector lettering replaces horizontal caption boxes while stored endpoint names remain intact. This is an explicit selection of documented chassis and separately selected components, not a claim that a current factory bundle includes all cards. No transceivers, breakout, cluster peer or redundant Routing Engine is asserted.",
      "IOC4-MRAT has12 physical cages selected at40G, respecting240G per six-port group. Only four cages support100G; no12x100G capability is claimed. Selected SCB3 fabric may further limit aggregate throughput; physical socket speeds are not a chassis throughput guarantee.",
      "SPC3 HA0/HA1 are10G SFP+ cluster control sockets. SCB3's two disabled SFP+ cages and EXT CLK RJ45 are ancillary, as are USB storage, alarm contacts and internal disks. AUX is serial, not Ethernet.",
      "Original three-port inventories and5/8/16U allocations remain unchanged. Only MGMT0 index1 and CONSOLE index3 map to the selected single RE3. MGMT1, unknown revisions and incompatible edited types remain unmapped. Full saved IDs, settings, names, speeds, cables and placement are preserved.",
      "SRX5400/5600 side-cooling rotors are internal; rear shows only tray/filter endplates. SRX5800's two high-capacity12-fan trays are front mounted; rear upper grille is exhaust, not another fan tray. Optional air-deflector kits and cable-management loops are not fitted in the selected service view.",
      "SRX5800 uses first-generation4100W supplies: AC1 on the chassis and AC2 on each PSU. This differs from second-generation5100W supplies, whose two inputs are both on the PSU. C19 cords establish C20 male inlets despite ambiguous line-drawing contacts; diagonal orientation follows the official rear photograph. All lamps inactive."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:15,3:16}}],chassis:{x:(1-scale)/2,y:.1/units,width:scale,height:raw/(units*100)},faces};
}

/** Define inactive noninteractive source artwork in normalized chassis coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant:`juniper-srx5k-${variant}`} : {}),...extra};}

/** Attach a canonical physical slot using stable index/type rather than a mutable saved label. */
function socket(d,index,x,y,w,h,label,cx,cy,kind="qsfp",captionWidth=.03) {
  const p=d.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+w/2,y:y+h/2,width:w,height:h,connectorKind:`juniper-srx5k-${kind}`,
    descriptionAnchor:{x:cx,y:cy,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Transform a local horizontal card rectangle clockwise for the SRX5800 card cage. */
function box(slot,x,y,w,h) {return slot.vertical?{x:slot.x+(1-y-h)*slot.w,y:slot.y+x*slot.h,w:h*slot.w,h:w*slot.h}:{x:slot.x+x*slot.w,y:slot.y+y*slot.h,w:w*slot.w,h:h*slot.h};}

/** Place a local ancillary component on its actual horizontal or vertical card. */
function cardPart(c,slot,x,y,w,h,role,variant,extra={}) {const b=box(slot,x,y,w,h);c.push(part("panel",b.x,b.y,b.w,b.h,role,variant+(slot.vertical?"-v":""),extra));}

/** Place a card socket and a separate caption without changing the stored endpoint. */
function cardSocket(d,c,ports,slot,index,x,y,w,h,label,kind="qsfp") {
  const b=box(slot,x,y,w,h),a=box(slot,x+w/2,.15,0,0);
  const endpoint=socket(d,index,b.x,b.y,b.w,b.h,label,a.x,a.y,kind+(slot.vertical?"-v":""),.04);
  if(slot.vertical){endpoint.descriptionAnchor.hidden=true;cardPart(c,slot,x,.13,w,.16,`port${index}-legend`,"legend",{text:label});}
  ports.push(endpoint);
}

/** Draw card border strips and blue ejectors without covering connectable hardware. */
function frame(c,slot,role) {for(const y of [.015,.97])cardPart(c,slot,0,y,1,.014,`${role}-rail`,"strip");for(const x of [.008,.944])cardPart(c,slot,x,.15,.048,.65,`${role}-ejector`,"ejector");}

/** Trace IOC4-MRAT's four groups of three cages and their source LED blocks. */
function ioc(d,c,p,slot) {
  frame(c,slot,"ioc4");for(let n=0;n<12;n++){const bank=Math.floor(n/3),col=n%3,x=.090+bank*.212+col*.050;cardSocket(d,c,p,slot,n+1,x,.40,.045,.40,`${Math.floor(n/6)}/${n%6}`);}
  for(let bank=0;bank<4;bank++)cardPart(c,slot,.236+bank*.212,.27,.041,.53,`ioc4-leds${bank}`,"leds",{count:12,cols:3});
}

/** Trace SPC3's two middle SFP+ control cages and left SPU/status lamp groups. */
function spc(d,c,p,slot) {frame(c,slot,"spc3");cardSocket(d,c,p,slot,13,.463,.39,.037,.40,"HA0","sfp");cardSocket(d,c,p,slot,14,.503,.39,.037,.40,"HA1","sfp");cardPart(c,slot,.072,.29,.082,.47,"spc3-leds","leds",{count:8,cols:4});}

/** Trace the selected SCB3 and installed RE3; a second SCB retains its fitted empty RE cover. */
function scb(d,c,p,slot,n) {
  frame(c,slot,`scb${n}`);cardPart(c,slot,.068,.30,.028,.45,`scb${n}-status`,"leds",{count:3});
  for(let k=0;k<2;k++)cardPart(c,slot,.799+k*.038,.42,.034,.34,`scb${n}-reserved-sfp${k}`,"sfp");
  cardPart(c,slot,.885,.28,.039,.49,`scb${n}-external-clock`,"rj45");
  if(n){cardPart(c,slot,.12,.14,.65,.68,`scb${n}-empty-re-cover`,"cover");return;}
  cardSocket(d,c,p,slot,17,.205,.40,.039,.42,"AUX","rj45");cardSocket(d,c,p,slot,16,.270,.40,.039,.42,"CON","rj45");cardSocket(d,c,p,slot,15,.335,.40,.039,.42,"MGMT","rj45");
  cardPart(c,slot,.386,.32,.079,.52,"re3-status","leds",{count:5,cols:2});for(let k=0;k<2;k++)cardPart(c,slot,.475+k*.023,.29,.015,.56,`re3-usb${k+1}`,"usb");
  cardPart(c,slot,.552,.21,.198,.60,"re3-dual-ssd-carrier","cover",{metal:true});
}

/** Create distinct horizontal5U/8U or vertical16U front layouts from the inspected chassis drawings. */
function front(d,s) {
  const c=[],p=[],large=d.model==="SRX5800";
  for(const x of [.002,.976])c.push(part("rack-ear",x,.006,.022,.986,`flange-${x}`,"ear",{holes:large?18:s.units===8?10:6}));
  if(large){c.push(part("status",.04,.015,.92,.073,"craft","craft",{model:d.model,controls:14}),part("panel",.04,.115,.92,.056,"upper-fan-tray","tray"),part("panel",.04,.84,.92,.036,"high-capacity-filter-tray","cover"),part("panel",.04,.885,.92,.046,"lower-fan-tray","tray"),part("vent",.04,.94,.92,.049,"front-air-intake","grid"));
    for(let pos=0;pos<14;pos++){const slot={x:.041+pos*.066,y:.186,w:.061,h:.641,vertical:true};if(pos===0)spc(d,c,p,slot);else if(pos===5)ioc(d,c,p,slot);else if(pos===6||pos===7)scb(d,c,p,slot,pos-6);else cardPart(c,slot,.01,.02,.98,.96,`slot${pos}-cover`,"cover");}
  }else {
    const start=s.units===5?.327:.216,step=s.units===5?.161:.094,rows=s.units===5?4:8;
    c.push(part("vent",.045,.016,.91,s.units===5?.071:.045,"upper-psu-intake","mesh"),part("status",.04,s.units===5?.11:.075,.92,s.units===5?.165:.102,"craft","craft",{model:d.model,controls:rows}));
    for(let row=0;row<rows;row++){const slot={x:.035,y:start+row*step,w:.93,h:step-.005,vertical:false};if(s.units===5){if(row===0)spc(d,c,p,slot);else if(row===1)ioc(d,c,p,slot);else if(row===3)scb(d,c,p,slot,0);else cardPart(c,slot,0,0,1,1,"slot0-cover","cover");}
      else {if(row===4)spc(d,c,p,slot);else if(row===5)ioc(d,c,p,slot);else if(row>=6)scb(d,c,p,slot,7-row);else cardPart(c,slot,0,0,1,1,`slot${5-row}-cover`,"cover");}}
  }return {components:c,ports:p};
}

/** Trace four identical high-line supplies and actual side fan/filter endplates on SRX5400 and SRX5600. */
function smallRear(d,s) {
  const c=[],p=[],body=690*s.height/482.6,height=130/body;
  for(let n=0;n<4;n++){const x=.042+n*.228;c.push(part("vent",x+.005,.025,.205,height*.36,`pem${n}-upper-grille`,"slots"),part("vent",x+.117,height*.44,.070,height*.36,`pem${n}-side-grille`,"slots"),part("panel",x+.01,height*.51,.027,height*.24,`pem${n}-rocker`,"rocker"),part("status",x+.192,.07,.017,height*.31,`pem${n}-status`,"leds",{count:3}),part("panel",x+.020,height*.94,.17,height*.045,`pem${n}-handle`,"strip"));
    p.push(socket(d,18+n,x+.050,height*.48,.053,43.68/body,`PEM${n}`,x+.0765,height*.89,"c20",.064));}
  c.push(part("panel",.085,height+.04,.83,.94-height,"rear-lower-plate","cover",{metal:true}),part("panel",.035,height+.015,.036,.95-height,"filter-endplate","handle"),part("panel",.924,height+.015,.036,.95-height,"fan-tray-endplate","handle"),part("panel",.968,.05,.026,.12,"protective-earth","earth"));return {components:c,ports:p};
}

/** Trace first-generation4100W supplies with separate chassis and PSU feeds below the rear exhaust plenum. */
function largeRear(d) {
  const c=[part("vent",.035,.01,.93,.153,"upper-exhaust-plenum","grid"),part("vent",.04,.250,.92,.035,"psu-exhaust-grille","mesh"),part("panel",.870,.955,.065,.026,"protective-earth","earth")],p=[];
  for(let n=0;n<4;n++){const x=.040+n*.233;
    p.push(socket(d,18+n*2,x+.010,.183,.067,.039,`${n}/AC1`,x+.0435,.173,"c20-diagonal",.09),socket(d,19+n*2,x+.010,.302,.067,.039,`${n}/AC2`,x+.0435,.349,"c20-diagonal",.09));
    c.push(part("panel",x+.086,.182,.068,.020,`pem${n}-chassis-switch`,"rocker"),part("vent",x+.126,.209,.059,.024,`pem${n}-chassis-vent`,"grid"),part("panel",x+.086,.301,.041,.035,`pem${n}-supply-rocker`,"rocker"),part("panel",x,.363,.224,.453,`pem${n}-metal-face`,"psu"),part("status",x+.023,.375,.028,.060,`pem${n}-status`,"leds",{count:4}),part("panel",x+.084,.480,.06,.190,`pem${n}-pull-handle`,"handle"),part("panel",x+.008,.822,.211,.020,`pem${n}-bottom-flange`,"strip"),part("panel",x+.085,.874,.075,.038,`pem${n}-ejector`,"ejector"),part("vent",x+.024,.929,.170,.025,`pem${n}-bottom-vent`,"grid"));
  }return {components:c,ports:p};
}
