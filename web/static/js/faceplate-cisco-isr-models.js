import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const models=["ISR 4300 family","ISR 4400 family"],cache=new Map();
const source="https://www.cisco.com/c/en/us/td/docs/routers/access/4400/hardware/installation/guide4400-4300/C4400_isr/Overview.pdf";

/** Fit the selected native1U router inside the actual saved allocation without changing any saved data. */
export function resolveCiscoISRFaceplate(device){
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

/** Disclose exact chassis populations and explicit historical mappings independently of mutable saved settings. */
function buildProfile(device){
  const large=device.model===models[1],sku=large?"ISR4431/K9":"ISR4331/K9",width=17.25/17.5,body=width*690*(large?1.73:1.75)/17.25;
  const configuration=large?"ISR4431/K9 with two PWR-4430-AC supplies, three NIM covers and no optional PoE, voice or storage modules."
    :"ISR4331/K9 with one PWR-4330-AC supply, two NIM covers and one SM-X cover; no optional PoE, voice or storage modules.";
  return {id:`cisco-isr-${large?4431:4331}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryComplete:true,inventoryRevision:1,rearHardwareVerified:true,defaultFace:"rear",source,
    sourcePage:large?"Figures1-13/1-14 pages15/16; Figure1-41 corroborates matching I/O block labels":"Figures1-22/1-23 page21",
    evidence:{scope:"model",models:[sku],catalogAlias:device.model,selectedModel:sku,configuration,
      front:`${source}#page=${large?15:21}`,rear:`${source}#page=${large?16:21}`,
      supplemental:"https://www.cisco.com/c/en/us/products/collateral/routers/4000-series-integrated-services-routers-isr/data_sheet-c78-732542.html"},
    legacyLayouts:[{inventoryRevision:0,portIndexMap:large?{1:1,2:2,3:3,4:4,9:5,10:6,11:7,12:8,13:9,14:12}:{1:1,2:2,9:3,10:4,13:5,14:8},portLabels:{13:"MGMT",14:"CONSOLE"}}],
    catalogDiscrepancies:[large?"Historical copper1–4, optics9–12, management13 and USB-C14 map to the selected sockets. Copper5–8 remain unmapped."
      :"Historical copper1/2, optics9/10, management13 and USB-C14 map to selected sockets. Copper3–8 and optics11/12 remain unmapped."],
    limitations:[configuration,"Saved IDs, types, labels, speeds, settings, cables and rack allocations remain unchanged. New RJ45 console and AUX endpoints exist only on new instances.",
      large?"Four copper/SFP pairs share four WAN interfaces; simultaneous activation is not enforced. Figure1-41 supplies labels for the matching I/O block visible in the exact4431 Figure1-14; this label correspondence is an inference."
        :"GE0/0/0 copper/SFP share one WAN interface. GE0/0/1 is copper only; GE0/0/2 is optical only. Simultaneous combo activation is not enforced.",
      "Mini-B and RJ45 consoles are alternatives. Covered expansion bays create no endpoints. Fine safety printing and perforation density are simplified."],
    chassis:{x:(1-width)/2,y:.055,width,height:(body+16)/100},faces:large?panels4431(device):panels4331(device)};
}

/** Bind canonical socket geometry with a local caption cap and explicit historical connector compatibility. */
function socket(device,index,x,y,width,height,physicalLabel,captionX=x,captionY=.91,captionWidth=.042){
  const port=device.ports.find(port=>port.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,physicalLabel,x,y,width,height,
    descriptionAnchor:{x:captionX,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth},
    ...(port.type==="SFP_1G"?{compatibleTypes:["SFP_PLUS_10G"]}:{}),
    ...(port.type==="USB_MINI_CONSOLE"?{connectorKind:"usb-mini",compatibleTypes:["USB_C_CONSOLE"]}:{})};
}

/** Define a bounded physical part that does not create a topology endpoint. */
function part(kind,x,y,width,height,variant,label){return {kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the4331 bezel service stacks and rear WAN block, with both expansion types covered. */
function panels4331(device){
  const front=[socket(device,5,.141,.35,.032,.265,"MGMT",.141,.095,.044),socket(device,6,.093,.625,.032,.26,"CON",.093,.91,.043),
    socket(device,7,.093,.285,.032,.26,"AUX",.093,.095,.043),socket(device,8,.040,.69,.016,.09,"USB",.040,.91,.043)];
  const rear=[];
  for(let row=0;row<2;row++)rear.push(socket(device,row+1,.043,row?.66:.30,.035,.27,`GE0/0/${row}`,.043,row?.91:.095,.05),
    socket(device,row+3,.094,row?.66:.30,.041,.26,`GE0/0/${row?2:0}`,.094,row?.91:.095,.047));
  return {front:{ports:front,components:[part("usb",.125,.632,.032,.10),part("vent",.191,.15,.313,.75,"isr-hex-vent"),
    part("module-bay",.522,.12,.091,.40,"isr-status-4331"),part("vent",.663,.15,.180,.75,"isr-hex-vent"),
    part("power",.867,.17,.077,.69,"ac-c14"),part("module-bay",.966,.27,.019,.47,"isr-switch"),part("text",.526,.78,.095,.10,undefined,"CISCO")]},
    rear:{ports:rear,components:[part("module-bay",.142,.13,.215,.73,"isr-nim-cover","NIM 1"),part("module-bay",.364,.13,.215,.73,"isr-nim-cover","NIM 2"),
      part("module-bay",.591,.13,.387,.73,"isr-sm-cover","SM-X 1"),part("module-bay",.982,.51,.014,.24,"isr-ground")]}};
}

/** Trace the4431 split copper banks around the optical block, plus its two installed front AC supplies. */
function panels4431(device){
  const ports=[socket(device,9,.033,.29,.032,.26,"MGMT",.033,.095,.043),socket(device,10,.109,.66,.033,.26,"CON",.109,.91,.042),
    socket(device,11,.109,.30,.033,.26,"AUX",.109,.095,.042),socket(device,12,.068,.75,.016,.09,"USB",.068,.91,.028)];
  for(let index=0;index<4;index++){
    const row=index%2,copper=index<2?.158:.335,fiber=index<2?.218:.271,y=row?.66:.30;
    ports.push(socket(device,index+1,copper,y,.034,.27,`GE0/0/${index}`,copper,row?.91:.095,.046),
      socket(device,index+5,fiber,y,.040,.26,`GE0/0/${index}`,fiber,row?.91:.095,.046));
  }
  return {front:{ports:[],components:[part("module-bay",.008,.08,.213,.84,"isr-4431-psu","PSU 1"),part("module-bay",.784,.08,.207,.84,"isr-4431-psu","PSU 0"),
    part("module-bay",.245,.12,.142,.42,"isr-status-4431"),part("text",.247,.73,.14,.12,undefined,"CISCO ISR4431"),
    part("vent",.403,.10,.330,.79,"isr-4431-vent"),part("module-bay",.749,.27,.019,.47,"isr-switch")]},
    rear:{ports,components:[part("usb",.017,.51,.032,.09),part("usb",.017,.69,.032,.09),
      ...Array.from({length:3},(_,i)=>part("module-bay",.383+i*.200,.13,.191,.73,"isr-nim-cover",`NIM ${i+1}`)),
      part("module-bay",.983,.51,.014,.24,"isr-ground")]}};
}
