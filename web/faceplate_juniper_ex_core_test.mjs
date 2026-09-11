import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveJuniperEXCoreFaceplate} from "./static/js/faceplate-juniper-ex-core-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const cases=[{model:"EX4400 family",sku:"EX4400-48P",count:58,mapped:54,height:43.7,rack:482},
  {model:"EX4600 family",sku:"EX4600-40F-AFO",count:33,mapped:1,height:43.7,rack:482.6}];

/** Reconstruct the independent snapshot438 constructor, preserving all60 original endpoint kinds and indices. */
function deviceFor(c,legacy=false) {
  const current=hardwareCatalog.find(p=>p.vendor==="Juniper"&&p.model===c.model),catalog=legacy?{...current,units:1,inventoryRevision:0,groups:[
    {zone:"access",count:48,type:"RJ45_1G",speed:1000,prefix:"",poe:true},{zone:"uplink",count:8,type:"SFP28_25G",speed:25000,prefix:"SFP28"},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"},{zone:"management",count:1,type:"USB_C_CONSOLE",speed:0,prefix:"CONSOLE"},
    {zone:"uplink",count:2,type:"Stack",speed:40000,prefix:"VC"}]}:current;
  const d=instantiateProfile(catalog,"saved custom switch",{x:23,y:29});d.id="saved-device";d.rackId="rack-x";d.rackPosition=9;
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Test positive-area intersections while allowing exactly touching edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.sku} resolves its exact base hardware population`,()=>{
    const d=deviceFor(c),p=resolveJuniperEXCoreFaceplate(d);assert.equal(p.sku,c.sku);assert.equal(d.ports.length,c.count);
    assert.equal(Object.values(p.faces).flatMap(f=>f.ports).length,c.count);
    assert.equal(d.ports.filter(p=>p.type==="SFP_PLUS_10G").length,c.count===58?0:24);
    assert.equal(d.ports.filter(p=>p.type==="SFP28_25G").length,c.count===58?4:0);
    assert.equal(d.ports.filter(p=>p.type==="Power").length,c.count===58?1:2);
    assert.equal(p.faces.rear.components.filter(p=>p.role.startsWith("chassis-fan")).length,c.count===58?2:5);
    assert.equal(p.faces.rear.components.filter(p=>p.role==="spare-psu-cover").length,c.count===58?1:0);
    assert.equal(p.faces.front.components.filter(p=>p.role.startsWith("expansion-cover")).length,c.count===58?0:2);
    assert.equal(p.faces.rear.ports.filter(p=>p.connectorKind==="qsfp").length,c.count===58?2:0);
    assert.ok(p.faces.front.components.every(p=>p.active===false));
  });
  test(`${c.sku} preserves full old identities and maps only source-compatible sockets`,()=>{
    for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      if(legacy)assert.deepEqual(d.ports.filter(p=>p.portIndex>=57).map(p=>[p.portIndex,p.type]),[[57,"Stack"],[58,"Stack"],[59,"RJ45_1G"],[60,"USB_C_CONSOLE"]],"Constructor orders all uplinks before management groups");
      if(legacy)assert.equal(d.ports.find(p=>p.portIndex===59).label,"MGMT");
      d.ports.forEach(p=>Object.assign(p,{label:`user ${p.portIndex}`,speedMbps:100,nativeVlan:7,allowedVlans:[7,99],isPoe:true,group:"custom"}));d.ports.reverse();
      const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,label:"full cable",color:"#aabbcc",points:[{x:3,y:4}]}))},before=structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scenes=["front","rear"].map(face=>buildFaceplateScene(d,{x:0,y:0,width:690,height:100},{face}));
      assert.equal(scenes.reduce((n,s)=>n+s.ports.length,0),legacy?c.mapped:c.count);assert.equal(scenes[0].unmappedPorts.length,legacy?60-c.mapped:0);assert.deepEqual(topology,before);
      d.ports=d.ports.filter(p=>[1,3,49,57,59].includes(p.portIndex));d.ports.find(p=>p.portIndex===1).type="USB_C_CONSOLE";
      const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.ok(sparse.unmappedPorts.some(p=>p.id==="saved-1"));assert.ok(sparse.ports.every(p=>p.port.id===`saved-${p.port.portIndex}`));
      d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });
  test(`${c.sku} native/saved body proportions, captions and unclaimed hardware stay exact`,()=>{
    for(const width of [460,690])for(const units of [1,2,4])for(const face of ["front","rear"])for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);d.faceplate.unitsU=units;const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
      assert.ok(Math.abs(s.chassis.width-width)<1e-7);assert.ok(Math.abs(s.chassis.height-690*c.height/c.rack)<1e-7);
      const physical=[...s.ports,...s.components.filter(p=>!p.applicationOverlay)];
      for(const p of physical) {assert.ok(p.x>=s.chassis.x-1e-6&&p.y>=s.chassis.y-1e-6);assert.ok(p.x+p.width<=s.chassis.x+s.chassis.width+1e-6&&p.y+p.height<=s.chassis.y+s.chassis.height+1e-6);}
      for(const box of s.ports) {
        const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6)),label={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
        assert.ok(label.y>=s.chassis.y&&label.y+label.height<=s.chassis.y+s.chassis.height);
        for(const p of physical.filter(p=>p.kind!=="text")) {assert.ok(!overlap(label,p),`${box.displayLabel} caption overlaps ${p.role||"socket"} at${width}/${units}/${legacy}`);if(p!==box)assert.ok(!overlap(box,p),`${box.displayLabel} overlaps ${p.role||"socket"}`);}
      }
      if(legacy) {
        const fresh=deviceFor(c);fresh.faceplate.unitsU=units;const current=buildFaceplateScene(fresh,{x:0,y:0,width,height:units*100},{face});
        const supplements=s.components.filter(p=>p.ancillarySocket);assert.equal(supplements.length,current.ports.length-s.ports.length);
        for(const a of supplements) {const expected=current.ports.find(p=>p.port.portIndex===a.physicalSlotIndex);assert.ok(expected);for(const k of ["x","y","width","height"])assert.equal(a[k],expected[k]);}
      }
    }
  });
}

test("Core Juniper inlet drawings distinguish high-temperature key and650W retention hardware",()=>{
  const c16=hardwarePrimitives({kind:"juniper-ex-core-c16-portrait",x:0,y:0,width:28,height:35});
  const c14=hardwarePrimitives({kind:"juniper-ex-core-c14-portrait",x:0,y:0,width:28,height:35});
  for(const shapes of [c16,c14])assert.equal(shapes.filter(p=>p.fill==="#c5ced1").length,3);
  assert.ok(c16.some(p=>p.kind==="polygon"&&p.points.length===10));
  assert.ok(c14.some(p=>p.kind==="polygon"&&p.points.length===42),"visible U-shaped cord retention clip");
  const fan=hardwarePrimitives({kind:"fan",variant:"juniper-ex-core-fan4600",x:0,y:0,width:60,height:50});assert.ok(fan.filter(p=>p.kind==="polygon").length>20);
});

test("EX4400/4600 current and unclaimed source primitives stay within their460/690 component bounds",()=>{
  for(const c of cases)for(const width of [460,690])for(const legacy of [false,true])for(const face of ["front","rear"]) {
    const scene=buildFaceplateScene(deviceFor(c,legacy),{x:0,y:0,width,height:100},{face});
    const components=[...scene.components.filter(p=>!p.applicationOverlay),...scene.ports.map(p=>({...p,kind:p.connectorKind}))];
    for(const component of components)for(const p of hardwarePrimitives(component)) {
      const points=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:
        p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:[];
      for(const [x,y] of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${c.sku} ${component.role||component.kind} primitive bounds`);
    }
  }
});
