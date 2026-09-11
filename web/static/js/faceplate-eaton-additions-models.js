import {eatonAdditionConfigurations} from './catalog-eaton-additions.js';
const cache=new Map();
/** Resolve only the exact newly registered Eaton UPS names; prototype keys never enter this registry. */
export function resolveEatonAdditionFaceplate(device){
 if(device?.category!=='Server'||device.faceplate?.vendor!=='Eaton')return null;
 const d=eatonAdditionConfigurations.get(device.model);if(!d)return null;
 const units=Math.max(1,Number(device.faceplate.unitsU)||d.units),key=`${d.key}:${units}`;
 if(!cache.has(key))cache.set(key,profile(d,units));return cache.get(key);
}
/** Fit the published chassis dimensions while preserving saved allocation and explicit inventory-revision semantics. */
function profile(d,units){
 const scale=Math.min(1,units/d.units),body=690*d.height/482.6*scale,width=d.width/482.6*scale,faces={front:front(d),rear:rear(d)};
 for(const f of Object.values(faces))for(const p of f.ports)p.descriptionAnchor.hidden ||= scale<.8;
 return {id:`eaton-addition-${d.key}`,family:d.model,sku:d.sku,defaultFace:'rear',fidelity:'model',panelFidelity:{front:'model',rear:'model'},inventoryRevision:1,inventoryComplete:true,rearHardwareVerified:true,source:d.source,sourcePage:d.pages,note:d.note,
 evidence:{scope:'model',models:[d.model],selectedModel:d.model,selectedSku:d.sku,front:d.source,rear:d.source,configuration:d.note,reviewed:'2026-09-11',physicalDimensions:{widthMm:d.width,heightMm:d.height,depthMm:d.depth},batteryDrawing:'https://www.eaton.com/content/dam/eaton/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/eaton-9px-ups/drawings/eaton-9px-ups-technical-drawing-9pxebm180rt.pdf'},
 legacyLayouts:[{inventoryRevision:0,portIndexMap:{}}],catalogDiscrepancies:['New exact catalog names have no historical namespace. Revision0 maps no guessed endpoints; unknown revisions and non-Power types remain unmapped.'],
 limitations:[d.note,'Power endpoints are generic cable anchors only. No AC/DC behavior, current or voltage compatibility, battery connector protocol, power propagation or runtime simulation is represented. Battery-detection modular sockets are not Ethernet. USB/RS232 monitoring, dry contacts and parallel-control connectors remain inactive ancillary hardware.','Unversioned, sparse, reordered and edited incoming records retain every ID, type, label, cable reference, setting and rack allocation. Unclaimed physical sockets remain visible without appending endpoints.','The 690-world rack convention follows manufacturer dimensions;460 retains the existing vertical rack grid. Dense output captions are omitted while full labels remain in endpoint metadata. AC-IN/AC-OUT identify the documented covered cable entrances; internal terminal screws are not drawn as exposed sockets.'],
 chassis:{x:(1-width)/2,y:.1/units,width,height:(body<64?body/.8:body+16)/(units*100),componentDrawn:true},faces};
}
/** Construct inactive source hardware with top-left normalized dimensions. */
function part(kind,role,x,y,width,height,variant,extra={}){return {kind,role,x,y,width,height,variant,active:false,...extra};}
/** Construct a strict Power anchor centered on its actual physical connector, with independently placed captions. */
function socket(d,index,x,y,width,height,variant,captionY,hidden=true){return {portIndex:index,label:d.labels[index-1],physicalLabel:d.labels[index-1],type:'Power',connectorKind:`eaton-addition-${variant}`,x,y,width,height,descriptionAnchor:{x,y:captionY,fontSize:5.5,boxHeight:7,boxWidth:Math.max(width,.1),hidden}};}
/** Draw the rectangular source body; only sockets wholly enclosed by it qualify as legitimate container overlaps. */
function body(front){return part('panel','body',0,0,1,1,front?'eaton-addition-front':'eaton-addition-rear',{hardwareLayer:'chassis-container'});}
/** Trace original5PX's right display or9PX's center display; the EBM center cover has no display. */
function front(d){
 const p=[body(true),part('panel','mount-left',.002,.05,.026,.90,'eaton-addition-ear'),part('panel','mount-right',.972,.05,.026,.90,'eaton-addition-ear')];
 if(d.key==='5px')p.push(part('panel','battery-front-cover',.035,.045,.245,.91,'eaton-addition-blank'),part('vent','front-grille',.285,.045,.475,.91,'eaton-addition-grille'),part('panel','front-control',.774,.12,.184,.76,'eaton-addition-display'),part('panel','brand',.475,.46,.096,.14,'eaton-addition-logo'));
 else {p.push(part('vent','front-left-grille',.03,.045,.31,.91,'eaton-addition-grille'),part('vent','front-right-grille',.66,.045,.31,.91,'eaton-addition-grille'),part('panel','center-cover',.345,.02,.31,.96,'eaton-addition-blank'),part('panel','brand',.759,.45,.115,.12,'eaton-addition-logo'));if(d.key==='9px')p.push(part('panel','front-control',.383,.15,.233,.70,'eaton-addition-display'));}
 return {components:p,ports:[]};
}
/** Trace original rear hardware directly from the selected figure, without importing a different regional outlet population. */
function rear(d){
 const p=[body(false)],ports=[];
 if(d.key==='ebm'){
  ports.push(socket(d,1,.14,.18,.135,.19,'battery180',.305,false),socket(d,2,.14,.43,.135,.19,'battery180',.67,false));
  p.push(part('panel','battery-detection-a',.245,.075,.033,.085,'eaton-addition-detect'),part('panel','battery-detection-b',.291,.075,.033,.085,'eaton-addition-detect'));
 }else if(d.key==='5px'){
  p.push(part('panel','communication-slot-cover',.026,.13,.067,.76,'eaton-addition-slot'),part('panel','usb-monitor',.102,.065,.033,.12,'eaton-addition-usbb'),part('panel','serial-monitor',.104,.25,.027,.13,'eaton-addition-db9'),part('panel','battery-detection',.101,.835,.027,.085,'eaton-addition-detect'),part('panel','roo-rpo',.104,.45,.027,.19,'eaton-addition-terminal'),part('fan','rear-fan-left',.143,.08,.168,.84,'eaton-addition-fan'),part('fan','rear-fan-right',.326,.08,.168,.84,'eaton-addition-fan'));
  for(let i=0;i<4;i++){ports.push(socket(d,i+1,.724+i*.055,.292,.051,.31,'c13-portrait',.07),socket(d,i+5,.701+i*.055,.728,.051,.31,'c13-portrait',.95));}
  ports.push(socket(d,9,.581,.735,.101,.32,'c19',.96),socket(d,10,.948,.625,.057,.40,'c20-portrait',.92),socket(d,11,.60,.28,.127,.38,'battery72',.05));
 }else{
  p.push(part('fan','rear-fan',.037,.045,.28,.91,'eaton-addition-fan'),part('panel','parallel-control',.286,.425,.033,.12,'eaton-addition-db15'),part('panel','battery-detection',.319,.61,.032,.075,'eaton-addition-detect'),part('panel','rpo',.323,.13,.024,.18,'eaton-addition-terminal'),part('panel','communication-slot-cover',.363,.20,.074,.54,'eaton-addition-slot'),part('panel','roo',.461,.075,.025,.15,'eaton-addition-terminal'),part('panel','dry-contacts',.464,.363,.026,.14,'eaton-addition-db9'),part('panel','usb-monitor',.465,.55,.029,.10,'eaton-addition-usbb'),part('panel','serial-monitor',.465,.705,.026,.13,'eaton-addition-db9'),part('panel','primary-breaker-a',.53,.047,.076,.15,'eaton-addition-breaker'),part('panel','primary-breaker-b',.53,.795,.076,.15,'eaton-addition-breaker'),part('panel','group-breaker-1',.637,.42,.04,.24,'eaton-addition-breaker'),part('panel','group-breaker-2',.859,.47,.036,.23,'eaton-addition-breaker'),part('panel','mbp-detection',.894,.485,.027,.065,'eaton-addition-detect'));
  for(let i=0;i<4;i++){ports.push(socket(d,i+1,.717,.232+i*.177,.077,.168,'c13',.06),socket(d,i+5,.805,.232+i*.177,.077,.168,'c13',.06));}
  ports.push(socket(d,9,.557,.344,.102,.248,'c19-inverted',.04),socket(d,10,.557,.624,.102,.248,'c19-inverted',.96),socket(d,11,.952,.295,.086,.36,'gland',.06),socket(d,12,.952,.813,.086,.34,'gland',.97),socket(d,13,.386,.858,.125,.17,'battery180',.065));
 }
 return {components:p,ports};
}
