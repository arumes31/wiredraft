import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const bladeGuide="https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/7b72a53e-1a0a-11e9-9685-f8bc1258b856/fortigate-5001E-security-system-guide.pdf";
const carrierGuide="https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/866a75f9-19f6-11e9-9685-f8bc1258b856/fortigate-5060-chassis-guide.pdf";
const models=new Set(["FortiGate 5001E","FortiGate 5001E1"]),profiles=new Map(),allocations=new WeakMap();

/** Resolve the exact blade in a disclosed supported carrier without changing saved inventory or rack fields. */
export function resolveFortinetBladeFaceplate(device) {
 if(device?.faceplate?.vendor!=="Fortinet"||!models.has(device.model))return null;
 if(!profiles.has(device.model)) {
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  const sku=device.model.replace("FortiGate ","FG-"),ssd=device.model.endsWith("E1");
  profiles.set(device.model,{
   id:`fortinet-${sku.toLowerCase()}-5060-slot3`,sku,family:"FortiGate 5000",selectedCarrier:"FG-5060",selectedSlot:3,
   fidelity:"model",defaultFace:"front",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,
   source:bladeGuide,sourcePage:"Blade PDF6; FG-5060 PDF8/9 front/rear, PDF10/11 compatibility, PDF12/14 services, PDF17 fans, PDF19 PEM",
   evidence:{scope:"model",models:[device.model],selectedModel:device.model,catalogAlias:device.model,front:bladeGuide,rear:carrierGuide,
    configuration:`${sku} in slot 3 of FG-5060; five front and six rear air-baffle covers, one 5000SM primary shelf manager, secondary cover, 5060SAP, two six-radial-fan trays and two DC PEMs A/B. ${ssd?"Internal 480 GB SSD.":"No additional log SSD."}`},
   note:`${device.model}: one blade in a 5U FG-5060 DC carrier, slot 3. Only blade interfaces are logical endpoints.`,
   limitations:[
    "Selected standalone operation: slot 3 power capability 500 and factory-normal SW6. No FortiSwitch/FortiController, backplane switching, RTM, external AC shelf, optics or breakout. Carrier service connectors and blade USB storage are noninteractive physical art.",
    "The two exact blades have identical external hardware; 5001E1 alone adds the hidden 480 GB SSD. Both fan trays have six internal radial fans, which are hidden behind the shown handles/panels. Air travels right to left; no rear fans are invented.",
    "The manufacturer front example shows older B-series blades. This population replaces slot 3 with the exact E-series face and covers all other slots. The exact rear drawing and power specification show two PEMs A/B despite a generic sentence saying four.",
    "Carrier dimensions are 222 x 432 mm. Body aspect follows the source at 690 px under the existing normalized-width contract; at 460 px width reduces independently. Native 5U and saved allocations fit uniformly at each width. Saved 2U remains 2U and does not imply a valid physical 5U rack installation. Below 65% native scale captions are hidden while labels and endpoint interaction remain available.",
    "Small silkscreen, perforations and surface shading are simplified. Backplane interfaces and the SSD are internal, so they do not create exterior sockets. Carrier ETH0, SERIAL1/2 and DB15 alarm belong to the carrier rather than the selected blade inventory.",
   ],
   catalogDiscrepancies:["Actual frozen 438 constructor: each blade reserved 2U with MGMT1 RJ45_1G index 1, MGMT2 RJ45_1G index 2 and Console index 3. Explicit revision-0 map preserves these as canonical indices 1, 2 and 7; unsupported or unknown-revision records remain unmapped."],
   legacyLayouts:[{inventoryRevision:0,portIndexMap:{1:1,2:2,3:7},portLabels:{1:"MGMT1",2:"MGMT2",3:"CONSOLE"}}],
   faces:carrierPanels(canonical.device.ports,sku),
  });
 }
 return fitAllocation(profiles.get(device.model),device);
}

/** Fit the entire sourced carrier into the saved reservation, retaining its per-width body and all identity records. */
function fitAllocation(profile,device) {
 const units=Math.max(1,Number(device.faceplate.unitsU)||5);
 if(!allocations.has(profile))allocations.set(profile,new Map());const cache=allocations.get(profile);
 if(!cache.has(units)) {
  const body=690*.94*222/432,scale=Math.min(1,(units*100*.94-16)/body),width=.94*scale;
  const faces=scale<.65?Object.fromEntries(Object.entries(profile.faces).map(([face,panel])=>[face,{...panel,ports:panel.ports.map(p=>({...p,descriptionAnchor:{...p.descriptionAnchor,hidden:true}}))}])):profile.faces;
  cache.set(units,{...profile,faces,allocationScale:scale,chassis:{x:(1-width)/2,y:.03/units,width,height:(body*scale+16)/(units*100)}});
 }
 return cache.get(units);
}

/** Define one bounded manufacturer assembly, keeping carrier connectors out of the blade's logical inventory. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,variant,...extra};}

/** Bind a stable canonical endpoint to the exact blade aperture and a finite nearby caption anchor. */
function socket(ports,index,x,y,width,height,kind,captionY,label) {
 const p=ports.find(p=>p.portIndex===index);
 return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,connectorKind:kind,x,y,width,height,
  descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:label.startsWith("MGMT")?.085:.065}};
}

/** Trace six carrier slots, the selected horizontal E blade, front service strip and exact covered/DC rear. */
function carrierPanels(ports,sku) {
 const front=[],rear=[],frontPorts=[];
 for(const x of [.002,.984])for(const y of [.135,.775])front.push(part("mounting-slot",x,y,.014,.040,"front-rack-ear-hole",undefined));
 for(let i=0;i<6;i++) {
  const slot=6-i,y=.155+i*.137;
  if(slot!==3)front.push(part("blank",.108,y,.784,.130,`front-blank-${slot}`,"fortinet-blade-blank",{slot,face:"front"}));
  rear.push(part("blank",.088,y,.824,.130,`rear-rtm-blank-${slot}`,"fortinet-blade-blank",{slot,face:"rear"}));
 }
 for(const [x,number] of [[.020,1],[.906,2]])front.push(part("fan",x,.008,.073,.976,`fan-tray-${number}`,"fortinet-blade-fan-tray",{model:"FG-5060 fan tray",internalFans:6,airflow:"right-to-left"}));
 front.push(part("module",.108,.012,.218,.122,"primary-shelf-manager","fortinet-blade-shelf-manager",{model:"5000SM",carrierOnly:true,exposedInterfaces:["ETH0"]}),
  part("module",.333,.012,.341,.122,"shelf-alarm-panel","fortinet-blade-sap",{model:"5060SAP",carrierOnly:true,exposedInterfaces:["SERIAL1","SERIAL2","ALARM DB15 male"]}),
  part("blank",.681,.012,.211,.122,"secondary-shelf-manager-cover","fortinet-blade-service-cover"),
  part("text",.741,.017,.143,.026,"carrier-name",undefined,{label:"FG-5060",fontSize:5.5}),
  part("ground",.668,.003,.012,.025,"front-esd","fortinet-blade-esd"),
  part("handle",.895,.150,.007,.832,"air-filter-extraction-edge","fortinet-blade-filter"));
 // Slot 3 uses the exact 5001E face; top and bottom borders are independent of its socket apertures.
 front.push(part("panel",.110,.559,.780,.004,"blade-upper-edge","fortinet-blade-edge"),
  part("panel",.110,.694,.780,.004,"blade-lower-edge","fortinet-blade-edge"),
  part("handle",.114,.668,.118,.024,"blade-left-extraction-lever","fortinet-blade-lever"),
  part("handle",.775,.668,.108,.024,"blade-right-extraction-lever","fortinet-blade-lever",{reverse:true}),
  part("screw",.115,.622,.020,.035,"blade-left-retention","fortinet-blade-screw"),
  part("screw",.865,.622,.020,.035,"blade-right-retention","fortinet-blade-screw"),
  part("fortinet-blade-usb-a-vertical",.176,.617,.012,.058,"blade-usb-storage",undefined),
  part("status-panel",.535,.656,.085,.026,"base-fabric-status","fortinet-blade-base-leds"),
  part("status-panel",.279,.681,.095,.008,"blade-system-status","fortinet-blade-system-leds"),
  part("status-panel",.720,.640,.060,.025,"nmi-factory-ipm","fortinet-blade-controls"),
  part("text",.720,.571,.155,.020,"blade-name",undefined,{label:sku,fontSize:5.5}));
 frontPorts.push(socket(ports,7,.215,.642,.034,.042,"rj45-inverted",.605,"CON"),
  socket(ports,1,.258,.642,.034,.042,"rj45-inverted",.575,"MGMT1"),
  socket(ports,2,.301,.642,.034,.042,"rj45-inverted",.605,"MGMT2"),
  socket(ports,3,.349,.642,.043,.037,"qsfp",.575,"1"),
  socket(ports,4,.400,.642,.043,.037,"qsfp",.575,"2"),
  socket(ports,5,.449,.642,.032,.037,"sfp",.575,"3"),
  socket(ports,6,.486,.642,.032,.037,"sfp",.575,"4"));
 for(const [x,name] of [[.018,"B"],[.506,"A"]])rear.push(part("psu",x,.006,.476,.132,`pem-${name}`,"fortinet-blade-pem",{model:`FG-5060 PEM ${name}`,powerType:"DC",voltage:-48,branches:2}));
 rear.push(part("panel",.017,.151,.060,.832,"rear-left-rail","fortinet-blade-rear-rail"),
  part("panel",.922,.151,.060,.832,"rear-right-rail","fortinet-blade-rear-rail"),
  part("ground",.034,.563,.030,.122,"rear-ground-lug","fortinet-blade-ground"),
  part("ground",.025,.186,.015,.028,"rear-esd","fortinet-blade-esd"));
 return {front:{ports:frontPorts,components:front},rear:{ports:[],components:rear}};
}
