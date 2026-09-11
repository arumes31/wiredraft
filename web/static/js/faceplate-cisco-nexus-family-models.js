import {canonicalFaceplateDevice} from "./faceplate-profile.js";
const models=["Nexus 3000 family","Nexus 5000 family"],cache=new Map();
const source3000="https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus3000/hw/installation/guide/b_n3000_hardware_install_guide/b_n93128_hardware_install_guide_chapter_01001.pdf";
const source5000="https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus5000/hw/installation/guide/nexus_5000_hig/overview5500.pdf";

/** Fit each selected native1U Nexus chassis within its actual saved allocation without modifying inventory. */
export function resolveCiscoNexusFamilyFaceplate(device){
  if(device?.faceplate?.vendor!=="Cisco"||!models.includes(device.model))return null;
  if(!cache.has(device.model)){
    const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;
    cache.set(device.model,{profile:buildProfile(canonical.device),allocations:new Map()});
  }
  const entry=cache.get(device.model),units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!entry.allocations.has(units)){
    const native=entry.profile.chassis;
    entry.allocations.set(units,{...entry.profile,chassis:{...native,y:native.y/units,height:native.height/units}});
  }
  return entry.allocations.get(units);
}

/** Declare exact installed hardware and revision-zero maps verified against the real historical constructor. */
function buildProfile(device){
  const large=device.model===models[1],sku=large?"N5K-C5548UP-FA":"N3K-C3064PQ-10GX",source=large?source5000:source3000;
  const width=17.3/17.5,body=width*690*1.72/17.3,portIndexMap=Object.fromEntries(Array.from({length:large?32:52},(_,i)=>[i+1,i+1]));
  portIndexMap[55]=large?33:53;portIndexMap[56]=large?34:55;
  const configuration=large?"N5K-C5548UP-FA with two N55-PAC-750W, two N5548P-FAN modules and covered GEM bay; port-side exhaust.32unified cages selected in10G Ethernet mode."
    :"N3K-C3064PQ-10GX with two N2200-PAC-400W and one N3K-C3064-FAN tray; port-side exhaust.48SFP+ and four QSFP+ sockets, two management ports and RJ45 console.";
  return {id:`cisco-nexus-${large?5548:3064}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryComplete:true,inventoryRevision:1,rearHardwareVerified:true,defaultFace:large?"rear":"front",source,
    sourcePage:large?"Figures1-16/1-17 pages19/20, AC supply25 and fan26; management detail Figure1-2":"Figures5/6 pages6/7, rear service detail Figure5",
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,
      front:`${source}#page=${large?19:7}`,rear:`${source}#page=${large?20:6}`,
      supplemental:large?"https://www.cisco.com/c/en/us/products/collateral/switches/nexus-5000-series-switches/data_sheet_c78-618603.html":"https://www.cisco.com/c/en/us/products/collateral/switches/nexus-3000-series-switches/data_sheet_c78-651097.html"},
    legacyLayouts:[{inventoryRevision:0,portIndexMap,portLabels:{55:"MGMT",56:"CONSOLE"}}],
    catalogDiscrepancies:[large?"Old1–32 map to fixed SFP+; MGMT55 maps33 and console56 maps34. Old33–54 remain unmapped with the GEM bay covered."
      :"Old1–52 retain socket identities; MGMT55 maps53 and console56 maps55. OldQSFP53/54 remain unmapped. Second management54 exists only in new inventory."],
    limitations:[configuration,"Saved IDs, types, speeds, labels, settings, cables and rack allocations remain unchanged; sparse/reordered and unknown revisions acquire no endpoints.",
      large?"L1/L2 jacks are disabled and decorative. The guide also mentions disabledMgmt1, but its pictured four-jack I/O module has only one management connector and a console. Alternate Fibre Channel mode and GEM modules need separate configurations."
        :"The overview misprints3064-X asN3K-C3064TQ; the datasheet identifies the selected optical SKU. QSFP breakouts and optical transceivers are not synthesized.",
      "Fine printing, tiny latch details and perforation density are simplified. Fan rotors hidden behind grilles are not presented as additional external modules."],
    chassis:{x:(1-width)/2,y:.055,width,height:(body+16)/100},faces:large?panels5548(device):panels3064(device)};
}

/** Bind an immutable canonical socket with explicitly bounded captions and historical optical type compatibility. */
function socket(device,index,x,y,width,height,physicalLabel,captionX=x,captionY=.91,captionWidth=.031){
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel,x,y,width,height,
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth},
    ...(port.type==="SFP_PLUS_10G"?{compatibleTypes:["SFP28_25G"]}:{}),...(port.type==="QSFP_PLUS_40G"?{compatibleTypes:["QSFP28_100G"]}:{})};
}

/** Describe visible source hardware without adding any topology endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the3064 four twelve-port optical banks, paired QSFP columns and split rear power/fan/service assembly. */
function panels3064(device){
  const ports=[];
  for(let index=0;index<48;index++){const col=Math.floor(index/2),row=index%2,x=.044+col*.0318+Math.floor(col/6)*.019;
    ports.push(socket(device,index+1,x,row?.67:.31,.028,.245,String(index+1),x,row?.91:.095,.030));}
  for(let index=0;index<4;index++){const x=.902+Math.floor(index/2)*.049,row=index%2;
    ports.push(socket(device,index+49,x,row?.67:.31,.042,.255,String(index+49),x,row?.91:.095,.045));}
  return {front:{ports,components:[part("led",.014,.36,.006,.055),part("led",.014,.63,.006,.055)]},
    rear:{ports:[{...socket(device,53,.887,.31,.031,.27,"MGMT0",.887,.095,.056),connectorKind:"rj45-inverted"},socket(device,54,.887,.66,.031,.27,"MGMT1",.887,.91,.056),
      socket(device,55,.954,.43,.031,.27,"CONSOLE",.954,.095,.063)],components:[part("module-bay",.009,.08,.245,.84,"nexus-3064-psu","PSU 1"),
      part("module-bay",.260,.08,.359,.84,"nexus-3064-fan","N3K-C3064-FAN"),part("module-bay",.625,.08,.226,.84,"nexus-3064-psu","PSU 2"),
      part("usb",.940,.715,.03,.105),part("led",.933,.91,.006,.04),part("led",.980,.91,.006,.04)]}};
}

/** Trace the5548 service quad, two fan grilles and twoAC modules opposite32fixed ports and one covered GEM bay. */
function panels5548(device){
  const ports=[];
  for(let index=0;index<32;index++){const col=Math.floor(index/2),row=index%2,x=.045+col*.036+Math.floor(col/8)*.024;
    ports.push(socket(device,index+1,x,row?.67:.31,.030,.245,String(index+1),x,row?.91:.095,.034));}
  return {front:{ports:[{...socket(device,33,.128,.31,.032,.27,"MGMT0",.128,.095,.052),connectorKind:"rj45-inverted"},socket(device,34,.128,.66,.032,.27,"CONSOLE",.128,.91,.052)],
    components:[part("module-bay",.065,.175,.032,.27,"nexus-disabled-link","L1"),part("module-bay",.065,.525,.032,.27,"nexus-disabled-link","L2"),
      part("usb",.170,.36,.015,.31),part("led",.026,.31,.006,.05),part("led",.026,.64,.006,.05),
      part("module-bay",.203,.08,.234,.84,"nexus-5548-fan","FAN 1"),part("module-bay",.443,.08,.234,.84,"nexus-5548-fan","FAN 2"),
      part("module-bay",.683,.08,.149,.84,"nexus-5548-psu","PSU 1"),part("module-bay",.839,.08,.149,.84,"nexus-5548-psu","PSU 2")]},
    rear:{ports,components:[part("led",.014,.36,.006,.055),part("led",.014,.63,.006,.055),part("module-bay",.645,.16,.338,.68,"nexus-gem-cover","GEM EMPTY")]}};
}
