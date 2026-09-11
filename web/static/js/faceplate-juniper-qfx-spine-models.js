import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"QFX5200 family":{sku:"QFX5200-32C-AFO2",series:"5200",units:1,height:43.688,width:440.944,depth:520.192,
  configuration:"Standard Junos QFX5200-32C-AFO2 (not32C-L):32QSFP28-100G cages, two factory JPSU-850W-AC-AFO supplies, five QFX5200-32C-FANAFO fans, supplied JNP-4PST-RMK-1U-E kit. Rear C0 RJ45/fiber combo (copper priority), C1SFP and RJ45 console. Front grandmaster RJ45/PPS/10MHz outputs and rearUSB-A storage are ancillary."},
  "QFX5210 family":{sku:"QFX5210-64C-AFO",series:"5210",units:2,height:88.9,width:438.2,depth:579.9,
  configuration:"QFX5210-64C-AFO:64QSFP28-100G and two dedicated10G SFP+ cages, front1G RJ45 management and RJ45 console, two factory JPSU-1100W-AC-AFO supplies, four QFX5210-FANAFO fans, supplied QFX5210-4PST-RMK kit. FrontUSB2.0 storage ancillary. Four data rows:0–31 upper pair,32–63 lower pair."},
  "QFX5220 family":{sku:"QFX5220-32CD-AFO",series:"5220",units:1,height:43.688,width:438.404,depth:535.94,
  configuration:"QFX5220-32CD-AFO:32QSFP-DD400G and two dedicated10G SFP+ cages, front100/1000/10000RJ45 management and console, two factory JPSU-1600W-1UACAFO supplies, six QFX5220-32CD-FANAO fans, supplied QFX5K-4PST-RMK-E kit. Front grandmaster RJ45, four10MHz/PPS input/outputSMB jacks and USB2/3storage ancillary.128C/5230excluded."}};
const cache=new Map();

/** Resolve the selected SKU with native body aspect preserved in original or edited saved rack allocations. */
export function resolveJuniperQFXSpineFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||s.units);if(units===s.units)return c.profile;
  if(!c.allocations.has(units)) {
    const scale=Math.min(1,units/s.units),body=690*s.height/482.6*scale,raw=body<64?body/.8:body+16;
    c.allocations.set(units,{...c.profile,chassis:{x:(1-scale)/2,y:.1/units,width:scale,height:raw/(100*units)}});
  }
  return c.allocations.get(units);
}

/** Attach exact source populations and explicit original inventory maps without altering stored endpoints. */
function buildProfile(d,s) {
  const source=`https://www.juniper.net/documentation/us/en/hardware/qfx${s.series}/qfx${s.series}.pdf`,body=690*s.height/482.6;
  const map=s.series==="5220"?{...Object.fromEntries(Array.from({length:8},(_,n)=>[49+n,1+n])),57:35,58:36}:s.series==="5210"?{57:67,58:68}:{57:33,58:36};
  return {id:`juniper-qfx-spine-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,defaultFace:"front",rearHardwareVerified:true,
    source,sourcePage:s.series==="5200"?"PDF30front,41service,50rear,51fan,60/66PSU,117kit,127rack":s.series==="5210"?"PDF30front,38service,28rear,43fan,48PSU,66dimensions,88kit,14rack":"PDF24photos,29/81frontservice,91fan,100/108PSU,126dimensions,157kit,171rack",note:s.configuration,
    evidence:{scope:"model",models:[s.sku],catalogAlias:d.model,selectedModel:s.sku,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:source,rear:source,physicalDimensions:{heightMm:s.height,widthMm:s.width,depthMm:s.depth,rackWidthMm:482.6}},
    limitations:[s.configuration,"All selected models use port-to-FRU airflow with matching supplies and fans; no optics, breakout interfaces, expansion modules or configured Virtual Chassis are asserted. All lamps inactive.",
      "Actual frozen438 inventories for allthree aliases were2U58ports:48SFP28_25G,8QSFP_DD_400G,MGMT57,Console58. Onlymanagement/console map on5200/5210;5220 additionally maps old49–56 to canonical1–8 as an explicit first-eightDD revision convention, not a claim about original manufacturer numbers. Unsupported data placeholders remain unmapped.",
      "Full saved IDs, types, speeds, labels, VLAN/PoE/settings, cable references, sparse/reordered arrays and rack placements remain unchanged. Missing revision means original0; unknown revisions and unsupported edited types stay unmapped. Complete physical inventories are created only for new devices; unclaimed sockets remain noninteractive artwork.",
      "QFX5210 figure8 incorrectly labels4PSUs although its drawing, parts table and redundancy text specify2. Cooling table uses QFX5210-64C-FANAFO, but ordering list/HCT/system table agree QFX5210-FANAFO; latter is selected. Its body is2U; drawings govern front service location despite a cooling prose reference to management panel atrear.",
      "QFX5220 management overview calls its port1000BASE-T, while detailed port-panel specification explicitly supports100/1000/10000; canonical10G accepts source-supported saved1G without type rewriting. QFX5200 C0 copper/fiber are alternative media for one management interface with copper priority; socket depiction does not simulate media selection.",
      "Native dimensions include nominal19in mounting span; title reservation is accounted for when fitting into saved smaller/larger allocations. QFX5210 has no invented rear management, additionalPSUs or timing sockets. USB storage and clock connectors remain ancillary, not extra network/console endpoints."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:map,portLabels:{...Object.fromEntries(Array.from({length:56},(_,n)=>[n+1,String(n+1)])),57:"MGMT",58:"CONSOLE"}}],
    chassis:{x:0,y:.1/s.units,width:1,height:(body<64?body/.8:body+16)/(100*s.units)},
    faces:s.series==="5200"?{front:front5200(d),rear:rear5200(d)}:s.series==="5210"?{front:front5210(d),rear:rear5210(d)}:{front:front5220(d),rear:rear5220(d)}};
}

/** Define traced ancillary components in normalized top-left coordinates. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Bind a normalized physical socket to a canonical index and its immutable endpoint type. */
function socket(d,index,x,y,width,height,label,captionY,kind="qsfp",captionWidth=.036) {
  const p=d.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add the selected kits' visible front brackets, distinguishing5210's five-hole rails from1U thumbscrews. */
function ears(components,tall=false) {for(const x of [.001,.964])components.push(part("rack-ear",x,.015,.035,.97,`rack-ear-${x<.5?"left":"right"}`,tall?"juniper-qfx-spine-ear5210":"juniper-qfx-spine-ear"));}

/** Trace5200's front grandmaster/timing cluster followed by four8-cage QSFP28 banks. */
function front5200(d) {
  const components=[part("vent",.164,.015,.748,.075,"upper-intake","juniper-qfx-spine-mesh"),part("rj45",.052,.28,.030,.25,"grandmaster-clock-input"),
    part("coax",.096,.37,.016,.15,"pps-output","juniper-qfx-spine-smb"),part("coax",.133,.37,.016,.15,"10mhz-output","juniper-qfx-spine-smb"),part("button",.929,.44,.012,.13,"esd")];ears(components);
  const ports=[];for(let n=0;n<32;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.171+col*.044+Math.floor(col/4)*.010,n%2?.615:.285,.040,.215,String(n),n%2?.935:.175));}return {components,ports};
}

/** Trace5200's exact C0 copper/fiber and C1SFP management cluster before five fans and two850W supplies. */
function rear5200(d) {
  const components=[part("status",.016,.275,.018,.44,"system-status","juniper-qfx-spine-status4"),part("usb",.119,.46,.013,.30,"usb-storage"),part("button",.083,.845,.008,.08,"reset")];
  const ports=[socket(d,36,.075,.19,.029,.225,"CON",.080,"rj45",.039),socket(d,33,.075,.550,.029,.225,"C0",.485,"rj45",.039),
    socket(d,34,.039,.24,.030,.16,"C0",.105,"sfp",.029),socket(d,35,.039,.630,.030,.16,"C1",.933,"sfp",.029)];
  for(let n=0;n<5;n++)components.push(part("fan",.156+n*.104,.025,.094,.95,`chassis-fan-${n}`,"juniper-qfx-spine-fan5200"));
  for(let n=0;n<2;n++)supply1U(d,components,ports,.684+n*.155,37+n,"850");return {components,ports};
}

/** Trace5210's four data rows with upper0–31 and lower32–63 numbering plus front right service hardware. */
function front5210(d) {
  const components=[part("vent",.096,.015,.755,.025,"upper-intake","juniper-qfx-spine-mesh"),part("status",.056,.595,.025,.18,"system-status","juniper-qfx-spine-status4"),
    part("button",.067,.46,.007,.05,"reset"),part("button",.044,.39,.011,.07,"esd"),part("usb",.912,.615,.030,.065,"usb-storage"),
    part("panel",.892,.97,.042,.025,"serial-number-pullout","juniper-qfx-spine-pullout5210")];ears(components,true);
  const ports=[];for(let n=0;n<64;n++){const half=Math.floor(n/32),within=n%32,col=Math.floor(within/2),row=half*2+within%2;
    ports.push(socket(d,n+1,.097+col*.044+Math.floor(col/2)*.006,[.18,.405,.64,.87][row],.040,.10,String(n),[.11,.345,.57,.80][row],"qsfp",.040));}
  ports.push(socket(d,67,.861,.23,.030,.12,"MGMT",.16,"rj45",.039),socket(d,68,.861,.405,.030,.12,"CON",.585,"rj45",.037),
    socket(d,65,.909,.235,.031,.09,"64",.17,"sfp",.029),socket(d,66,.909,.43,.031,.09,"65",.78,"sfp",.029));return {components,ports};
}

/** Trace5210's rear four tall fan modules, lower opposing1100W supplies and protective earth point. */
function rear5210(d) {
  const components=[part("button",.914,.265,.012,.08,"protective-earth")],ports=[];
  for(let n=0;n<4;n++)components.push(part("fan",.197+n*.154,.27,.146,.69,`chassis-fan-${n}`,"juniper-qfx-spine-fan5210"));
  for(let n=0;n<2;n++){
    const x=.05+n*.777;components.push(part("panel",x+.058,.52,.017,.40,`psu${n}-handle`,"juniper-qfx-spine-latch"));
    components.push(part("vent",x+.081,.54,.022,.22,`psu${n}-grille`,"juniper-qfx-spine-grille"),part("status",x+.081,.82,.012,.075,`psu${n}-status`,"juniper-qfx-spine-status1"),part("panel",x+.111,.71,.014,.20,`psu${n}-ejector`,"juniper-qfx-spine-ejector"));
    ports.push(socket(d,69+n,x+.009,.58,.040,.27,`PSU${n}`,.937,"juniper-qfx-spine-c16-1100",.05));
  }return {components,ports};
}

/** Trace5220's DD front panel with its distinct grandmaster input and four timing SMB jacks. */
function front5220(d) {
  const components=[part("vent",.108,.015,.75,.075,"upper-intake","juniper-qfx-spine-mesh"),part("status",.090,.09,.010,.30,"system-status","juniper-qfx-spine-status3"),
    part("rj45",.044,.225,.030,.25,"grandmaster-clock-input"),part("button",.041,.84,.008,.09,"esd"),part("usb",.943,.24,.011,.30,"usb-storage"),part("button",.946,.67,.007,.075,"reset"),part("panel",.923,.91,.028,.075,"serial-number-pullout","juniper-qfx-spine-pullout")];ears(components);
  for(const [n,role] of ["pps-output","pps-input","10mhz-output","10mhz-input"].entries())components.push(part("coax",.055+(n%2)*.026,.58+Math.floor(n/2)*.23,.014,.14,role,"juniper-qfx-spine-smb"));
  const ports=[];for(let n=0;n<32;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.108+col*.0445+Math.floor(col/2)*.005,n%2?.615:.285,.041,.215,String(n),n%2?.935:.175,"qsfp",.041));}
  for(let n=0;n<2;n++)ports.push(socket(d,33+n,.862,n?.630:.280,.030,.18,String(32+n),n?.930:.170,"sfp",.030));
  const mgmt=socket(d,35,.901,.535,.030,.25,"MGMT",.847,"rj45",.039);mgmt.compatibleTypes=["RJ45_1G"];
  ports.push(mgmt,socket(d,36,.901,.175,.030,.25,"CON",.075,"rj45",.035));return {components,ports};
}

/** Trace5220's six fans between exact1600W supplies at opposite rear ends. */
function rear5220(d) {
  const components=[],ports=[];for(let n=0;n<6;n++)components.push(part("fan",.196+n*.101,.025,.094,.95,`chassis-fan-${n}`,"juniper-qfx-spine-fan5220"));
  supply1U(d,components,ports,.048,37,"1600");supply1U(d,components,ports,.823,38,"1600");return {components,ports};
}

/** Separate each selected1U PSU's handle, grille, lamps, inlet and ejector to keep physical sockets unoccluded. */
function supply1U(d,components,ports,x,index,wattage) {
  components.push(part("vent",x,.07,.033,.35,`psu${index}-grille`,"juniper-qfx-spine-grille"),part("status",x,.51,.026,.38,`psu${index}-status`,"juniper-qfx-spine-status3"),
    part("panel",x+.038,.045,.017,.91,`psu${index}-handle`,"juniper-qfx-spine-latch"),part("panel",x+.115,.64,.012,.26,`psu${index}-ejector`,"juniper-qfx-spine-ejector"));
  ports.push(socket(d,index,x+.062,.225,.040,.55,`PSU${index-37}`,.927,wattage==="850"?"juniper-qfx-spine-c14-850":"juniper-qfx-spine-c16-1600",.049));
}
