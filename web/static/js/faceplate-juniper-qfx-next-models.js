import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"QFX5120 family":{sku:"QFX5120-48Y-AFO2",series:"5120",height:43.7,width:440.9,depth:520.2,
  configuration:"QFX5120-48Y-AFO2:48SFP28 cages explicitly configured25G in twelve quads (factory default10G), eight QSFP28-100G cages, two factory JPSU-650W-AC-AO supplies, five QFX5110-FANAFO fans, port-to-FRU airflow, supplied JNP-4PST-RMK-1U-E rack kit. Rear C0/C1 RJ45 management, RJ45 console and ancillary USB-A storage. No optics, breakout endpoints or configured Virtual Chassis."},
  "QFX5130 family":{sku:"QFX5130-32CD-AFO",series:"5130",height:43.688,width:438.404,depth:535.94,
  configuration:"Original QFX5130-32CD-AFO (not QFX5130E):32QSFP-DD400G and two dedicated10G SFP+ cages, front100/1000/10000RJ45 management and RJ45 console. Two factory JPSU-1600W-1UACAFO supplies, six QFX5220-32CD-FANAO fans per official HCT/ordering list, port-to-FRU airflow, supplied QFX5K-4PST-RMK-E four-post rack kit. USB-A storage and10MHz/PPS SMB timing outputs ancillary. No optics or breakout interfaces."}};
const cache=new Map();

/** Resolve only the selected exact Juniper aliases while keeping the native1U body in all saved larger allocations. */
export function resolveJuniperQFXNextFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Record primary-source selection and explicit type-guarded mappings from the executed original58-port constructor. */
function buildProfile(d,s) {
  const q5130=s.series==="5130",source=`https://www.juniper.net/documentation/us/en/hardware/qfx${s.series}/qfx${s.series}.pdf`,body=690*s.height/482.6;
  const map=q5130?{...Object.fromEntries(Array.from({length:8},(_,n)=>[49+n,1+n])),57:35,58:36}:{...Object.fromEntries(Array.from({length:48},(_,n)=>[1+n,1+n])),57:57,58:59};
  return {id:`juniper-qfx-next-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,defaultFace:"front",rearHardwareVerified:true,
    source,sourcePage:q5130?"PDF26photos;33fig20;42fig24 original service;55fan;67/71PSU;119kit/population":"PDF34/35front/rear;72fan;83/84PSU;148/151kit",
    note:s.configuration,evidence:{scope:"model",models:[s.sku],catalogAlias:d.model,selectedModel:s.sku,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:source,rear:source,
      physicalDimensions:{heightMm:s.height,widthMm:s.width,rackWidthMm:482.6,depthMm:s.depth}},
    limitations:[s.configuration,"Actual frozen438 constructor stored2U58ports: SFP28_25G1–48,QSFP_DD_400G49–56,MGMT57,Console58.5120 maps48compatibleSFP28 plusmanagement/console;5130 maps eight compatibleDD identities to physical cages0–7,management andconsole. This is an explicit revision convention; generic saved labels were not manufacturer numbers. Unsupported endpoints remain unmapped.",
      "Saved IDs, types, speeds, labels, VLAN/PoE/settings, cable references, sparse/reordered inventories and rack positions are unchanged. Missing revision is original0; unknown revisions and incompatible edited types stay unmapped. Only new instances receive complete selected inventories; unclaimed physical sockets remain noninteractive artwork.",
      "QFX5130 hardware guide cooling chapter names QFX5130-32CD-FANAO, but its system table, official Hardware Compatibility Tool and ordering list agree QFX5220-32CD-FANAO; selected latter. Figure20 legend erroneously says2networkports, corrected by its32cage drawing and explicit0–31 text. Original management figure24 governs, not later E revision figure25.",
      "QFX5120 HCT timing-present flags conflict with model photographs and detailed panel diagrams; no nonexistent timing sockets are inferred. Its AO650W supply has no older AFO retaining ring. All status lamps inactive; all cages empty. QFX5130 management accepts source-documented1G as well as10G without changing saved type/speed.",
      "Native1U body fitted in saved2U/larger allocations with existing scene title reserve.5130 dimensions use exact conversion of source1.72x17.26x21.1in; the guide rounds its metric height to4.3cm. Selected supplied rack brackets are shown front-on; depth is metadata, not invented faceplate geometry."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:map,portLabels:{...Object.fromEntries(Array.from({length:56},(_,i)=>[i+1,String(i+1)])),57:"MGMT",58:"CONSOLE"}}],
    chassis:{x:0,y:.1,width:1,height:(body<64?body/.8:body+16)/100},faces:{front:q5130?front5130(d):front5120(d),rear:q5130?rear5130(d):rear5120(d)}};
}

/** Define source ancillary hardware in normalized top-left rectangles with inactive indicators. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind a traced physical socket to the canonical immutable index, converting top-left to normalized center. */
function socket(d,index,x,y,width,height,label,captionY,kind="sfp",captionWidth=.030) {
  const p=d.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Show the selected supplied four-post kits' front brackets and central retaining thumbscrews. */
function ears(components) {for(const x of [.001,.964])components.push(part("rack-ear",x,.015,.035,.97,`rack-ear-${x<.5?"left":"right"}`,"juniper-qfx-next-ear"));}

/** Trace QFX5120-48Y's three16-cage banks and four-column QSFP28 block. */
function front5120(d) {
  const components=[part("vent",.044,.015,.908,.075,"upper-intake","juniper-qfx-next-mesh"),part("button",.043,.83,.009,.10,"esd")];ears(components);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.052+col*.0272+Math.floor(col/8)*.009,n%2?.615:.285,.0245,.215,String(n),n%2?.935:.175,"sfp",.025));}
  for(let n=0;n<8;n++)ports.push(socket(d,49+n,.736+Math.floor(n/2)*.054,n%2?.615:.285,.045,.215,String(48+n),n%2?.935:.175,"qsfp",.045));return {components,ports};
}

/** Trace the5120 rear console/USB left column, C1/C0 right column, five fans then dual650W supplies. */
function rear5120(d) {
  const components=[part("status",.039,.235,.012,.49,"system-status","juniper-qfx-next-status4"),part("usb",.060,.625,.032,.115,"usb-storage"),
    part("button",.146,.38,.009,.095,"esd"),part("button",.128,.84,.008,.08,"reset")];
  const ports=[socket(d,59,.060,.260,.030,.25,"CON",.135,"rj45",.037),socket(d,58,.105,.220,.030,.215,"C1",.100,"rj45",.032),socket(d,57,.105,.570,.030,.215,"C0",.500,"rj45",.032)];
  for(let n=0;n<5;n++)components.push(part("fan",.172+n*.103,.025,.095,.95,`chassis-fan-${n}`,"juniper-qfx-next-fan5120"));
  for(let n=0;n<2;n++)addSupply(d,components,ports,.694+n*.145,60+n,false);return {components,ports};
}

/** Trace5130's32DD cages in eight4-cage blocks and distinct front service clusters. */
function front5130(d) {
  const components=[part("vent",.108,.015,.75,.075,"upper-intake","juniper-qfx-next-mesh"),part("status",.087,.10,.012,.30,"system-status","juniper-qfx-next-status3"),
    part("coax",.078,.54,.015,.15,"10mhz-output","juniper-qfx-next-smb"),part("coax",.078,.78,.015,.15,"pps-output","juniper-qfx-next-smb"),
    part("button",.048,.82,.010,.11,"esd"),part("usb",.943,.24,.011,.30,"usb-storage"),part("button",.946,.67,.007,.075,"reset"),
    part("panel",.923,.91,.028,.075,"serial-number-pullout","juniper-qfx-next-pullout")];ears(components);
  const ports=[];for(let n=0;n<32;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.108+col*.0445+Math.floor(col/2)*.005,n%2?.615:.285,.041,.215,String(n),n%2?.935:.175,"qsfp",.041));}
  for(let n=0;n<2;n++)ports.push(socket(d,33+n,.862,n?.630:.280,.030,.18,String(32+n),n?.930:.170,"sfp",.030));
  const mgmt=socket(d,35,.901,.535,.030,.25,"MGMT",.847,"rj45",.039);mgmt.compatibleTypes=["RJ45_1G"];
  ports.push(mgmt,socket(d,36,.901,.175,.030,.25,"CON",.075,"rj45",.035));return {components,ports};
}

/** Trace5130's power supplies at opposite ends with six numbered AIR OUT fan modules between them. */
function rear5130(d) {
  const components=[],ports=[];for(let n=0;n<6;n++)components.push(part("fan",.196+n*.101,.025,.094,.95,`chassis-fan-${n}`,"juniper-qfx-next-fan5130"));
  addSupply(d,components,ports,.048,37,true);addSupply(d,components,ports,.823,38,true);return {components,ports};
}

/** Add each exact PSU's separated grille, inactive lamps, extraction handle, keyed inlet and ejector without overlapping sockets. */
function addSupply(d,components,ports,x,index,highTemperature) {
  components.push(part("vent",x,.07,.033,.35,`psu${index}-grille`,"juniper-qfx-next-psu-grille"));
  components.push(part("status",x,.51,.026,.38,`psu${index}-status`,"juniper-qfx-next-status3"),part("panel",x+.038,.045,.017,.91,`psu${index}-handle`,"juniper-qfx-next-latch"),part("panel",x+.115,.64,.012,.26,`psu${index}-ejector`,"juniper-qfx-next-ejector"));
  ports.push(socket(d,index,x+.062,.225,.040,.55,`PSU${index===(highTemperature?37:60)?0:1}`,.927,highTemperature?"juniper-qfx-next-c16-portrait":"juniper-qfx-next-c14-portrait",.049));
}
