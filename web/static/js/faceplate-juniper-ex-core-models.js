import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"EX4400 family":{sku:"EX4400-48P",width:441.7,rack:482,depth:440.7,source:"https://www.juniper.net/documentation/us/en/hardware/ex4400/ex4400.pdf",pages:"PDF24 module;52 fig25/27 front;53 fig28 rear;54–55 factory/dimensions;117 fig82 PSU;118 inlet",
  configuration:"EX4400-48P with explicitly installed optional EX4400-EM-4Y four25G module,48 copper PoE-bt ports and two fixed100G QSFP28 cages; each defaults to two logical50G VCP interfaces, with100G network mode configurable. Physical cages are counted once; no breakout inventory or optics. One factory JPSU-1600-C-AC-AFO inPSU0, PSU1 covered, two orange AIR OUT fan modules and supplied EX-RMK front brackets. Front USB-C console; rear RJ45 console/MGMT and ancillary USB-A storage. Portrait high-temperature C16 inlet accepts C15 cord; source PSU drawing shows the extraction handle across its fan."},
  "EX4600 family":{sku:"EX4600-40F-AFO",width:440.9,rack:482.6,depth:520.2,source:"https://www.juniper.net/documentation/us/en/hardware/ex4600/ex4600.pdf",pages:"PDF27 fig9 front;30 fig12 rear;31 fig13 management;45–48 PSU;90 rack kit; official datasheet dimensions/order table",
    configuration:"EX4600-40F-AFO base configuration with24 fixed SFP+10G cages and four fixed QSFP+40G cages, both expansion bays fitted with QFX5100-EM-BLNK covers; no optics, breakout endpoints or Virtual Chassis configuration assumed. Two factory JPSU-650W-AC-AFO supplies, five QFX5100-FAN-AFO modules and supplied four-post19in rack kit; airflow from port side to FRU side. Rear C0 RJ45 and C1 SFP management, RJ45 console and ancillary USB-A storage. Left-keyed portrait C14 inputs have visible retention clips."}};
const cache=new Map();

/** Resolve only the selected EX4400/EX4600 aliases, keeping native body proportions in every saved rack allocation. */
export function resolveJuniperEXCoreFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Bind source evidence and an explicit type-guarded mapping from the executed original60-port constructor. */
function buildProfile(d,s) {
  const ex4400=s.sku==="EX4400-48P",body=690*43.7/s.rack,portIndexMap=ex4400?{...Object.fromEntries(Array.from({length:52},(_,i)=>[i+1,i+1])),59:55,60:56}:{59:29};
  return {id:`juniper-ex-core-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,defaultFace:"front",rearHardwareVerified:true,
    source:s.source,sourcePage:s.pages,note:s.configuration,evidence:{scope:"model",models:[s.sku],catalogAlias:d.model,selectedModel:s.sku,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.source,rear:s.source,
      physicalDimensions:{heightMm:43.7,widthMm:s.width,rackWidthMm:s.rack,depthMm:s.depth}},
    limitations:[s.configuration,"Original frozen438 inventories contain48RJ45_1G, eightSFP28_25G49–56,40GStack57/58,MGMT59 andUSB_C_CONSOLE60 in1U. EX4400 maps52 compatible data ports plusMGMT/USB-C. EX4600 maps onlyMGMT; no copper-to-fiber,25G-to10G or unconfiguredStack coercion.",
      "All original IDs, labels, types, speeds, PoE/VLAN settings, cable objects and rack allocations remain unchanged. Only new instances receive the selected complete inventory. Missing physical sockets are noninteractive ancillary artwork; unknown revisions and incompatible edited types remain unmapped.",
      "LEDs are inactive; USB-A storage is ancillary. EX4600 datasheet dimensions43.7x440.9x520.2mm correct the hardware guide's contradictory metric depth entry. Rack brackets are shown at nominal19in span; the supplied four-post supports do not create rear faceplate ears."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{...Object.fromEntries(Array.from({length:56},(_,i)=>[i+1,String(i+1)])),57:"VC1",58:"VC2",59:"MGMT",60:"CONSOLE"}}],
    chassis:{x:0,y:.1,width:1,height:(body<64?body/.8:body+16)/100},faces:ex4400?{front:front4400(d),rear:rear4400(d)}:{front:front4600(d),rear:rear4600(d)}};
}

/** Describe an inactive source-local component using normalized top-left extents. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Convert traced socket edges to scene centers while retaining canonical index/type and source-local captions. */
function socket(d,index,x,y,width,height,label,captionY,kind="rj45",captionWidth=.036) {
  const p=d.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add the selected rack bracket pair, keeping its mounting holes inside the declared19in envelope. */
function ears(components) {for(const x of [.001,.964])components.push(part("rack-ear",x,.015,.035,.97,`rack-ear-${x<.5?"left":"right"}`,"juniper-ex-core-ear"));}

/** Trace the EX4400 four12-port copper banks and installed EX4400-EM-4Y below its USB-C/status controls. */
function front4400(d) {
  const components=[part("vent",.052,.018,.745,.085,"front-upper-intake","juniper-ex-core-mesh"),part("status",.895,.14,.040,.28,"front-status","juniper-ex-core-status8"),
    part("button",.947,.23,.011,.10,"mode-reset"),part("vent",.823,.49,.121,.062,"extension-grille","juniper-ex-core-mesh"),
    part("panel",.813,.990,.139,.007,"extension-bottom","juniper-ex-core-edge"),part("screw",.803,.72,.009,.085,"extension-left-screw"),part("screw",.952,.72,.009,.085,"extension-right-screw")];ears(components);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.052+col*.02955+Math.floor(col/6)*.0075,n%2?.635:.290,.0265,.235,String(n),n%2?.928:.190,"rj45",.0265));}
  ports.push(socket(d,56,.838,.185,.029,.105,"CON",.375,"usb-c",.040));
  for(let n=0;n<4;n++)ports.push(socket(d,49+n,.817+n*.033,.660,.029,.19,String(n),.923,"sfp",.030));return {components,ports};
}

/** Trace EX4400 figure28's single supply, central solid panel, separated orange fans and management/QSFP block. */
function rear4400(d) {
  const components=[part("usb",.119,.14,.011,.285,"usb-storage"),part("panel",.014,.67,.030,.21,"claim-code","juniper-ex-core-label"),
    part("button",.077,.785,.014,.13,"earth-1"),part("button",.112,.785,.014,.13,"earth-2"),part("button",.119,.51,.007,.065,"factory-reset"),
    part("status",.209,.235,.012,.46,"qsfp-status","juniper-ex-core-status4"),part("panel",.228,.08,.006,.65,"clei-label","juniper-ex-core-label"),part("button",.226,.83,.016,.15,"esd"),
    part("fan",.251,.025,.092,.95,"chassis-fan-0","juniper-ex-core-fan4400"),part("panel",.348,.025,.118,.95,"solid-center-panel","juniper-ex-core-solid"),
    part("fan",.472,.025,.092,.95,"chassis-fan-1","juniper-ex-core-fan4400"),part("fan",.582,.035,.091,.92,"psu0-fan-handle","juniper-ex-core-psu4400"),
    part("status",.677,.12,.012,.12,"psu0-out-ok","juniper-ex-core-status1"),part("panel",.741,.13,.014,.71,"psu0-ejector","juniper-ex-core-latch"),
    part("panel",.777,.03,.206,.94,"spare-psu-cover","juniper-ex-core-cover4400")];
  return {components,ports:[socket(d,57,.027,.235,.032,.255,"CON",.105,"rj45",.043),socket(d,55,.077,.235,.032,.255,"MGMT",.105,"rj45",.046),
    socket(d,53,.146,.225,.048,.20,"V0",.105,"qsfp",.040),socket(d,54,.146,.625,.048,.20,"V1",.933,"qsfp",.040),
    socket(d,58,.696,.26,.040,.54,"PSU0",.923,"juniper-ex-core-c16-portrait",.047)]};
}

/** Trace the base EX4600's24 SFP+ cages, separate fourQSFP+ block and two documented blank expansion bays. */
function front4600(d) {
  const components=[part("button",.043,.81,.014,.13,"esd"),part("vent",.059,.018,.505,.085,"front-upper-intake","juniper-ex-core-mesh"),
    part("panel",.584,.02,.183,.96,"expansion-cover-1","juniper-ex-core-expansion-cover"),part("panel",.772,.02,.183,.96,"expansion-cover-2","juniper-ex-core-expansion-cover")];ears(components);
  const ports=[];for(let n=0;n<24;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.063+col*.031+Math.floor(col/6)*.012,n%2?.635:.290,.028,.20,String(n),n%2?.928:.190,"sfp",.029));}
  for(let n=0;n<4;n++)ports.push(socket(d,25+n,.460+Math.floor(n/2)*.057,n%2?.635:.290,.043,.215,String(24+n),n%2?.928:.190,"qsfp",.044));return {components,ports};
}

/** Trace EX4600's rear console/C0/C1 cluster, five QFX5100-FAN-AFO units and both factory650W supplies. */
function rear4600(d) {
  const components=[part("status",.016,.275,.018,.44,"system-status","juniper-ex-core-status4"),part("usb",.119,.46,.013,.30,"usb-storage"),part("button",.083,.845,.008,.08,"reset")];
  const ports=[socket(d,31,.075,.19,.029,.225,"CON",.080,"rj45",.039),socket(d,29,.075,.550,.029,.225,"C0",.485,"rj45",.039),socket(d,30,.039,.630,.030,.16,"C1",.933,"sfp",.033)];
  for(let n=0;n<5;n++)components.push(part("fan",.156+n*.104,.025,.094,.95,`chassis-fan-${n}`,"juniper-ex-core-fan4600"));
  for(let n=0;n<2;n++) {
    const x=.684+n*.155;components.push(part("vent",x,.07,.035,.35,`psu${n}-grille`,"juniper-ex-core-psu4600-grille"),part("status",x,.51,.028,.38,`psu${n}-status`,"juniper-ex-core-status3"),
      part("panel",x+.041,.045,.017,.91,`psu${n}-handle`,"juniper-ex-core-latch"),part("panel",x+.123,.20,.017,.72,`psu${n}-ejector`,"juniper-ex-core-latch"));
    ports.push(socket(d,32+n,x+.066,.225,.040,.55,`PSU${n}`,.927,"juniper-ex-core-c14-portrait",.048));
  }
  return {components,ports};
}
