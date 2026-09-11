import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile} from "./static/js/catalog.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

for(const [model,copperCount,upperService,lowerService] of [["PA-3400 family",12,[],[]],["PA-5200 family",4,[28,30,31],[29]]]) {
  test(`${model} copper contacts follow the inspected upper/lower socket openings`,()=>{
    const device=instantiateProfile(hardwareCatalog.find(row=>row.vendor==="Palo Alto"&&row.model===model),model,{x:0,y:0});
    const before=structuredClone(device);
    for(const width of [460,690]) {
      const scene=buildFaceplateScene(device,{x:0,y:0,width,height:device.faceplate.unitsU*100},{face:"front"});
      for(const box of scene.ports.filter(box=>box.port.portIndex<=copperCount||upperService.includes(box.port.portIndex)||lowerService.includes(box.port.portIndex))) {
        const index=box.port.portIndex,upper=upperService.includes(index)||(index<=copperCount&&index%2===1);
        assert.equal(box.connectorKind,upper?"rj45-inverted":"rj45");
        const contacts=hardwarePrimitives({...box,kind:box.connectorKind}).filter(part=>part.fill==="#d7b76c");
        assert.equal(contacts.length,8);
        const contactCenter=contacts.reduce((sum,part)=>sum+(part.y+part.height/2-box.y)/box.height,0)/8;
        assert.ok(upper?contactCenter>.5:contactCenter<.5,"upper source contacts lie below opening; lower source contacts lie above");
      }
    }
    assert.deepEqual(device,before);
  });
}
