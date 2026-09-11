import {canonicalFaceplateDevice} from "./faceplate-profile.js";
import {buildCiscoMerakiModelFaceplate} from "./faceplate-cisco-meraki-models.js";
const models=new Map([["Meraki MS120",120],["Meraki MS210",210],["Meraki MS225",225]]),cache=new Map();
const guide="https://documentation.meraki.com/Switching/MS_-_Switches/Install_and_Get_Started/Installation_Guides/";
const datasheet="https://documentation.meraki.com/Switching/MS_-_Switches/Product_Information/Overviews_and_Datasheets/";

/** Fit the selected1U Meraki body within each saved allocation while keeping stored inventory untouched. */
export function resolveMerakiAccessFaceplate(device){
  const series=models.get(device?.model);if(!series||device.faceplate?.vendor!=="Cisco")return null;
  if(!cache.has(series)){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set(series,{profile:buildProfile(canonical.device,series),allocations:new Map()});}
  const entry=cache.get(series),units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!entry.allocations.has(units)){const chassis=entry.profile.chassis;entry.allocations.set(units,{...entry.profile,chassis:{...chassis,y:chassis.y/units,height:chassis.height/units}});}
  return entry.allocations.get(units);
}

/** Declare the exact48FP population, source evidence and independently verified legacy index maps. */
function buildProfile(device,series){
  const basic=series===120,sku=`MS${series}-48FP`,source=`${guide}MS${series}_Series_Installation_Guide`,width=basic?17.32/17.5:1,body=width*690*(basic?1.73/17.32:1.72/19);
  const configuration=`${sku}:48PoE+ copper ports,740WPoE budget,four${series===225?"10G SFP+":"1G SFP"} uplinks, fixed internal AC power and cooling.${basic?" No physical stacking.":" Two40GQSFP stacking sockets; optional external RPS2300 is not installed."}`;
  const faces=basic?panels120(device):structuredClone(buildCiscoMerakiModelFaceplate({...device,model:"Meraki MS225-48FP"}).faces);
  for(const [face,panel]of Object.entries(faces)){
    for(const slot of panel.ports){
      if(face==="front"&&slot.portIndex<=48)slot.connectorKind=slot.portIndex%2?"rj45-inverted":"rj45";
      if(face==="rear"&&slot.portIndex===(basic?53:55))slot.connectorKind="rj45-inverted";
      if(slot.type==="SFP_1G")slot.compatibleTypes=["SFP_PLUS_10G"];
      const management=face==="rear"&&slot.portIndex===(basic?53:55),stack=face==="rear"&&!management;
      slot.descriptionAnchor={x:slot.x,y:face==="front"?(slot.y<.5?.115:.915):management?.91:.47,fontSize:5.5,boxHeight:7,boxWidth:management?.057:stack?.041:.027};
    }
    for(const component of panel.components){if(component.kind==="vent")component.variant="meraki-access-grille";if(component.variant==="dc-multipin")component.variant="meraki-access-rps";}
  }
  return {id:`meraki-${sku.toLowerCase()}-selected`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryComplete:true,inventoryRevision:1,rearHardwareVerified:true,defaultFace:"front",source,
    sourcePage:`MS${series}-48 front and MS${series} rear illustrations; individual48FP datasheet table`,
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,front:source,rear:source,datasheet:`${datasheet}MS${series}_Datasheet`,
      ...(basic?{}:{geometryReuse:"MS210/MS225 manufacturer diagrams share the same socket and fixed-power layout; exactMS225-48FP geometry is reused."})},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:52},(_,i)=>[i+1,i+1])),53:basic?53:55},portLabels:{53:"MGMT"}}],
    catalogDiscrepancies:[basic?"Historical53endpoints retain their physical positions. The four documented1G optical cages accept an explicit historicalSFP+ type mapping without changing saved10G types/speeds; this does not assert10G operation.":"Historicaldata1–52 map unchanged, MGMT53 maps55. NewSTACK53/54 exist only in new inventory; saved devices gain no sockets.",
      series===210?"MS210's four uplinks are1G SFP. HistoricalSFP+ types/speeds remain stored and map only through explicit optical cage compatibility;10G operation is not implied.":"Physical socket shape never overrides saved endpoint settings."],
    limitations:[configuration,"Only this48FP configuration is represented. Fans and power supplies are fixed internal components, not removable external modules. The rear grille does not imply an externally visible rotor count.","No serial console or storageUSB socket exists in these source panels. The22-contact RPS fitting is decorative; no RPS chassis or cable is synthesized. Tiny printing and perforation density are simplified.","Saved IDs, custom labels/types/speeds/VLANs, cables, sparse/reordered arrays and rack allocations remain unchanged. Unknown revisions remain unmapped."],
    chassis:{x:(1-width)/2,y:.055,width,height:(body>=64?body+16:body/.8)/100},faces};
}

/** Bind a measuredMS120 socket to its immutable catalog identity. */
function socket(device,index,x,y,width,height,label){const port=device.ports.find(port=>port.portIndex===index);return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height};}

/** Describe source-visible hardware without creating a logical endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace theMS12048 copper banks and paired1G uplinks opposite its single management/grille/AC assembly. */
function panels120(device){
  const ports=[];
  for(let i=0;i<48;i++){const col=Math.floor(i/2),x=.117+col*.0287+Math.floor(col/6)*.010;ports.push(socket(device,i+1,x,i%2?.66:.35,.026,.22,String(i+1)));}
  for(let i=0;i<4;i++)ports.push(socket(device,i+49,.857+Math.floor(i/2)*.030,i%2?.66:.35,.027,.20,String(i+49)));
  return {front:{ports,components:[part("text",.91,.57,.054,.20,undefined,"CISCO"),part("led",.064,.30,.005,.04),part("led",.064,.69,.005,.04),part("button",.061,.80,.009,.08,"reset")]},
    rear:{ports:[socket(device,53,.144,.635,.033,.22,"MGMT")],components:[part("vent",.382,.294,.111,.60,"meraki-access-grille"),part("power",.842,.19,.064,.52,"ac","AC"),part("screw",.060,.82,.010,.08)]}};
}
