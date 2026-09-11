import {canonicalFaceplateDevice} from "./faceplate-profile.js";

const root="https://docs.paloaltonetworks.com/hardware/pa-3400-hardware-reference/";
const frontSource=`${root}pa-3400-series-overview/front-panel-3400-series`;
const rearSource=`${root}pa-3400-series-overview/back-panel-3400-series`;
const allocations=new Map();
let profile;

/** Resolve the selected PA-3410 without rewriting any saved allocation or endpoint. */
export function resolvePA3410Faceplate(device) {
  if(device?.faceplate?.vendor!=="Palo Alto"||device.model!=="PA-3400 family")return null;
  if(!profile){const canonical=canonicalFaceplateDevice(device);if(!canonical)return null;profile=buildProfile(canonical.device);}
  const units=Math.max(1,Number(device.faceplate.unitsU)||1);
  if(!allocations.has(units))allocations.set(units,{...profile,chassis:{...profile.chassis,y:profile.chassis.y/units,height:profile.chassis.height/units}});
  return allocations.get(units);
}

/** Record exact front/rear sources, selected population and type-guarded historical identities. */
function buildProfile(device) {
  const width=434.9/482.6,body=690*width*43.2/434.9;
  const portIndexMap={...Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,i+1])),17:23,18:24,19:25,20:26,25:30,27:31};
  const configuration="PA-3410 with two load-sharing 450W AC supplies, covered system SSD and no inserted optical transceivers; standard 1U chassis.";
  return {id:"paloalto-pa3410",sku:"PA-3410",family:"PA-3410",fidelity:"model",panelFidelity:{front:"model",rear:"model"},
    inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,defaultFace:"front",source:frontSource,
    sourcePage:"PA-3410/3420 shared front diagram and component table; PA-3400 shared back diagram; physical and electrical specifications",
    evidence:{scope:"model",models:["PA-3410"],catalogAlias:device.model,selectedModel:"PA-3410",configuration,front:frontSource,rear:rearSource,
      supplemental:[`${root}pa-3400-series-specifications/physical-specs-pa-3400-series`,`${root}pa-3400-series-specifications/electrical-specs-pa-3400-series`]},
    limitations:[configuration,"The shared front illustration prints PA-3420; the manufacturer explicitly applies it to PA-3410 and PA-3420. PA-3430/3440 QSFP28 sockets are excluded.",
      "Small safety printing, LED symbols and mesh density are simplified. Fans remain behind the documented rear grille; hidden rotor counts are not inferred.",
      "Saved inventory, speeds, labels, settings, cables and rack allocation stay unchanged. Incompatible placeholder endpoints remain unmapped; physical sockets without saved endpoints are inactive artwork.",
      "The existing normalized-width display contract is retained; native mechanical height/width is matched at690 pixels and preserved within each saved allocation."],
    legacyLayouts:[{inventoryRevision:0,portIndexMap}],
    chassis:{x:(1-width)/2,y:.06,width,height:(body+Math.min(16,body/4))/100},
    faces:{front:frontPanel(device),rear:rearPanel()}};
}

/** Place a physical connector and reserve its own application-caption region. */
function socket(device,index,x,y,kind,width=.027,height=.235,captionY=y<.5?.16:.91,captionWidth=.032) {
  const port=device.ports.find(p=>p.portIndex===index);
  return {portIndex:index,type:port.type,label:port.label,x,y,width,height,connectorKind:kind,
    physicalLabel:index<=26?String(index):({27:"HSCI",28:"HA1-A",29:"HA1-B",30:"MGT",31:"CON",32:"USB"})[index],
    ...(index<=12?{compatibleTypes:["RJ45_1G","RJ45_10G"]}:{}),
    descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:captionWidth}};
}

/** Describe bounded hardware without adding a connection endpoint. */
function part(kind,x,y,width,height,role,label,variant) {return {kind,x,y,width,height,role,...(label?{label}:{}),...(variant?{variant}:{})};}

/** Trace the PA-3410's copper banks, optical banks and separate HA/service cluster. */
function frontPanel(device) {
  const ports=[],components=[part("text",.006,.015,.065,.15,"brand","PALO ALTO"),part("text",.007,.88,.067,.10,"model","PA-3410"),
    part("vent",.007,.245,.062,.56,"left-airflow",undefined,"pa3410-mesh"),
    part("vent",.080,.015,.486,.055,"upper-airflow",undefined,"pa3410-mesh"),
    part("vent",.575,.04,.068,.71,"service-airflow",undefined,"pa3410-mesh"),
    part("usb",.814,.45,.012,.30,"usb-storage"),
    part("module-bay",.923,.02,.072,.96,"system-drive-cover",undefined,"pa3410-drive-cover")];
  for(let i=0;i<12;i++) {
    const x=[.096,.129,.162,.195,.250,.283][Math.floor(i/2)];
    ports.push(socket(device,i+1,x,i%2?.665:.39,i%2?"rj45":"rj45-inverted"));
  }
  for(let i=0;i<10;i++)ports.push(socket(device,13+i,.334+Math.floor(i/2)*.033,i%2?.665:.39,"sfp",.029,.23));
  for(let i=0;i<4;i++)ports.push(socket(device,23+i,.515+Math.floor(i/2)*.034,i%2?.665:.39,"sfp",.030,.23));
  ports.push(socket(device,27,.668,.66,"sfp",.034,.23,.91,.046),
    socket(device,28,.721,.38,"rj45",.030,.24,.14,.046),socket(device,29,.721,.67,"rj45-inverted",.030,.24,.93,.046),
    socket(device,30,.775,.38,"rj45",.030,.24,.14,.046),socket(device,31,.775,.67,"rj45-inverted",.030,.24,.93,.046),
    socket(device,32,.850,.76,"usb-micro",.018,.055,.93,.035));
  for(let i=0;i<8;i++)components.push(part("led",.872+(i%2)*.012,.28+Math.floor(i/2)*.118,.007,.040,"status-indicator"));
  components.push(part("led",.658,.445,.005,.029,"hsci-led"),part("led",.678,.445,.005,.029,"hsci-led"));
  return {ports,components};
}

/** Keep the exhaust grille, ground post and two AC inputs in their documented rear positions. */
function rearPanel() {
  return {ports:[],components:[part("vent",.012,.055,.615,.88,"rear-exhaust",undefined,"pa3410-mesh"),
    part("button",.634,.35,.015,.15,"ground-post"),
    part("psu",.690,.035,.124,.93,"ac-supply",undefined,"pa3410-ac"),
    part("psu",.843,.035,.124,.93,"ac-supply",undefined,"pa3410-ac"),
    part("text",.689,.012,.124,.075,"psu-name","PS2"),part("text",.842,.012,.124,.075,"psu-name","PS1")]};
}
