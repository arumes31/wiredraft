import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveDellStorageFaceplate} from "./static/js/faceplate-dell-storage-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";

const cases=[{model:"PowerStore family",sku:"PowerStore5200T",count:16,drives:25,blanks:0},{model:"PowerVault family",sku:"ME5024",count:12,drives:24,blanks:0}];

/** Rebuild the former ten-port2U constructor independently from the revised catalog. */
function deviceFor(c,legacy=false) {
  const p=hardwareCatalog.find((p)=>p.vendor==="Dell"&&p.model===c.model);
  const catalog=legacy?{...p,units:2,inventoryRevision:0,groups:[{zone:"uplink",count:8,type:"SFP28_25G",speed:25000,prefix:"DATA"},{zone:"management",count:2,type:"RJ45_1G",speed:1000,prefix:"MGMT"}]}:p;
  const d=instantiateProfile(catalog,"custom storage",{x:11,y:22});d.id="saved-device";d.rackId="rack-a";d.rackPosition=7;
  d.ports.forEach((p)=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Detect positive-area intersections while permitting shared enclosure edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.model} selects documented controllers, drives and supplies`,()=>{
    const d=deviceFor(c),p=resolveDellStorageFaceplate(d);
    assert.equal(p.evidence.sku,c.sku);assert.equal(p.inventoryRevision,1);assert.equal(p.fidelity,"model");
    assert.equal(d.ports.length,c.count);assert.equal(p.faces.rear.ports.length,c.count);assert.equal(p.faces.front.ports.length,0);
    assert.ok(d.ports.slice(0,8).every(p=>p.type==="SFP28_25G"));assert.ok(d.ports.slice(8,10).every(p=>p.type==="RJ45_1G"));
    assert.equal(p.faces.front.components.filter((a)=>a.kind==="drive-carrier").length,c.drives);
    assert.equal(p.faces.front.components.filter((a)=>a.role.startsWith("drive-blank-")).length,c.blanks);
    assert.equal(p.faces.rear.components.filter((a)=>a.kind==="psu").length,2);
    assert.equal(p.faces.rear.components.filter((a)=>a.kind==="fan").length,0);
  });
  test(`${c.model} preserves actual former IDs, cables and settings without appending sockets`,()=>{
    for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      d.ports.forEach((p)=>Object.assign(p,{label:`custom-${p.portIndex}`,speedMbps:100,nativeVlan:33,allowedVlans:[33,44],isPoe:true,group:"custom"}));d.ports.reverse();
      const topology={devices:[d],links:d.ports.map(p=>({id:`link-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,color:"#aabbcc",label:"keep cable",points:[{x:9,y:8}]}))};
      const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"rear"});
      assert.equal(scene.ports.length,legacy?10:c.count);assert.equal(scene.unmappedPorts.length,0);assert.deepEqual(topology,before);
      d.ports=d.ports.filter(p=>[2,7,9,10,12].includes(p.portIndex));
      const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});
      assert.ok(sparse.ports.every(p=>p.port.id===`saved-${p.port.portIndex}`));
      d.ports[0].type="USB_C_CONSOLE";
      const unsupported=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});
      assert.equal(unsupported.unmappedPorts.length,1);assert.equal(unsupported.unmappedPorts[0].id,d.ports[0].id);
      d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:200},{face:"rear"});
      assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });
  test(`${c.model} preserves body proportions and bounds at460/690 and1/2/4U`,()=>{
    for(const width of [460,690])for(const face of ["front","rear"]) {
      const d=deviceFor(c),native=buildFaceplateScene(d,{x:0,y:0,width,height:200},{face});
      for(const units of [1,2,4]) {
        d.faceplate.unitsU=units;const scene=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
        assert.ok(Math.abs(scene.chassis.width/scene.chassis.height-native.chassis.width/native.chassis.height)<1e-8);
        for(const p of [...scene.ports,...scene.components.filter(p=>!p.applicationOverlay)]) {
          assert.ok(p.x>=scene.chassis.x-1e-6&&p.y>=scene.chassis.y-1e-6);
          assert.ok(p.x+p.width<=scene.chassis.x+scene.chassis.width+1e-6&&p.y+p.height<=scene.chassis.y+scene.chassis.height+1e-6);
        }
        for(const box of scene.ports) {
          const l=box.labelPlacement,w=Math.min(l.boxMaxWidth,Math.max(12,Math.min(l.maxWidth,box.displayLabel.length*l.fontSize)+6));
          const label={x:l.x-w/2,y:l.y-l.boxHeight/2,width:w,height:l.boxHeight};
          assert.ok(label.y>=scene.chassis.y&&label.y+label.height<=scene.chassis.y+scene.chassis.height);
          for(const p of [...scene.ports,...scene.components.filter(a=>a.kind!=="text")]) {
            assert.ok(!overlap(label,p),`${box.displayLabel} caption overlaps ${p.role||"socket"} at${units}U/${width}`);
            if(p!==box)assert.ok(!overlap(box,p),`${box.displayLabel} overlaps ${p.role||"socket"}`);
          }
        }
      }
    }
  });
}

test("PowerStore opposite node orientation and PowerVault controller orientation retain physical port identity",()=>{
  const [s,v]=cases.map(c=>resolveDellStorageFaceplate(deviceFor(c)));
  const byIndex=p=>new Map(p.faces.rear.ports.map(x=>[x.portIndex,x]));const sp=byIndex(s),vp=byIndex(v);
  assert.ok(sp.get(1).y>sp.get(5).y);assert.ok(sp.get(1).x<sp.get(4).x);assert.ok(sp.get(5).x>sp.get(8).x);
  assert.ok(vp.get(1).y<vp.get(5).y);assert.ok(vp.get(1).x<vp.get(4).x);assert.ok(vp.get(5).x>vp.get(8).x);
  assert.equal(sp.get(13).type,"QSFP28_100G");assert.equal(vp.get(11).connectorKind,"usb-micro");
  assert.equal(s.faces.front.components.filter(p=>p.variant==="powerstore-nvram").length,4);
  assert.equal(v.faces.rear.components.filter(p=>p.variant==="me5-sas-expansion").length,2);
  for(const variant of ["powerstore-2100w","me5-580w"]) {
    const parts=hardwarePrimitives({kind:"psu",variant,x:0,y:0,width:120,height:90});
    assert.equal(parts.filter(p=>p.kind==="rect"&&p.fill==="#d0d6d8").length,3);
  }
});
