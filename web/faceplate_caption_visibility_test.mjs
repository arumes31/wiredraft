import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile} from "./static/js/catalog.js";
import {resolveCiscoNexusFinalFaceplate} from "./static/js/faceplate-cisco-nexus-final-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {buildSVGDocument} from "./static/js/export.js";

/** Build the selected population with an independently saved allocation and edited endpoint name. */
function fixture(units=2,model="Nexus 7000 family",legacy=false){
  let row=hardwareCatalog.find(row=>row.vendor==="Cisco"&&row.model===model);
  if(legacy)row={...row,units:2,inventoryRevision:0,groups:[{zone:"uplink",count:48,type:"SFP28_25G",speed:25000,prefix:"SFP28"},{zone:"uplink",count:6,type:"QSFP28_100G",speed:100000,prefix:"QSFP28"},{zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},{zone:"management",count:1,type:"Console",speed:0,prefix:"CONSOLE"}]};
  const device=instantiateProfile(row,"Saved chassis",{x:0,y:0});
  device.ports.forEach(port=>{port.id=`caption-${port.portIndex}`;port.deviceId=device.id;});
  device.faceplate.unitsU=units;device.ports[0].label="Customer <uplink> & carrier";
  const bounds={x:0,y:0,width:690,height:units*100,device},scene=buildFaceplateScene(device,bounds,{face:"front"});
  const topology={devices:[device],racks:[],links:[],photos:[],annotations:[],switchSystems:[],firewallClusters:[]};
  const engine={worldBounds:()=>bounds,portCenters:()=>new Map(scene.ports.map(box=>[box.port.id,{x:box.centerX,y:box.centerY}])),rackRectangles:()=>[],deviceRectangles:()=>[bounds],faceplateScenes:()=>new Map([[device.id,scene]]),portGeometry:()=>scene.ports,routingPortGeometry:()=>scene.ports};
  return {device,bounds,scene,topology,engine};
}

test("compact7009 omits only physical captions and keeps all visible/routing/SVG endpoint identities",()=>{
  const {device,scene,topology,engine}=fixture(2,"Nexus 7000 family",true),before=structuredClone(topology),svg=buildSVGDocument(topology,engine);
  assert.equal(device.ports.length,56);assert.equal(scene.ports.length,50);assert.ok(scene.ports.every(slot=>slot.labelPlacement.hidden===true));assert.equal(scene.unmappedPorts.length,6);
  assert.equal((svg.match(/data-entity="port"/g)||[]).length,50);assert.equal((svg.match(/class="port-label"/g)||[]).length,0);
  for(const slot of scene.ports){assert.ok(svg.includes(`data-port-id="${slot.port.id}"`));assert.equal(engine.portCenters().get(slot.port.id).x,slot.centerX);assert.equal(engine.routingPortGeometry().find(box=>box.port.id===slot.port.id).centerY,slot.centerY);}
  assert.ok(svg.includes('data-name="Customer &lt;uplink&gt; &amp; carrier"'));assert.ok(svg.includes('<title>Saved chassis:Customer &lt;uplink&gt; &amp; carrier'));
  assert.deepEqual(topology,before);assert.equal(device.faceplate.unitsU,2);
});

test("caption visibility defaults visible unless the model explicitly supplies boolean true",()=>{
  const base=fixture(14),profile=resolveCiscoNexusFinalFaceplate(base.device),anchor=profile.faces.front.ports.find(slot=>slot.portIndex===1).descriptionAnchor;
  try{for(const value of [undefined,false,0,1,"true","false",{},null]){anchor.hidden=value;const scene=buildFaceplateScene(base.device,base.bounds,{face:"front"});assert.notEqual(scene.ports[0].labelPlacement.hidden,true);}
    anchor.hidden=true;assert.equal(buildFaceplateScene(base.device,base.bounds,{face:"front"}).ports[0].labelPlacement.hidden,true);
  }finally{delete anchor.hidden;}
  for(const units of [6,14])assert.ok(fixture(units).scene.ports.every(slot=>slot.labelPlacement.hidden!==true));
  assert.ok(fixture(1,"Nexus 9000 family").scene.ports.every(slot=>slot.labelPlacement.hidden!==true));
  const native=fixture(14);assert.equal((buildSVGDocument(native.topology,native.engine).match(/class="port-label"/g)||[]).length,50);
});
