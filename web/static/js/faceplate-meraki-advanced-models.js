import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const models=new Map([["Meraki MS250",250],["Meraki MS350",350],["Meraki MS390",390]]),cache=new Map();
const guide="https://documentation.meraki.com/Switching/MS_-_Switches/Install_and_Get_Started/Installation_Guides/";
const sheets="https://documentation.meraki.com/Switching/MS_-_Switches/Product_Information/Overviews_and_Datasheets/";

/** Fit a selected native 1U chassis within its saved allocation without rewriting the installed inventory. */
export function resolveMerakiAdvancedFaceplate(device){
  const series=models.get(device?.model);if(!series||device.faceplate?.vendor!=="Cisco")return null;
  if(!cache.has(series)){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set(series,{profile:buildProfile(canonical.device,series),allocations:new Map()});}
  const entry=cache.get(series),units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!entry.allocations.has(units)){const chassis=entry.profile.chassis;entry.allocations.set(units,{...entry.profile,chassis:{...chassis,y:chassis.y/units,height:chassis.height/units}});}
  return entry.allocations.get(units);
}

/** Declare the exact installed configuration and the independently executed revision0 endpoint mapping. */
function buildProfile(device,series){
  const modular=series===390,sku=modular?"MS390-48P-HW":`MS${series}-48LP`,source=`${guide}MS${series}_Series_Installation_Guide`;
  const body=690*(modular?1.73/17.5:1.72/(series===350?19.07:19));
  const configuration=modular?`${sku}: 48 PoE+ copper ports; MA-MOD-8X10G installed with eight 10G SFP+ uplinks; two 120G stacking sockets; three MA-FAN-16K2 fans; one MA-PWR-715WAC supply in the primary bay and the secondary bay covered. Two StackPower fittings have no cables installed.`
    :`${sku}: 48 PoE+ copper ports, 370W PoE budget, four fixed 10G SFP+ uplinks and two 40G QSFP stack sockets. One MA-PWR-640WAC supply with C16 inlet is installed in the left power bay; the right bay is covered. ${series===250?"Cooling is fixed internally.":"Two removable fan assemblies are installed."}`;
  return {id:`meraki-advanced-${sku.toLowerCase()}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source,
    sourcePage:`MS${series}-48 front and MS${series} rear figures; individual model datasheet; official accessory photographs`,
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,front:source,rear:source,datasheet:`${sheets}MS${series}_Datasheet`,accessories:modular?"https://documentation.meraki.com/Switching/Cloud_Management_with_IOS_XE/Product_Information/Overviews_and_Datasheets/Accessories":`${sheets}Accessories`},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:{...Object.fromEntries(Array.from({length:52},(_,i)=>[i+1,i+1])),53:modular?59:55},portLabels:{53:"MGMT"}}],
    catalogDiscrepancies:[`Actual historical inventory has 48 RJ45, four SFP+ uplinks and MGMT53. Data1–52 retain their identities; MGMT53 maps to physical management position${modular?59:55}. Stacking sockets${modular?" and the additional four installed uplinks":""} exist as logical endpoints only in new instances.`,"No console or USB endpoint is synthesized. Unknown revisions and incompatible saved connector types remain unmapped."],
    limitations:[configuration,"Only this selected SKU and installed population is represented. No optical transceiver or stack cable is installed. Tiny printing and perforation density are simplified.","Saved device/port IDs, labels, types, speeds, VLAN settings, cable references, sparse/reordered arrays and rack allocations remain unchanged."],
    chassis:{x:0,y:.055,width:1,height:(body>=64?body+16:body/.8)/100},faces:modular?panels390(device):panelsFixed(device,series)};
}

/** Bind source-measured socket geometry to its immutable canonical index and reserved caption space. */
function socket(device,index,x,y,width,height,label,captionY,captionWidth=.028,kind){
  const port=device.ports.find(port=>port.portIndex===index);if(!port)throw new Error(`${device.model}: missing canonical socket ${index}`);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel:label,x,y,width,height,...(kind?{connectorKind:kind}:{}),descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Describe source-visible ancillary hardware without adding a logical network endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace MS250/MS350 fixed optical fronts and their distinct fixed-fan versus two-tray rear assemblies. */
function panelsFixed(device,series){
  const ports=[];
  for(let i=0;i<48;i++)ports.push(socket(device,i+1,.095+Math.floor(i/2)*.0286+(i>=24?.012:0),i%2?.69:.36,.025,.22,String(i+1),i%2?.925:.115,.027,i%2?"rj45":"rj45-inverted"));
  for(let i=0;i<4;i++)ports.push(socket(device,i+49,.829+i*.0292,.69,.027,.19,String(i+49),.925));
  const front={ports,components:[part("text",.883,.23,.058,.20,undefined,"CISCO"),part("led",.060,.30,.004,.04),part("led",.060,.59,.004,.04),...(series===250?[part("button",.058,.78,.007,.065,"reset")]:[])]};
  const mgmt=series===250?.105:.10,stack=series===250?.182:.176;
  const rearPorts=[socket(device,53,stack,.68,.041,.20,"STACK 1",.43,.049,"qsfp"),socket(device,54,stack+.044,.68,.041,.20,"STACK 2",.43,.049,"qsfp"),socket(device,55,mgmt,.635,.032,.24,"MGMT",.92,.065,"rj45-inverted")];
  const rear=[part("psu",.527,.045,.226,.91,"meraki-advanced-640w"),part("module-bay",.757,.045,.226,.91,"meraki-advanced-psu-cover")];
  if(series===350)rear.push(part("fan",.277,.045,.098,.91,"meraki-advanced-fan"),part("fan",.391,.045,.098,.91,"meraki-advanced-fan"),part("button",.064,.74,.007,.06,"reset"));
  return {front,rear:{ports:rearPorts,components:rear}};
}

/** Trace the installed eight-uplink MS390 front and its interleaved fan/stacking rear with source covers retained. */
function panels390(device){
  const ports=[];
  for(let i=0;i<48;i++){const col=Math.floor(i/2);ports.push(socket(device,i+1,.033+col*.0295+Math.floor(col/6)*.026,i%2?.72:.39,.027,.24,String(i+1),i%2?.935:.15,.028,i%2?"rj45":"rj45-inverted"));}
  for(let i=0;i<8;i++)ports.push(socket(device,i+49,.851+Math.floor(i/2)*.034,i%2?.72:.39,.030,.22,String(i+1),i%2?.935:.15,.033));
  const frontParts=[part("text",.021,.01,.040,.070,undefined,"CISCO"),part("button",.066,.025,.007,.065,"reset"),...Array.from({length:3},(_,i)=>part("vent",.221+i*.203,.014,.188,.065,"meraki-advanced-grille")),part("module-bay",.817,.016,.177,.045,"meraki-advanced-module-rail")];
  const rearPorts=[socket(device,57,.228,.51,.036,.68,"STACK 1",.935,.042,"meraki-advanced-stack"),socket(device,58,.373,.51,.036,.68,"STACK 2",.935,.042,"meraki-advanced-stack"),socket(device,59,.080,.69,.032,.23,"MGMT",.935,.055,"rj45")];
  const rear=[part("module-bay",.02,.05,.078,.36,"meraki-advanced-id-panel"),...[.11,.255,.40].map(x=>part("fan",x,.025,.095,.93,"meraki-advanced-fan")),part("power",.525,.035,.058,.435,"meraki-advanced-stackpower"),part("power",.525,.515,.058,.435,"meraki-advanced-stackpower"),part("psu",.590,.025,.186,.93,"meraki-advanced-715w"),part("module-bay",.783,.025,.211,.93,"meraki-advanced-psu-cover")];
  return {front:{ports,components:frontParts},rear:{ports:rearPorts,components:rear}};
}
