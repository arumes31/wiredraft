import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const rearGuide="https://pubs.lenovo.com/thinksystem_storage_de_himg_11.60.2/rear_view";
const definitions={DE2000H:{sku:"7Y71A001WW",height:85,width:449,drives:24,driveSku:"4XB7A14112",series:"DE"},
 DE240S:{sku:"7Y68A000WW",height:85,width:449,drives:24,driveSku:"4XB7A14112",series:"DE"},
 D1212:{sku:"4587EKU",height:88,width:443,drives:12,driveSku:"included6TB",series:"D"},
 D1224:{sku:"4587A31",height:88,width:443,drives:24,driveSku:"01DC407",series:"D"},
 TS2900:{sku:"3572-S7H",height:44,width:483,drives:0,series:"IBM"}};
const cache=new Map();

/** Resolve only these five explicitly documented rack configurations, independently of editable inventory order. */
export function resolveLenovoStorageFaceplate(device) {
 if(!Object.hasOwn(definitions,device?.model))return null;
 const d=definitions[device.model];if(device.category!=="Server"||device.faceplate?.vendor!==(d.series==="IBM"?"IBM":"Lenovo"))return null;
 const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
 const units=Math.max(1,Number(device.faceplate.unitsU)||canonical.catalog.units),key=`${device.model}:${units}`;
 if(!cache.has(key))cache.set(key,buildProfile(canonical.device,canonical.catalog,d,units));
 return cache.get(key);
}

/** Keep the declared690px body proportions while fitting arbitrary saved rack allocations without touching endpoints. */
function buildProfile(device,catalog,d,units) {
 const body=690*.96*d.height/d.width,scale=Math.min(1,(units*100*.94-16)/body),width=.96*scale,bodyHeight=body*scale;
 const frameHeight=bodyHeight<64?bodyHeight/.8:bodyHeight+16;
 let faces=d.series==="IBM"?tapePanels(device):{front:driveFront(d),rear:d.series==="DE"?deRear(device):dRear(device)};
 if(scale<.65)faces=Object.fromEntries(Object.entries(faces).map(([face,panel])=>[face,{...panel,ports:panel.ports.map(p=>({...p,descriptionAnchor:{...p.descriptionAnchor,hidden:true}}))}]));
 return {id:`lenovo-storage-${d.sku.toLowerCase()}`,family:device.model,sku:d.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
  inventoryRevision:1,inventoryComplete:true,defaultFace:"rear",rearHardwareVerified:true,source:catalog.source,
  sourcePage:d.series==="IBM"?"GC27-2212-08 pp3–6,10,159":d.series==="DE"?"LP0881 Fig2;11.60.2 rear Figs1/4":"LP0512 Figs2–4, specifications and model/drive tables",
  evidence:{scope:"model",models:[device.model],sku:d.sku,configuration:catalog.note,reviewed:"2026-09-11",front:catalog.source,
   rear:d.series==="DE"?rearGuide:catalog.source,physicalDimensions:{heightMm:d.height,widthMm:d.width},revision:d.series==="DE"?"Gen1 / IOM12":"selected rack configuration"},
  note:catalog.note,allocationScale:scale,chassis:{x:(1-width)/2,y:.025/units,width,height:frameHeight/(units*100)},
  legacyLayouts:[{inventoryRevision:0,portIndexMap:{}}],
  limitations:[catalog.note,"New catalog additions have no historical revision0 endpoint contract. Unknown revisions remain unmapped; sparse/reordered/current edited records and cable identities are never rewritten.",
   "Body proportions use690px as the declared reference; the existing normalized-width renderer changes horizontal scale at460px. At either width a smaller saved allocation uniformly fits the same body, and a larger allocation retains its size. Below65% body scale captions are hidden to avoid unreadable/colliding text; endpoint labels remain intact in metadata and interaction. TS2900 uses its483mm rack bezel width (445mm internal chassis).",
   "Drive capacities/populations are selected configurations, not detected user hardware. Indicators are inactive. Internal batteries, drive electronics, cooling fans and tape cartridges remain hidden.",
   d.series==="DE"?"The selected controller is Gen1 with base FC ports; current LP0881 Gen2 rear artwork is not used. ReservedP2 and factory USB-A are ancillary. DE240S IOM12 has four separate SAS sockets per module.":
    d.series==="D"?"Both enclosures use the shared rear explicitly pictured in LP0512; the lower ESM and right580W PCM are rotated180degrees. Proprietary service sockets remain ancillary.":
     "The rack-mounted rear is an orthographic projection of the guide's recessed panel. Only one external SFF-8088 aperture is exposed; other drive interfaces are internal. Accessor shipping screw is removed. Nine magazine positions and the tape drive are internal, not exterior drive bays."],faces};
}

/** Place an exact assembly whose optional metadata identifies its installed population. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,variant,...extra};}

/** Bind canonical physical identity, preserving edited stored labels while supplying a short manufacturer caption. */
function socket(device,index,x,y,width,height,kind,label,captionY,captionWidth=.06) {
 const p=device.ports.find(p=>p.portIndex===index);
 return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,connectorKind:kind,x,y,width,height,
  descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Author a genuine containing module panel; its sockets remain independently interactive scene entities. */
function housing(x,y,width,height,role,label) {
 return part("panel",x,y,width,height,role,"lenovo-storage-housing",{hardwareLayer:"chassis-container",label});
}

/** Trace the distinctly latched DE/D SFF carriers and the D1212's four-column, three-row LFF face. */
function driveFront(d) {
 const components=[];
 if(d.drives===12)for(let n=0;n<12;n++)components.push(part("drive-carrier",.047+(n%4)*.226,.025+Math.floor(n/4)*.318,.221,.307,`drive-${n}`,"lenovo-storage-d-lff",{driveNumber:n,driveSku:d.driveSku}));
 else for(let n=0;n<24;n++)components.push(part("drive-carrier",.047+n*.0376,.025,.0355,.95,`drive-${n}`,d.series==="DE"?"lenovo-storage-de-sff":"lenovo-storage-d-sff",{driveNumber:n,driveSku:d.driveSku}));
 components.push(part("status-panel",.006,.10,.033,.76,"enclosure-status","lenovo-storage-front-status",{series:d.series}),
  part("panel",.957,.04,.037,.90,"right-bezel","lenovo-storage-right-bezel",{series:d.series}));
 return {ports:[],components};
}

/** Trace Gen1 DE controllers or IOM12s above two identical, upright913W AC power/fan canisters. */
function deRear(device) {
 const components=[],ports=[],controller=device.model==="DE2000H";
 for(let m=0;m<2;m++) {
  const x=m*.461,label=m?"B":"A";
  components.push(housing(x+.049,.025,.435,.446,`${label}-module`,controller?`CTRL ${label}`:`IOM12 ${label}`),
   part("psu",x+.049,.493,.435,.479,`${label}-power-fan`,"lenovo-storage-de-psu",{powerWatts:913,powerType:"AC",integratedFans:true}),
   part("handle",x+.224,.426,.063,.035,`${label}-module-release`,"lenovo-storage-orange-latch"));
  if(controller) {
   for(let n=0;n<2;n++)ports.push(socket(device,m*2+n+1,x+.118+n*.029,.185,.026,.087,"sfp",String(n+1),.298,.025));
   ports.push(socket(device,9+m,x+.189,.185,.029,.13,"rj45","P1",.298,.055),
    socket(device,11+m,x+.278,.185,.030,.13,"rj45","CON",.298,.058),
    socket(device,13+m,x+.333,.15,.022,.044,"usb-micro","USB",.298,.06));
   for(let n=0;n<2;n++)ports.push(socket(device,5+m*2+n,x+.431+n*.025,.205,.023,.110,"sas-mini-hd",String(n+1),.320,.024));
   components.push(part("rj45",x+.219,.120,.030,.13,`${label}-reserved-P2`,undefined,{serviceOnly:true}),
    part("usb",x+.354,.16,.030,.055,`${label}-factory-USB`,undefined,{serviceOnly:true}),
    part("blank",x+.303,.348,.088,.067,`${label}-HIC-cover`,"lenovo-storage-hic-cover"),
    part("status-panel",x+.097,.355,.101,.045,`${label}-controller-status`,"lenovo-storage-controller-leds"));
  } else {
   for(let n=0;n<4;n++)ports.push(socket(device,m*4+n+1,x+.248+(n<2?n*.0245:.097+(n-2)*.0245),.225,.023,.11,"sas-mini-hd",String(n+1),.347,.025));
   components.push(part("status-panel",x+.406,.177,.039,.105,`${label}-IOM-status`,"lenovo-storage-controller-leds"));
  }
 }
 return {ports,components};
}

/** Rotate the lower D-series ESM's physical objects180degrees while leaving application captions readable. */
function rotate(p,center=false) {
 return {...p,x:1-p.x-(center?0:p.width),y:1-p.y-(center?0:p.height),inverted:true,
  ...(p.descriptionAnchor?{descriptionAnchor:{...p.descriptionAnchor,x:1-p.descriptionAnchor.x,y:1-p.descriptionAnchor.y}}:{}),
  ...(p.connectorKind==="rj45"?{connectorKind:"rj45-inverted"}:{}),...(p.connectorKind==="sas-mini-hd"?{connectorKind:"sas-mini-hd-inverted"}:{})};
}

/** Trace the source's upper ESM A, inverted lower ESM B and the two opposing580W side PCMs. */
function dRear(device) {
 const upper=[housing(.261,.022,.478,.450,"A-ESM","ESM A"),
  part("handle",.282,.382,.326,.052,"A-ESM-handle","lenovo-storage-esm-handle"),
  part("module",.371,.113,.020,.134,"A-service-port","lenovo-storage-proprietary-service",{serviceOnly:true}),
  part("status-panel",.353,.035,.020,.105,"A-ESM-status","lenovo-storage-controller-leds")];
 const ports=[];
 for(let n=0;n<3;n++)ports.push(socket(device,n+1,.438+n*.075,.217,.039,.174,"sas-mini-hd",String.fromCharCode(65+n),.355,.070));
 ports.push(socket(device,7,.691,.220,.039,.171,"rj45","MGMT",.355,.081));
 const bottom=upper.map(p=>({...rotate(p),role:p.role.replace("A-","B-"),...(p.label?{label:"ESM B"}:{})}));
 const lowerPorts=ports.map(p=>{const index=p.portIndex===7?8:p.portIndex+3,q=device.ports.find(v=>v.portIndex===index);return {...rotate(p,true),portIndex:index,type:q.type,label:q.label};});
 return {ports:[...ports,...lowerPorts],components:[...upper,...bottom,
  part("psu",.044,.022,.207,.950,"A-PCM","lenovo-storage-d-psu",{powerWatts:580,powerType:"AC",integratedFans:true}),
  part("psu",.749,.022,.207,.950,"B-PCM","lenovo-storage-d-psu",{powerWatts:580,powerType:"AC",integratedFans:true,inverted:true})]};
}

/** Project the TS2900's closed magazine/operator panel and recessed SAS/power rear from the IBM guide. */
function tapePanels(device) {
 const front=[part("panel",.005,.025,.157,.94,"left-bezel","lenovo-storage-tape-left"),
  part("module",.167,.025,.496,.94,"closed-nine-position-magazine","lenovo-storage-tape-magazine",{cartridgePositions:9,externalDriveBays:0}),
  part("module",.672,.025,.279,.94,"operator-panel","lenovo-storage-tape-operator",{lcdCharacters:16,buttons:4}),
  part("panel",.956,.025,.039,.94,"right-rack-ear","lenovo-storage-tape-ear")];
 const rear=[part("panel",.015,.10,.392,.72,"left-rear-cover","lenovo-storage-tape-cover"),
  part("panel",.410,.10,.274,.10,"rear-recess-upper-edge","lenovo-storage-recess-edge"),
  part("panel",.410,.82,.274,.06,"rear-recess-lower-edge","lenovo-storage-recess-edge"),
  part("psu",.693,.12,.278,.70,"internal-AC-supply-rear","lenovo-storage-tape-psu",{powerType:"AC",integratedFans:true}),
  part("screw",.397,.54,.010,.12,"removed-accessor-screw-hole","lenovo-storage-screw-hole")];
 return {front:{ports:[],components:front},rear:{ports:[socket(device,1,.649,.43,.038,.151,"sas-mini","SAS",.695,.075),
  socket(device,2,.438,.49,.030,.22,"rj45","MGMT",.735,.058)],components:rear}};
}
