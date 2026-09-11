import {canonicalFaceplateDevice} from "./faceplate-profile.js";
const models=new Map([["FortiSwitch Rugged 112F-POE",112],["FortiSwitch Rugged 216F-POE",216],["FortiWLC family",500]]),cache=new Map();
const sources={112:"https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ee25faa8-375c-11f0-a9d0-d2b0d2e22f7d/FSR-112F-POE-QSG.pdf",216:"https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/0b499254-cf8a-11ef-8766-ca4255feedd9/FSR-216F-POE-QSG.pdf",500:"https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b89c6150-243a-11e9-b20a-f8bc1258b856/fortiwlc-500d-qsg.pdf"};

/** Fit the selected physical projection and readable caption gutters inside the actual stored allocation. */
export function resolveFortinetFinalFaceplate(device){
 const series=models.get(device?.model);if(!series||device.faceplate?.vendor!=="Fortinet")return null;
 if(!cache.has(series)){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;cache.set(series,{base:buildProfile(canonical.device,series),allocations:new Map()});}
 const entry=cache.get(series),units=Math.max(1,Number(device.faceplate.unitsU)||1);
 if(!entry.allocations.has(units)){const ratio=series===112?66.5/174.4:series===216?(242.5/116.4)*(84/260):44/438,nativeWidth=series===112?300:series===216?260:690,bodyWidth=Math.min(nativeWidth,(units*100-24)/ratio),bodyHeight=bodyWidth*ratio;
 entry.allocations.set(units,{...entry.base,chassis:{x:(1-bodyWidth/690)/2,y:.04/units,width:bodyWidth/690,height:(bodyHeight>=64?bodyHeight+16:bodyHeight/.8)/(units*100),...(series!==500?{componentDrawn:true}:{})}});}
 return entry.allocations.get(units);
}

/** Publish exact appliance, mounting and interface evidence with explicit supported historical index maps. */
function buildProfile(device,series){
 const sku=series===500?"FortiWLC-500D":`FSR-${series}F-POE`,configuration=series===500?"FortiWLC-500D, four dual-media1G pairs (copper1–4/SFP5–8), two10G SFP+9–10, RJ45 console, two removable300W AC PSUs, two internal240GB SSDs, front four-post rack ears. No transceivers installed.":`${sku}, supplied wall-mount brackets installed instead of the factory DIN bracket, dual DC input terminal with no external supply depicted, digital I/O terminal, disabled BLE antenna, ${series===112?"eight1G PoE copper and four1G SFP":"sixteen1G PoE copper and four1/10G SFP+"}, console and management. No transceivers installed.`;
 const count=series===112?14:22,map=series===500?{1:1,2:2,3:3,4:4,9:9,10:10,14:11}:Object.fromEntries(Array.from({length:count},(_,i)=>[i+1,i+1]));
 return{id:`fortinet-final-${sku.toLowerCase()}`,sku,family:sku,fidelity:"model",panelFidelity:{front:"model",rear:"model"},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source:sources[series],sourcePage:series===500?"QuickStart printed10/11 front/rear photographs, printed2 rack installation and12 PSU replacement":"QuickStart printed8 dimensions,10 rear wall-mount projection and12 front photograph",
 evidence:{scope:"model",models:[sku],selectedModel:sku,catalogAlias:device.model,configuration,front:sources[series],rear:sources[series],...(series===500?{datasheet:"https://cdn.ai.cc/product_pdf/fortiwlc.pdf",bodyDimensions:"44mm high by438mm wide; manufacturer datasheet page2 retrieved from public mirror.",dualMedia:"Four copper/SFP pairs share media selection; both physical socket sets are shown, not ten independent simultaneous data interfaces."}:{mounting:"The supplied wall-mount configuration is selected explicitly. Rear geometry includes projecting brackets; mounted envelope is approximate from the orthographic image, body dimensions are127×66.5mm (112F) and116.4×180mm (216F)."})},
 legacyLayouts:[{inventoryRevision:0,portIndexMap:map}],catalogDiscrepancies:[series===500?"Frozen438 has8RJ45,4SFP+ and MGMT13/Console14. Only copper1–4,10G9/10 and Console14 map to physical1–4,9/10,11. Seven unsupported endpoints stay unmapped; no1G/10G optical equivalence is asserted.":"Frozen438 already has the correct14/22 physical socket identities. Revision0 maps each index explicitly, with type guards. New216F management speed is100Mbps as printed in the guide; historical settings are preserved.","New physical inventory applies only to new instances. Saved IDs, labels, types, speeds, VLANs, links and rack allocations are never rewritten."],
    limitations:[configuration,"Unknown revisions and incompatible endpoint types remain unmapped. Small printing, LED and grille density are simplified.",...(series===500?["The USB table saysUSB-B but its actual front photo shows two rectangular TypeA sockets; photo geometry controls their decorative artwork. Four dual-media copper/SFP pairs are not independently simultaneous links."]:["The previous partial layout verified only the front. The complete view selects supplied wall brackets so the rear is supported by the manufacturer's wall-mount drawing; factory DIN rear is not claimed.","112F follows the guide's horizontal front-photo orientation, rotating its mounted rear correspondingly.216F stays upright. Bracket envelopes are estimated from orthographic figures; device body proportions follow the printed dimensions. Neither appliance is represented as a rack-native2U chassis.","216F uses application-caption gutters outside its narrow physical body. The source body and mounting brackets draw their own silhouette; these gutters are not physical hardware. Captions keep the existing minimum font size and do not move physical sockets."])],faces:series===500?wlcPanels(device):ruggedPanels(device,series)};
}

/** Bind an immutable physical socket to its canonical endpoint and a bounded application caption. */
function socket(device,index,x,y,width,height,label,cx=x,cy=y+.1,cw=.06,kind){
 const p=device.ports.find(p=>p.portIndex===index);if(!p)throw new Error(`${device.model}: canonical port${index} missing`);
 return{portIndex:index,type:p.type,label:p.label,physicalLabel:label,x,y,width,height,...(kind?{connectorKind:kind}:{}),descriptionAnchor:{x:cx,y:cy,fontSize:5.5,boxHeight:7,boxWidth:cw}};
}
/** Describe visible non-network hardware without adding an endpoint. */
function part(kind,x,y,width,height,variant,label){return{kind,x,y,width,height,...(variant?{variant}:{}),...(label?{label}:{})};}

/** Trace the500D's single-row copper/optical frontage and two left rear AC supplies. */
function wlcPanels(device){
 const ports=[];for(let i=0;i<4;i++)ports.push(socket(device,i+1,.178+i*.037,.72,.032,.28,String(i+1),undefined,.94,.036));
 for(let i=0;i<6;i++)ports.push(socket(device,i+5,.334+i*.036+Math.floor(i/2)*.014,.74,.034,.24,String(i+5),undefined,.94,.037));
 ports.push(socket(device,11,.065,.71,.038,.30,"CONSOLE",undefined,.94,.077));
 const front=[part("usb",.097,.49,.029,.12),part("usb",.097,.68,.029,.12),part("vent",.714,.08,.274,.82,"fortinet-final-round-grille"),...[.52,.64,.76].map(y=>part("led",.141,y,.006,.05))];
 const rear=[part("psu",.008,.04,.120,.92,"fortinet-final-wlc-psu"),part("psu",.130,.04,.120,.92,"fortinet-final-wlc-psu"),part("vent",.655,.16,.322,.78,"fortinet-final-round-grille"),part("vent",.320,.17,.270,.16,"fortinet-final-slot-grille"),...[.261,.280,.987].map(x=>part("screw",x,.18,.012,.13)),part("screw",.256,.75,.012,.13)];
 return{front:{ports,components:front},rear:{ports:[],components:rear}};
}

/** Transform a front photograph into the full mounted envelope while retaining its body proportions. */
function ruggedPanels(device,series){
 const ports=[],components=[];if(series===112){
  for(let i=0;i<8;i++)ports.push(socket(device,i+1,.350+Math.floor(i/2)*.111,i%2?.403:.195,.095,.12,String(i+1),undefined,i%2?.665:.09,.1,i%2?"rj45":"rj45-inverted"));
  for(let i=0;i<4;i++)ports.push(socket(device,i+9,.475+i*.142,.828,.108,.12,String(i+9),undefined,.945,.12));
  ports.push(socket(device,13,.840,.258,.105,.12,"CONSOLE",undefined,.11,.16),socket(device,14,.322,.828,.115,.12,"MGMT",undefined,.945,.16));
  components.push(part("power",.041,.775,.201,.111,"fortinet-final-terminal4"),part("terminal",.041,.387,.224,.107,"fortinet-final-terminal5"),part("antenna",.183,.17,.071,.15,"fortinet-final-ble"),part("module-bay",.77,.36,.127,.23,"fortinet-final-usb-cover"),part("module-bay",.606,.510,.155,.095,"fortinet-final-usb-cover"),part("button",.933,.407,.03,.05),part("screw",.056,.225,.050,.09),...[.36,.42,.47,.55].map(x=>part("led",x,.515,.010,.025)));
 }else{
  for(let i=0;i<16;i++){const odd=i%2===0,y=.837-Math.floor(i/2)*.082-(i>=8?.102:0);ports.push(socket(device,i+1,odd?.565:.425,y,.105,.072,String(i+1),odd?.685:.280,y,.12,odd?"fortinet-final-rj45-left":"fortinet-final-rj45-right"));}
  for(let i=0;i<4;i++)ports.push(socket(device,i+17,.143,.765-i*.18,.12,.080,String(i+17),.143,.699-i*.18,.20,"fortinet-final-sfp-vertical"));
  ports.push(socket(device,21,.817,.19,.135,.078,"CONSOLE",.82,.25,.23,"fortinet-final-rj45-right"),socket(device,22,.817,.302,.135,.078,"MGMT",.82,.365,.20,"fortinet-final-rj45-right"));
  components.push(part("usb",.76,.047,.065,.080),part("antenna",.105,.070,.09,.05,"fortinet-final-ble"),part("button",.77,.397,.04,.027),part("terminal",.745,.66,.075,.15,"fortinet-final-terminal5"),part("power",.745,.817,.075,.12,"fortinet-final-terminal4"),part("screw",.890,.93,.065,.04));
  for(let row=0;row<8;row++)for(let col=0;col<(row===1||row===7?2:3);col++)components.push(part("led",.77+col*.052,.432+row*.027,.022,.012));
 }
 const mountedWidth=84/260,mountedX=(1-mountedWidth)/2;
 const shell=series===112?{x:(1-127/174.4)/2,y:0,width:127/174.4,height:1}:{x:mountedX,y:.129,width:mountedWidth,height:180/242.5};
 const body=series===112?shell:{...shell,x:shell.x+.083*shell.width,width:.834*shell.width};
 /** Preserve normalized centers and caption locations when embedding the source face inside its mounting projection. */
 const transformSocket=p=>{const result={...p,x:body.x+p.x*body.width,y:body.y+p.y*body.height,width:p.width*body.width,height:p.height*body.height,descriptionAnchor:{...p.descriptionAnchor,x:body.x+p.descriptionAnchor.x*body.width,y:body.y+p.descriptionAnchor.y*body.height,boxWidth:p.descriptionAnchor.boxWidth*body.width}};
  if(series===216){const index=p.portIndex;result.descriptionAnchor={fontSize:5.5,boxHeight:7,boxWidth:index>16&&index<=20?.18:.14,x:index>20?.91:index>16?.13:index%2?.76:.27,y:result.y};}return result;};
 /** Apply the same source-body transformation to non-network artwork. */
 const transformPart=p=>({...p,x:body.x+p.x*body.width,y:body.y+p.y*body.height,width:p.width*body.width,height:p.height*body.height});
 const bracket={...part("mounting-bracket",series===216?mountedX:.01,.01,series===216?mountedWidth:.98,.98,`fortinet-final-wall-${series}`),hardwareLayer:"chassis-container"};
 return{front:{ports:ports.map(transformSocket),components:[{...bracket,captionBackground:true},{...part("panel",shell.x,shell.y,shell.width,shell.height,`fortinet-final-body-${series}`),captionBackground:true,hardwareLayer:"chassis-container"},...components.map(transformPart)]},rear:{ports:[],components:[bracket]}};
}
