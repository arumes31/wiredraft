import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const selections={"QFX5100 family":{sku:"QFX5100-48S-AFO",dataPorts:54,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5100/qfx5100.pdf",pages:"PDF36 fig14 front;52 fig20 rear;53 fig22 left management;63/68 PSU;76 fan; datasheet dimensions and revision ordering",
  configuration:"Original QFX5100-48S-AFO with48SFP+10G and sixQSFP+40G cages, no optics or breakout endpoints. Two factory JPSU-650W-AC-AFO supplies and five QFX5100-FAN-AFO modules, port-to-FRU airflow, supplied four-post19in rack kit. Original management panel has C0 RJ45 and C1 SFP; the separately ordered later3AFO dual-SFP revision is excluded. Rear RJ45 console and ancillary USB-A storage. No Virtual Chassis configuration or installed expansion cards asserted."},
  "QFX5110 family":{sku:"QFX5110-48S-AFO",dataPorts:52,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5110/qfx5110.pdf",pages:"PDF32 fig14 front/timing;41 fig16/17 rear;49 fig20 fan;55–60 PSU;75 dimensions",
    configuration:"QFX5110-48S-AFO with48SFP+10G and fourQSFP28-100G cages, no optics or breakout endpoints. Two factory JPSU-650W-AC-AFO supplies and five QFX5110-48S-FANAFO modules, port-to-FRU airflow, explicitly selected JNP-4PST-RMK-1U-E four-post19in kit with central front thumbscrews. Rear C0 RJ45/fiber combo management has copper priority; separate C1 SFP and RJ45 console. Front grandmaster-clock RJ45 and10MHz/PPS SMB outputs, plus rear USB-A storage, are distinct ancillary hardware rather than new Ethernet/console endpoints."}};
const cache=new Map();

/** Resolve the two documented QFX configurations while preserving larger original2U and edited saved allocations. */
export function resolveJuniperQFXAccessFaceplate(device) {
  const s=selections[device?.model];if(!s||device.faceplate?.vendor!=="Juniper"||device.category!=="Switch")return null;
  const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
  if(!cache.has(canonical.catalog))cache.set(canonical.catalog,{profile:buildProfile(canonical.device,s),allocations:new Map()});
  const c=cache.get(canonical.catalog),units=Math.max(1,Number(device.faceplate.unitsU)||1);if(units===1)return c.profile;
  if(!c.allocations.has(units))c.allocations.set(units,{...c.profile,chassis:{...c.profile.chassis,y:c.profile.chassis.y/units,height:c.profile.chassis.height/units}});
  return c.allocations.get(units);
}

/** Describe the selected chassis and explicitly map only original compatible management/console identities. */
function buildProfile(d,s) {
  const q5110=s.dataPorts===52,body=690*43.7/482.6;
  return {id:`juniper-qfx-access-${s.sku.toLowerCase()}`,family:s.sku,sku:s.sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,defaultFace:"front",rearHardwareVerified:true,
    source:s.source,sourcePage:s.pages,note:s.configuration,evidence:{scope:"model",models:[s.sku],catalogAlias:d.model,selectedModel:s.sku,sku:s.sku,configuration:s.configuration,reviewed:"2026-09-11",front:s.source,rear:s.source,
      physicalDimensions:{heightMm:43.7,widthMm:440.9,rackWidthMm:482.6,depthMm:520.2}},
    limitations:[s.configuration,"Actual frozen438 constructor stored2U58ports: SFP28_25G1–48, QSFP_DD_400G49–56,MGMT57,Console58. OnlyMGMT andConsole map; all56 incompatible data placeholders remain unmapped without changing their types, speeds or cable references.",
      "Full saved IDs, labels, PoE/VLAN/settings, sparse/reordered arrays and rack placements are preserved. Missing revision means original inventory; unknown revisions and edited incompatible types stay unmapped. Only new instances receive full selected inventories; unclaimed canonical sockets remain noninteractive artwork.",
      "All lamps are inactive; timing/USB-storage artwork does not imply network endpoints. Each physical cage is represented once. QFX5110 C0 copper and fiber are alternative media for the same management interface; copper has priority when both are cabled. Their socket depiction does not simulate that selection.",
      "Native43.7mm body and nominal19in supplied bracket span preserve1U geometry inside old2U allocations. QFX5100 guide figure20 reuses an EX4600-labeled drawing; its QFX caption and matching exact QFX5100-FAN-AFO/JPSU-650W-AC-AFO part tables verify common rear hardware, while QFX figure22 governs the selected original management revision."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap:q5110?{57:53,58:56}:{57:55,58:57},portLabels:{...Object.fromEntries(Array.from({length:56},(_,i)=>[i+1,String(i+1)])),57:"MGMT",58:"CONSOLE"}}],
    chassis:{x:0,y:.1,width:1,height:(body<64?body/.8:body+16)/100},faces:{front:q5110?front5110(d):front5100(d),rear:rear(d,s)}};
}

/** Define source ancillary components using normalized top-left rectangles, with all status artwork inactive. */
function part(kind,x,y,width,height,role,variant,extra={}) {return {kind,x,y,width,height,role,active:false,...(variant?{variant}:{}),...extra};}

/** Convert traced top-left socket bounds to scene centers and bind the canonical endpoint's immutable index/type. */
function socket(d,index,x,y,width,height,label,captionY,kind="sfp",captionWidth=.030) {
  const p=d.ports.find(p=>p.portIndex===index);return {portIndex:index,type:p.type,label:p.label,physicalLabel:label,x:x+width/2,y:y+height/2,width,height,connectorKind:kind,
    descriptionAnchor:{x:x+width/2,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Add only the visible front bracket faces of the supplied four-post rack kit. */
function ears(components,q5110=false) {for(const x of [.001,.964])components.push(part("rack-ear",x,.015,.035,.97,`rack-ear-${x<.5?"left":"right"}`,q5110?"juniper-qfx-access-ear5110":"juniper-qfx-access-ear"));}

/** Trace QFX5100's four12-port SFP+ banks and distinct three-column QSFP+ block. */
function front5100(d) {
  const components=[part("vent",.055,.015,.895,.087,"upper-intake","juniper-qfx-access-mesh"),part("button",.042,.81,.013,.12,"esd")];ears(components);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.056+col*.0295+Math.floor(col/6)*.009,n%2?.635:.290,.026,.20,String(n),n%2?.928:.190,"sfp",.027));}
  for(let n=0;n<6;n++)ports.push(socket(d,49+n,.818+Math.floor(n/2)*.045,n%2?.635:.290,.040,.215,String(48+n),n%2?.928:.190,"qsfp",.041));return {components,ports};
}

/** Trace QFX5110's left timing cluster, four12-port SFP+ banks and separate two-column QSFP28 block. */
function front5110(d) {
  const components=[part("vent",.110,.015,.840,.087,"upper-intake","juniper-qfx-access-mesh"),part("button",.040,.84,.011,.10,"esd"),
    part("rj45",.044,.265,.029,.235,"grandmaster-clock-input"),part("text",.039,.095,.038,.09,"clock-input-caption",undefined,{text:"GM",fontSize:4.5}),
    part("coax",.044,.665,.015,.14,"pps-output","juniper-qfx-access-smb"),part("coax",.077,.665,.015,.14,"10mhz-output","juniper-qfx-access-smb"),
    part("text",.048,.865,.020,.09,"pps-caption",undefined,{text:"PPS",fontSize:4}),part("text",.075,.865,.026,.09,"10mhz-caption",undefined,{text:"10M",fontSize:4})];ears(components,true);
  const ports=[];for(let n=0;n<48;n++){const col=Math.floor(n/2);ports.push(socket(d,n+1,.109+col*.029+Math.floor(col/6)*.008,n%2?.635:.290,.0255,.20,String(n),n%2?.928:.190,"sfp",.026));}
  for(let n=0;n<4;n++)ports.push(socket(d,49+n,.846+Math.floor(n/2)*.055,n%2?.635:.290,.046,.215,String(48+n),n%2?.928:.190,"qsfp",.047));return {components,ports};
}

/** Trace each selected management revision while retaining its documented common five-fan/dual650W rear arrangement. */
function rear(d,s) {
  const q5110=s.dataPorts===52,m=s.dataPorts+1,con=q5110?56:57,power=q5110?57:58;
  const components=[part("status",.016,.275,.018,.44,"system-status","juniper-qfx-access-status4"),part("usb",.119,.46,.013,.30,"usb-storage"),part("button",.083,.845,.008,.08,"reset")];
  const ports=[socket(d,con,.075,.19,.029,.225,"CON",.080,"rj45",.039),socket(d,m,.075,.550,.029,.225,"C0",.485,"rj45",.039),
    socket(d,q5110?55:56,.039,.630,.030,.16,"C1",.933,"sfp",.029)];
  if(q5110)ports.push(socket(d,54,.039,.24,.030,.16,"C0",.105,"sfp",.029));
  for(let n=0;n<5;n++)components.push(part("fan",.156+n*.104,.025,.094,.95,`chassis-fan-${n}`,q5110?"juniper-qfx-access-fan5110":"juniper-qfx-access-fan5100"));
  for(let n=0;n<2;n++) {
    const x=.684+n*.155;components.push(part("vent",x,.07,.035,.35,`psu${n}-grille`,"juniper-qfx-access-psu-grille"),part("status",x,.51,.028,.38,`psu${n}-status`,"juniper-qfx-access-status3"),
      part("panel",x+.041,.045,.017,.91,`psu${n}-handle`,"juniper-qfx-access-latch"),part("panel",x+.123,.20,.017,.72,`psu${n}-ejector`,"juniper-qfx-access-latch"));
    ports.push(socket(d,power+n,x+.066,.225,.040,.55,`PSU${n}`,.927,"juniper-qfx-access-c14-portrait",.048));
  }
  return {components,ports};
}
