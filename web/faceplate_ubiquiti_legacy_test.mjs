import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveUbiquitiLegacyFaceplate} from "./static/js/faceplate-ubiquiti-legacy-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const cases=[{model:"EdgeMAX legacy family",sku:"ER-12",count:14,mapped:10,bodyWidth:268.1,bodyHeight:31.1,rackWidth:483,fans:0,console:13,power:14},
  {model:"EdgeRouter legacy family",sku:"ER-8",count:10,mapped:8,bodyWidth:484,bodyHeight:44,rackWidth:484,fans:2,console:9,power:10},
  {model:"EdgeSwitch legacy family",sku:"ES-16-150W",count:20,mapped:16,bodyWidth:483,bodyHeight:43,rackWidth:483,fans:2,console:19,power:20}];

/** Build new devices or the independent original16copper+2SFPplus+MGMT19-port constructor. */
function deviceFor(c,legacy=false) {
  const current=hardwareCatalog.find(p=>p.vendor==="Ubiquiti"&&p.model===c.model),catalog=legacy?{...current,units:1,inventoryRevision:0,groups:[
    {zone:"access",count:16,type:"RJ45_1G",speed:1000,prefix:""},{zone:"uplink",count:2,type:"SFP_PLUS_10G",speed:10000,prefix:"SFP+"},
    {zone:"management",count:1,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]}:current;
  const d=instantiateProfile(catalog,"custom legacy router",{x:12,y:13});d.id="saved-device";d.rackId="rack-x";d.rackPosition=9;
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Detect positive-area hardware/caption collisions while allowing touching edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.sku} has the selected factory socket/PSU/fan/mount population`,()=>{
    const d=deviceFor(c),p=resolveUbiquitiLegacyFaceplate(d);assert.equal(p.sku,c.sku);assert.equal(p.fidelity,"model");assert.equal(d.ports.length,c.count);
    assert.equal(Object.values(p.faces).flatMap(f=>f.ports).length,c.count);assert.equal(d.ports.find(p=>p.portIndex===c.console).type,"Console");assert.equal(d.ports.find(p=>p.portIndex===c.power).type,"Power");
    assert.equal(p.faces.rear.components.filter(p=>p.kind==="fan").length,c.fans);assert.equal(p.faces.rear.components.filter(p=>p.kind==="psu").length,0,"Fixed PSU is not a replaceable exposed module");
    assert.ok(p.faces.front.components.every(p=>p.active===false));
    assert.equal(p.faces.front.components.filter(p=>p.role==="usb-reserved").length,c.sku==="ES-16-150W"?0:1);
    assert.equal(p.faces.front.components.filter(p=>p.role.startsWith("rack-ear")).length,c.sku==="ER-12"?0:2);
    assert.equal(d.ports.some(p=>p.type==="SFP_PLUS_10G"),false);assert.equal(d.ports.some(p=>p.label.startsWith("MGMT")),false);
  });
  test(`${c.sku} retains true historical identities, complete cables/settings and unsupported ports`,()=>{
    for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      d.ports.forEach(p=>Object.assign(p,{label:`user label${p.portIndex}`,speedMbps:100,nativeVlan:7,allowedVlans:[7,99],isPoe:true,group:"user"}));d.ports.reverse();
      const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,label:"full cable",color:"#aabbcc",points:[{x:3,y:4}]}))},before=structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scenes=["front","rear"].map(face=>buildFaceplateScene(d,{x:0,y:0,width:690,height:100},{face}));
      assert.equal(scenes.reduce((n,s)=>n+s.ports.length,0),legacy?c.mapped:c.count);assert.equal(scenes[0].unmappedPorts.length,legacy?19-c.mapped:0);assert.deepEqual(topology,before);
      d.ports=d.ports.filter(p=>[1,3,17,19].includes(p.portIndex));const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});
      assert.ok(sparse.ports.every(p=>p.port.id===`saved-${p.port.portIndex}`));
      const first=d.ports.find(p=>p.portIndex===1);first.type="USB_C_CONSOLE";const bad=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.ok(bad.unmappedPorts.some(p=>p.id===first.id));
      d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });
  test(`${c.sku} keeps actual native body dimensions, saved allocation ratios and captions at460/690`,()=>{
    for(const width of [460,690])for(const face of ["front","rear"]) {
      const d=deviceFor(c),native=buildFaceplateScene(d,{x:0,y:0,width,height:100},{face});
      assert.ok(Math.abs(native.chassis.width-width*c.bodyWidth/c.rackWidth)<1e-7);assert.ok(Math.abs(native.chassis.height-690*c.bodyHeight/c.rackWidth)<1e-7);
      for(const units of [1,2,4]) {
        d.faceplate.unitsU=units;const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
        assert.ok(Math.abs(s.chassis.width/s.chassis.height-native.chassis.width/native.chassis.height)<1e-8);
        for(const p of [...s.ports,...s.components.filter(p=>!p.applicationOverlay)]) {
          assert.ok(p.x>=s.chassis.x-1e-6&&p.y>=s.chassis.y-1e-6);assert.ok(p.x+p.width<=s.chassis.x+s.chassis.width+1e-6&&p.y+p.height<=s.chassis.y+s.chassis.height+1e-6);
        }
        for(const box of s.ports) {
          const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6)),label={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
          assert.ok(label.y>=s.chassis.y&&label.y+label.height<=s.chassis.y+s.chassis.height);
          for(const p of [...s.ports,...s.components.filter(a=>a.kind!=="text")]) {
            assert.ok(!overlap(label,p),`${box.displayLabel} caption overlaps ${p.role||"socket"} at${units}U/${width}`);
            if(p!==box)assert.ok(!overlap(box,p),`${box.displayLabel} overlaps ${p.role||"socket"}`);
          }
        }
      }
    }
  });
}

test("Legacy Ubiquiti artwork preserves C14 blade contacts, barrel power and perforated fan guards",()=>{
  const ac=hardwarePrimitives({kind:"ubiquiti-legacy-c14",x:0,y:0,width:34,height:24});assert.equal(ac.filter(p=>p.fill==="#c5ced1").length,3);
  const c6=hardwarePrimitives({kind:"ubiquiti-er8-c6",x:0,y:0,width:34,height:30});assert.equal(c6.filter(p=>p.kind==="circle"&&p.fill==="#c5ced1").length,3);
  assert.equal(resolveUbiquitiLegacyFaceplate(deviceFor(cases[1])).faces.rear.ports[0].connectorKind,"ubiquiti-er8-c6");
  const dc=hardwarePrimitives({kind:"ubiquiti-er12-dc",x:0,y:0,width:18,height:18});assert.ok(dc.some(p=>p.kind==="circle"));assert.equal(dc.filter(p=>p.fill==="#c5ced1").length,1);
  const fan=hardwarePrimitives({kind:"fan",variant:"ubiquiti-legacy-guard",x:0,y:0,width:45,height:45});assert.equal(fan.filter(p=>p.kind==="polygon").length,12,"Three four-segment vent rings, no invented rotor blades");
  const legend=hardwarePrimitives({kind:"led-strip",variant:"ubiquiti-legacy-legend",x:0,y:0,width:16,height:20});assert.equal(legend.length,6);assert.equal(legend.filter(p=>p.kind==="rect").length,3,"Static legend does not fall through into generic RJ45 artwork");
});
