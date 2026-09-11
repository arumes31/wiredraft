import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile} from "./static/js/catalog.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";

/** Construct an exact previously supported SKU with deterministic saved identities. */
function exact(model){const device=instantiateProfile(hardwareCatalog.find(row=>row.model===model),model,{x:0,y:0});device.ports.forEach(port=>{port.id=`exact-${port.portIndex}`;port.deviceId=device.id;});return device;}

test("inspected exact Meraki upper RJ45 rows and rear management retain source bottom contact orientation",()=>{
  for(const model of ["Meraki MS120-24P","Meraki MS225-48FP"]){const device=exact(model),before=structuredClone(device);
    for(const width of [460,690])for(const face of ["front","rear"]){const scene=buildFaceplateScene(device,{x:0,y:0,width,height:100},{face});
      for(const slot of scene.ports.filter(slot=>slot.port.type==="RJ45_1G")){
        const inverted=face==="rear"||slot.port.portIndex%2===1;
        assert.equal(slot.connectorKind,inverted?"rj45-inverted":"rj45",`${model} ${face} port${slot.port.portIndex}`);
        const parts=hardwarePrimitives({kind:slot.connectorKind,x:0,y:0,width:30,height:20}),contacts=parts.filter(part=>part.fill==="#d7b76c");assert.equal(contacts.length,8);
        assert.ok(contacts.every(contact=>inverted?contact.y>10:contact.y+contact.height<10),`${model} contact bank must be ${inverted?"below":"above"} socket center`);
      }
    }assert.deepEqual(device,before);
  }
});

test("official silver Meraki palette applies only to the source-verified access, advanced and aggregation models",()=>{
  for(const model of ["Meraki MS120","Meraki MS210","Meraki MS225","Meraki MS120-24P","Meraki MS225-48FP","Meraki MS250","Meraki MS350","Meraki MS390","Meraki MS410","Meraki MS425","Meraki MS450"]){
    const palette=resolveFaceplateTemplate(exact(model));assert.equal(palette.id,"meraki-access-silver");assert.equal(palette.surface,"#d5d7d8");assert.equal(palette.ink,"#252b2d");assert.match(palette.source,/documentation\.meraki\.com/);
  }
  for(const model of ["Catalyst 9200 family","Nexus 9000 family"]){const palette=resolveFaceplateTemplate(exact(model));assert.notEqual(palette.id,"meraki-access-silver");}
  assert.notEqual(resolveFaceplateTemplate({model:"Meraki MS120",faceplate:{vendor:"Other"},category:"Switch"}).id,"meraki-access-silver");
});
