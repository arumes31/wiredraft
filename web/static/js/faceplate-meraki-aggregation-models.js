import {canonicalFaceplateDevice} from "./faceplate-profile.js";
const models=new Map([["Meraki MS410",410],["Meraki MS425",425],["Meraki MS450",450]]),cache=new Map();
const base="https://documentation.meraki.com/Switching/MS_-_Switches/";
const photo425="https://dedicatednetworksinc.com/wp-content/uploads/2021/05/MS425-32-HW-back-1.png";

/** Fit a documented aggregation chassis inside the actual saved allocation without migrating its endpoints. */
export function resolveMerakiAggregationFaceplate(device){
  const series=models.get(device?.model);if(!series||device.faceplate?.vendor!=="Cisco")return null;
  if(!cache.has(series)){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set(series,{profile:buildProfile(canonical.device,series),allocations:new Map()});}
  const entry=cache.get(series),units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!entry.allocations.has(units)){const chassis=entry.profile.chassis;entry.allocations.set(units,{...entry.profile,chassis:{...chassis,y:chassis.y/units,height:chassis.height/units}});}
  return entry.allocations.get(units);
}

/** Keep hardware evidence and conservative historical maps explicit for these former generic copper aliases. */
function buildProfile(device,series){
  const sku=`MS${series}-${series===450?12:32}`,source=`${base}Install_and_Get_Started/Installation_Guides/MS${series}_Series_Installation_Guide`,management=series===410?39:series===425?35:17;
  const width=series===410?17.33/17.5:1,ratio=series===410?1.74/17.33:1.72/(series===450?19.08:19),body=690*width*ratio;
  const configuration=series===410?`${sku}: 32 fixed 1G SFP, four dedicated 10G SFP+ uplinks, two rear 40G stacking sockets, management, two removable fan assemblies, factory 250W AC supply in the left bay and right bay covered.`
    :series===425?`${sku}: 32 fixed 10G SFP+ and two 40G QSFP+ front Ethernet ports; flexible stacking uses these existing ports. Rear management, three factory fan assemblies, factory 250W AC supply in the right bay and left bay covered. No dedicated rear stacking connectors.`
    :`${sku}: twelve fixed 40G QSFP+ and two 100G QSFP28 front ports, two dedicated rear 100G stacking sockets, management, three removable fans, factory 250W AC supply in the left bay and right bay covered.`;
  const map={53:management};if(series===410)for(let i=0;i<4;i++)map[49+i]=33+i;
  return {id:`meraki-aggregation-${sku.toLowerCase()}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,source,
    sourcePage:`MS${series} front/rear illustrations, individual datasheet, supply installation figure${series===425?"; populated rear supplemented by actual MS425-32 retailer photograph":""}`,
    evidence:{scope:"model",models:[sku],selectedModel:sku,catalogAlias:device.model,configuration,front:source,rear:source,datasheet:`${base}Product_Information/Overviews_and_Datasheets/MS${series}_Datasheet`,
      ...(series===425?{rearPopulationPhoto:photo425,rearPopulationBasis:"Manufacturer counts/types and empty-bay outline; original DedicatedNetworks MS425-32 product photographs establish installed fan/cover subpositions. Fan part revision is not asserted."}:{})},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:map,portLabels:{53:"MGMT"}}],
    catalogDiscrepancies:[`Actual historical inventory has 48 RJ45, four SFP+ indices49–52 and management53. Management53 maps to physical${management}. ${series===410?"The four historical 10G uplinks map by ordinal to dedicated SFP+33–36; 48 invented copper endpoints remain unmapped.":"All52 former data endpoints remain unmapped: no source-supported correspondence to these optical data positions is established."}`,"Unmapped endpoint IDs, settings and cable references remain available for routing and inspection. New physical inventory is created only for new instances; no saved endpoint is retyped or deleted."],
    limitations:[configuration,"No optical transceiver or stack cable is installed. Small printing, decorative logos and perforation density are simplified. Unknown inventory revisions and incompatible types remain unmapped.",
      ...(series===425?["The manufacturer rear drawing omits installed fans/supplies. Rear fan subpositions and angular pull handles are photo-supported by an original MS425-32 retailer photograph, not manufacturer-diagram verified. Its empty right PSU bay is populated using the manufacturer installation drawing and factory 250W requirement."]:[]),
      ...(series===410?["The datasheet inch and centimeter dimensions conflict; the explicitly printed 1.74in height and17.33in width determine the rendered body aspect."]:[]),
      ...(series===450?["The guide reuses a rear image named MS355-Rear. Socket/fan/PSU-bay positions are corroborated by its MS450 tables; the selected250W C14 supply follows the installation-step drawing and250W accessory photo, without copying the larger supply's heat-key notch."]:[])],
    defaultFace:"front",chassis:{x:(1-width)/2,y:.055,width,height:(body>=64?body+16:body/.8)/100},faces:series===450?panels450(device):panelsSFP(device,series)};
}

/** Bind each socket to its canonical identity with an independent bounded description anchor. */
function socket(device,index,x,y,width,height,label,captionY,captionWidth=.030,kind){
  const port=device.ports.find(port=>port.portIndex===index);if(!port)throw new Error(`${device.model}: missing canonical port${index}`);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,...(kind?{connectorKind:kind}:{}),descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Describe source-visible ancillary hardware without manufacturing a logical network endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the MS410/MS425 paired optical banks and their different stacking and rear cooling populations. */
function panelsSFP(device,series){
  const ports=[];for(let i=0;i<32;i++)ports.push(socket(device,i+1,.334+Math.floor(i/2)*.0288+(i>=16?.011:0),i%2?.66:.34,.027,.22,String(i+1),i%2?.925:.115,.029,i%2?"meraki-aggregation-sfp-up":"sfp"));
  if(series===410)for(let i=0;i<4;i++)ports.push(socket(device,i+33,.815+i*.030,.69,.028,.20,String(i+33),.925));
  else for(let i=0;i<2;i++)ports.push(socket(device,i+33,.861+i*.040,.69,.038,.20,String(i+33),.925,.042,"qsfp"));
  const front={ports,components:[part("text",.883,.23,.060,.19,undefined,"CISCO"),part("led",.065,.47,.004,.04)]};
  if(series===410)return {front,rear:{ports:[socket(device,37,.175,.70,.041,.20,"STACK 1",.44,.049,"qsfp"),socket(device,38,.218,.70,.041,.20,"STACK 2",.44,.049,"qsfp"),socket(device,39,.099,.64,.032,.23,"MGMT",.92,.060,"rj45-inverted")],components:[part("button",.063,.76,.007,.06,"reset"),part("fan",.277,.04,.098,.92,"meraki-aggregation-fan"),part("fan",.391,.04,.098,.92,"meraki-aggregation-fan"),part("psu",.527,.04,.226,.92,"meraki-aggregation-250w"),part("module-bay",.757,.04,.226,.92,"meraki-aggregation-cover")]}};
  return {front,rear:{ports:[socket(device,35,.108,.74,.032,.22,"MGMT",.935,.057,"rj45")],components:[part("button",.065,.78,.007,.06,"reset"),...[.17,.285,.40].map(x=>part("fan",x,.035,.102,.92,"meraki-aggregation-425-fan")),part("module-bay",.529,.035,.227,.92,"meraki-aggregation-cover"),part("psu",.761,.035,.225,.92,"meraki-aggregation-250w")]}};
}

/** Trace MS450's three horizontal QSFP banks and paired uplink/stacking cages opposite its three-fan rear. */
function panels450(device){
  const ports=[];for(let i=0;i<12;i++)ports.push(socket(device,i+1,.381+i*.039+Math.floor(i/4)*.010,.695,.037,.22,String(i+1),.925,.039,"qsfp"));
  ports.push(socket(device,13,.878,.36,.038,.23,"13",.135,.04,"qsfp"),socket(device,14,.878,.70,.038,.23,"14",.935,.04,"meraki-aggregation-qsfp-up"));
  const rearPorts=[socket(device,15,.145,.31,.041,.23,"STACK 1",.105,.058,"qsfp"),socket(device,16,.145,.71,.041,.23,"STACK 2",.935,.058,"meraki-aggregation-qsfp-up"),socket(device,17,.090,.665,.032,.23,"MGMT",.935,.052,"rj45-inverted")];
  return {front:{ports,components:[part("text",.914,.56,.057,.22,undefined,"CISCO"),part("led",.065,.47,.004,.04)]},rear:{ports:rearPorts,components:[part("button",.058,.78,.007,.06,"reset"),...[.192,.297,.402].map(x=>part("fan",x,.035,.091,.93,"meraki-aggregation-fan")),part("psu",.532,.035,.211,.93,"meraki-aggregation-250w"),part("module-bay",.751,.035,.222,.93,"meraki-aggregation-cover")]}};
}
