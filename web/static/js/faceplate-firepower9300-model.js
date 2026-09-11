import {canonicalFaceplateDevice} from "./faceplate-profile.js";
const source="https://www.cisco.com/c/en/us/td/docs/security/firepower/9300/hw/guide/b_install_guide_9300/b_install_guide_9300_chapter_01.html",cache=new Map();

/** Fit the exact three-unit chassis inside existing allocations without touching endpoint or rack records. */
export function resolveFirepower9300Faceplate(device){
  if(device?.model!=="Secure Firewall 9300"||device.faceplate?.vendor!=="Cisco")return null;
  if(!cache.has("base")){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set("base",buildProfile(canonical.device));}
  const units=Math.max(1,Number(device.faceplate.unitsU)||3);
  if(!cache.has(units)){const width=Math.min(1,(units*100-24)/207),body=207*width;cache.set(units,{...cache.get("base"),chassis:{x:(1-width)/2,y:.055/units,width,height:(body+16)/(units*100)}});}
  return cache.get(units);
}

/** Record exact installed hardware and a deliberately narrow historical map backed by its physical interfaces. */
function buildProfile(device){
  const configuration="FPR-C9300-AC later rear-switch chassis; FPR9K-SUP, two FPR9K-NM-4X100G modules, three identical FPR9K-SM-40 with two1.6TB SSDs each, two FPR9K-PS-AC2500W supplies at200–240VAC and four FPR9K-FAN. All optical cages, including management, are empty.";
  const map={35:18};for(let i=0;i<8;i++)map[25+i]=9+i;
  return {id:"cisco-firepower9300-ac-sm40",sku:"FPR-C9300-AC",family:"FPR-C9300-AC",fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source,
    sourcePage:"Manufacturer figures5/6/7/8/12; public manufacturer-PDF mirror pages13/14/15/18/24; current official overview controls population.",
    evidence:{scope:"model",models:["FPR-C9300-AC"],selectedModel:"FPR-C9300-AC",catalogAlias:device.model,configuration,front:source,rear:source,
      acFeedGeometry:"Rear Figure6 uses a symbolic chamfered inlet with vertical contacts. The cord table specifies C19 compatibility; exact standard C20 blade geometry is not verified by this illustration.",
      visualMirror:"https://spm-data-public.s3.eu-west-1.amazonaws.com/product-docs/FPR9K-SM-44__b_install_guide_9300__7b2e9eb1d50b3b91941100e32ed8c0c5.pdf"},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:map,portLabels:{35:"CONSOLE"}}],
    catalogDiscrepancies:["Actual frozen438 inventory has24 SFP28_25G, eight QSFP28_100G, two RJ45 management and Console35. Only100G25–32 map by module ordinal to9–16, and Console35 to18. The26 unsupported25G/RJ45-management endpoints remain unmapped.","New18-port inventory is created only for new instances. Saved IDs, types, labels, speeds, settings, links and allocated rack units are never rewritten."],
    limitations:[configuration,"The selected supervisor accepts1/10G; no25G compatibility is implied. Its management connection is an empty1G SFP cage, so neither old copper-management endpoint maps to it. USB Type A storage is decorative hardware, following the application's storage-USB convention.","The initial AC chassis without the external power switch is a different generation. This view selects the documented later rear-switch chassis. Power supply modules are front-serviced; their AC feeds are on the rear. No FIPS opacity shield or optical transceiver is installed.","Rear AC feeds follow the manufacturer Figure6 symbol, including vertical contacts and chamfered shell. The C19 cord specification implies C20 mating compatibility, but the drawing does not verify standard C20 blade geometry.","Manufacturer line figures are retrieved from a public mirror because the official asset host returned403. Figure numbering and component descriptions were checked against current official HTML. Fine text, grille density and LEDs are simplified; unknown revisions and incompatible types stay unmapped."],
    faces:panels(device)};
}

/** Bind source socket centers to canonical identities with bounded independent application captions. */
function socket(device,index,x,y,width,height,label,captionY=.181,captionWidth=.033){
  const port=device.ports.find(p=>p.portIndex===index);if(!port)throw new Error(`Firepower9300 canonical port${index} missing`);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,...(port.type!=="Console"?{connectorKind:port.type==="QSFP28_100G"?"firepower9300-qsfp":"firepower9300-sfp"}:{}),descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Create a source-visible component that has no network identity. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Tighten an empty captive-screw envelope while retaining the same source circle, cross and stroke geometry. */
function compactScrew(x){const ratio=22/27;return{...part("screw",x+(.027-.022)/2,.100+.09*(1-ratio)/2,.022,.09*ratio,"firepower9300-screw"),screwEnvelopeScale:1/ratio};}

/** Trace the supervisor, two network cards, three security cards and opposing front-service/rear-feed power arrangement. */
function panels(device){
  const ports=[];for(let i=0;i<8;i++)ports.push(socket(device,i+1,.228+i*.0368,.112,.034,.080,`1/${i+1}`));
  for(let module=0;module<2;module++)for(let i=0;i<4;i++)ports.push(socket(device,9+module*4+i,.568+module*.239+i*.048,.125,.045,.082,`${module+2}/${i+1}`,.194,.040));
  ports.push(socket(device,17,.143,.112,.035,.080,"MGMT",.181,.046),socket(device,18,.083,.111,.037,.093,"CONSOLE",.181,.054));
  const front=[part("usb",.175,.092,.032,.034),part("vent",.012,.012,.493,.035,"firepower9300-grille"),part("vent",.521,.014,.213,.041,"firepower9300-grille"),part("vent",.760,.014,.215,.041,"firepower9300-grille"),
    part("screw",.011,.085,.025,.080,"firepower9300-screw"),compactScrew(.521),compactScrew(.760),
    part("module-bay",.025,.225,.481,.369,"firepower9300-sm40","SM1"),part("module-bay",.516,.235,.479,.385,"firepower9300-sm40","SM2"),part("module-bay",.025,.620,.481,.370,"firepower9300-sm40","SM3"),
    part("psu",.520,.647,.228,.343,"firepower9300-psu","PSU1"),part("psu",.758,.647,.228,.343,"firepower9300-psu","PSU2")];
  const rear=[part("fan",.057,.018,.193,.712,"firepower9300-fan","FAN1"),part("fan",.258,.018,.193,.712,"firepower9300-fan","FAN2"),part("fan",.579,.123,.194,.746,"firepower9300-fan","FAN3"),part("fan",.785,.123,.193,.746,"firepower9300-fan","FAN4"),
    part("power",.087,.783,.085,.186,"firepower9300-ac-feed","PSU2"),part("power",.292,.783,.085,.186,"firepower9300-ac-feed","PSU1"),
    part("vent",.017,.797,.063,.151,"firepower9300-grille"),part("vent",.195,.810,.090,.143,"firepower9300-grille"),part("vent",.401,.801,.134,.142,"firepower9300-grille"),part("vent",.572,.022,.405,.050,"firepower9300-grille"),
    part("module-bay",.006,.068,.039,.062,"firepower9300-switch"),part("module-bay",.009,.309,.021,.303,"firepower9300-ground")];
  return {front:{ports,components:front},rear:{ports:[],components:rear}};
}
