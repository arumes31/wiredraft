import assert from "node:assert/strict";
import {test} from "node:test";
import {hardwareCatalog,instantiateProfile} from "./static/js/catalog.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {buildSVGDocument} from "./static/js/export.js";
import {CanvasEngine} from "./static/js/canvas.js";

/** Exercise production scenes and export with stable logical identities and an optional body-rendering flag. */
function fixture(flag){
 const row=hardwareCatalog.find(p=>p.model==="FortiSwitch Rugged 216F-POE"),d=instantiateProfile(row,"Saved <rugged> & controller",{x:0,y:0});d.id="rugged";d.ports.forEach(p=>{p.id=`endpoint-${p.portIndex}`;p.deviceId=d.id;});
 const bounds={x:0,y:0,width:690,height:200,device:d},scene=buildFaceplateScene(d,bounds,{face:"front"});scene.chassis={...scene.chassis,componentDrawn:flag};
 const topology={devices:[d],racks:[],links:[],photos:[],annotations:[],switchSystems:[],firewallClusters:[]};
 const engine={worldBounds:()=>bounds,portCenters:()=>new Map(scene.ports.map(p=>[p.port.id,{x:p.centerX,y:p.centerY}])),rackRectangles:()=>[],deviceRectangles:()=>[bounds],faceplateScenes:()=>new Map([[d.id,scene]]),portGeometry:()=>scene.ports,routingPortGeometry:()=>scene.ports};return{d,bounds,scene,topology,engine};
}

/** Count the generic body path using the real Canvas drawDevice method, with physical components isolated out. */
function canvasCounts(f,selected=false){
 const calls={fill:0,stroke:0,roundRect:0};
 /** Supply only the drawing operations used by the chassis pass, recording actual Canvas decisions. */
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:(...args)=>{if(key in calls)calls[key]++;}});
 const engine={state:{topology:f.topology,selection:selected?{type:"device",id:f.d.id}:null},selectedDevices:new Set(),deviceBoxByID:new Map([[f.d.id,f.bounds]]),faceplateSceneByDevice:new Map([[f.d.id,{...f.scene,components:[]}]]),activeGraphicsProfile:{shadows:false},portBoxesByDevice:new Map([[f.d.id,[]]]),portBoxes:[]};
 CanvasEngine.prototype.drawDevice.call(engine,ctx,f.d,0);return calls;
}

test("component-drawn chassis is a strict boolean opt-in in Canvas and SVG",()=>{
 for(const flag of [undefined,null,false,0,1,"true",{}]){const f=fixture(flag);assert.deepEqual(canvasCounts(f),{fill:1,stroke:1,roundRect:1});assert.match(buildSVGDocument(f.topology,f.engine),/data-layer="physical-chassis"/);}
 const f=fixture(true),before=structuredClone(f.topology),svg=buildSVGDocument(f.topology,f.engine);assert.deepEqual(canvasCounts(f),{fill:0,stroke:0,roundRect:0});assert.deepEqual(canvasCounts(f,true),{fill:0,stroke:1,roundRect:1});assert.doesNotMatch(svg,/data-layer="physical-chassis"/);
 for(const p of f.scene.ports){assert.ok(svg.includes(`data-port-id="${p.port.id}"`));assert.equal(f.engine.routingPortGeometry().find(q=>q.port.id===p.port.id).x,p.x);}assert.match(svg,/data-component="panel"/);assert.match(svg,/Saved &lt;rugged&gt; &amp; controller/);assert.deepEqual(f.topology,before);
});

test("only the two explicit rugged profiles replace their generic physical chassis",()=>{
 const enabled=[];for(const row of hardwareCatalog){const d=instantiateProfile(row,row.model,{x:0,y:0}),scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:row.units*100},{face:"front"});if(scene.chassis.componentDrawn===true)enabled.push(row.model);}
 assert.deepEqual(enabled.sort(),["FortiSwitch Rugged 112F-POE","FortiSwitch Rugged 216F-POE"]);
});
