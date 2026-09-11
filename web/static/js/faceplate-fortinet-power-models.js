const selections=new Map([
  ...["FortiGate 3000F-ACDC","FortiGate 3001F-ACDC"].map(model=>[model,{height:88.9,width:443,units:2,large:false}]),
  ...["FortiGate 3960E","FortiGate 3960E-ACDC","FortiGate 3960E-DC","FortiGate 3980E","FortiGate 3980E-DC"].map(model=>[model,{height:222,width:437,units:5,large:true}]),
]);
const allocations=new WeakMap();
const guide3000="https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/db9d59f7-e1f0-11ec-bb32-fa163e15d75b/FG-3000F-QSG.pdf";
const guide3960="https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7c49731-1a12-11e9-9685-f8bc1258b856/FortiGate-3960E-3980E-ACDC-QSG-Supplement.pdf";

/** Apply inspected AC/DC power populations only to the explicitly selected Fortinet models. */
export function applyFortinetPowerDetails(profile,device){
 const selected=selections.get(device.model);if(!selected)return;
 const dc=device.model.endsWith("-DC"),power=dc?"DC":"AC",base=device.model.replace(/-(?:ACDC|DC)$/,""),source=selected.large?guide3960:guide3000;
 profile.source=source;profile.sourcePage=selected.large?"PDF3 front and5 separate AC/DC rears":"PDF6 front and7 separate AC/DC rears";
 profile.evidence={scope:"model",models:[base],selectedModel:base,catalogAlias:device.model,selectedPower:power,front:source,rear:source,
  configuration:`${base}, ${selected.units}U, ${selected.large?"two dual-fan trays and three2+1":"three fixed rear fan grille openings and two1+1"} ${power} supplies. ${device.model.includes("3001")?"Two internal SSDs behind the service cover; current datasheet960GB each, earlier1TB.":"No extra storage or optics installed."}`};
 profile.fidelity="model";profile.rearHardwareVerified=true;profile.inventoryComplete=true;
 profile.limitations.push(`Selected ${power} population for ${device.model}; this drawing does not imply mixed AC/DC supplies. Power remains ancillary artwork and does not enlarge saved inventories.`,
  "Manufacturer dimensions determine native proportions at690 within the normalized-width rendering contract. Historical allocations are fitted as a whole; below65% native scale captions are hidden while metadata and endpoint interaction remain available.",
  "Power connector geometry follows the manufacturer diagrams. The3960E guide identifies C16 compatibility; tiny key/retention details and grille density are simplified. Saved incompatible media remain unmapped without changing their records.");
 for(const slot of profile.faces.front.ports){
  delete slot.compatibleTypes;
  const upper=slot.portIndex%2===1;
  slot.connectorKind=slot.type==="Console"?"console":slot.type.startsWith("RJ45")?(upper?"rj45-inverted":"rj45"):slot.type.startsWith("SFP")?(upper?"sfp":"sfp-inverted"):(selected.large||upper?"qsfp":"qsfp-inverted");
  slot.descriptionAnchor={x:slot.x,y:selected.large?(slot.type==="Console"||upper&&slot.portIndex<=18?.800:.976):(slot.type==="Console"?.958:upper?.555:.958),fontSize:5.5,boxHeight:7,boxWidth:slot.type==="Console"?.060:slot.portIndex<=2?.050:slot.width};
 }
 if(selected.large){
  for(const component of profile.faces.rear.components){
   if(component.kind==="psu"){component.role="power-supply";component.powerType=power;component.variant=dc?"fortinet-power-dc-portrait":"fortinet-power-ac-portrait";}
   if(component.kind==="fan"){component.role="fan-grille";component.variant="fortinet-power-square-fan";}
   if(component.kind==="module-bay"){component.variant="fortinet-power-cover";component.role="center-cover";component.screwRows=3;}
  }
  profile.faces.rear.components.unshift(...[.085,.53].map(x=>({kind:"panel-accent",variant:"fortinet-power-cover",role:"fan-tray",x,y:.035,width:.325,height:.915,screwRows:2})));
 }else{
  for(const component of profile.faces.rear.components){
   if(component.kind==="psu"){component.role="power-supply";component.powerType="AC";component.variant="fortinet-power-ac-horizontal";}
   if(component.kind==="fan"){component.role="fan-grille";component.variant="fortinet-power-square-grille";}
   if(component.kind==="module-bay"){component.variant="fortinet-power-cover";component.role="ssd-cover";component.screwRows=2;}
  }
  profile.faces.rear.components.push({kind:"ground",variant:"fortinet-power-ground",role:"ground-studs",x:.015,y:.59,width:.032,height:.31});
 }
 for(const component of profile.faces.front.components)if(component.kind==="text"&&component.label?.startsWith("3960"))component.label="3960E";
}

/** Preserve the original rack allocation while scaling the complete documented chassis uniformly. */
export function fitFortinetPowerAllocation(profile,device){
 const s=selections.get(device.model);if(!s)return profile;
 const units=Math.max(1,Number(device.faceplate.unitsU)||s.units);
 if(!allocations.has(profile))allocations.set(profile,new Map());
 const cache=allocations.get(profile);if(cache.has(units))return cache.get(units);
 const body=690*s.height/482.6,scale=Math.min(1,(units*100*.94-16)/body),width=s.width/482.6*scale;
 const faces=scale<.65?Object.fromEntries(Object.entries(profile.faces).map(([name,face])=>[name,{...face,ports:face.ports.map(p=>({...p,descriptionAnchor:{...p.descriptionAnchor,hidden:true}}))}])):profile.faces;
 const fitted={...profile,faces,chassis:{x:(1-width)/2,y:.055/units,width,height:(body*scale+16)/(units*100)}};
 cache.set(units,fitted);return fitted;
}
