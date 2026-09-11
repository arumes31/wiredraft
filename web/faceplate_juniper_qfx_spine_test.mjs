import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveJuniperQFXSpineFaceplate} from "./static/js/faceplate-juniper-qfx-spine-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";

const cases=[{model:"QFX5200 family",sku:"QFX5200-32C-AFO2",count:38,mapped:2,height:43.688,rack:482.6,units:1,fans:5,qsfp:32,sfp:0,timing:2,rearNetwork:4},
  {model:"QFX5210 family",sku:"QFX5210-64C-AFO",count:70,mapped:2,height:88.9,rack:482.6,units:2,fans:4,qsfp:64,sfp:2,timing:0,rearNetwork:0},
  {model:"QFX5220 family",sku:"QFX5220-32CD-AFO",count:38,mapped:10,height:43.688,rack:482.6,units:1,fans:6,qsfp:32,sfp:2,timing:4,rearNetwork:0}];

const historicalRows=[
  [1,"1","SFP28_25G",25000,"SFP28",0.29,0.25],
  [2,"2","SFP28_25G",25000,"SFP28",0.29,0.55],
  [3,"3","SFP28_25G",25000,"SFP28",0.29,0.85],
  [4,"4","SFP28_25G",25000,"SFP28",0.3269444444444444,0.25],
  [5,"5","SFP28_25G",25000,"SFP28",0.3269444444444444,0.55],
  [6,"6","SFP28_25G",25000,"SFP28",0.3269444444444444,0.85],
  [7,"7","SFP28_25G",25000,"SFP28",0.3638888888888889,0.25],
  [8,"8","SFP28_25G",25000,"SFP28",0.3638888888888889,0.55],
  [9,"9","SFP28_25G",25000,"SFP28",0.3638888888888889,0.85],
  [10,"10","SFP28_25G",25000,"SFP28",0.4008333333333333,0.25],
  [11,"11","SFP28_25G",25000,"SFP28",0.4008333333333333,0.55],
  [12,"12","SFP28_25G",25000,"SFP28",0.4008333333333333,0.85],
  [13,"13","SFP28_25G",25000,"SFP28",0.43777777777777777,0.25],
  [14,"14","SFP28_25G",25000,"SFP28",0.43777777777777777,0.55],
  [15,"15","SFP28_25G",25000,"SFP28",0.43777777777777777,0.85],
  [16,"16","SFP28_25G",25000,"SFP28",0.4747222222222222,0.25],
  [17,"17","SFP28_25G",25000,"SFP28",0.4747222222222222,0.55],
  [18,"18","SFP28_25G",25000,"SFP28",0.4747222222222222,0.85],
  [19,"19","SFP28_25G",25000,"SFP28",0.5116666666666667,0.25],
  [20,"20","SFP28_25G",25000,"SFP28",0.5116666666666667,0.55],
  [21,"21","SFP28_25G",25000,"SFP28",0.5116666666666667,0.85],
  [22,"22","SFP28_25G",25000,"SFP28",0.5486111111111112,0.25],
  [23,"23","SFP28_25G",25000,"SFP28",0.5486111111111112,0.55],
  [24,"24","SFP28_25G",25000,"SFP28",0.5486111111111112,0.85],
  [25,"25","SFP28_25G",25000,"SFP28",0.5855555555555556,0.25],
  [26,"26","SFP28_25G",25000,"SFP28",0.5855555555555556,0.55],
  [27,"27","SFP28_25G",25000,"SFP28",0.5855555555555556,0.85],
  [28,"28","SFP28_25G",25000,"SFP28",0.6225,0.25],
  [29,"29","SFP28_25G",25000,"SFP28",0.6225,0.55],
  [30,"30","SFP28_25G",25000,"SFP28",0.6225,0.85],
  [31,"31","SFP28_25G",25000,"SFP28",0.6594444444444445,0.25],
  [32,"32","SFP28_25G",25000,"SFP28",0.6594444444444445,0.55],
  [33,"33","SFP28_25G",25000,"SFP28",0.6594444444444445,0.85],
  [34,"34","SFP28_25G",25000,"SFP28",0.696388888888889,0.25],
  [35,"35","SFP28_25G",25000,"SFP28",0.696388888888889,0.55],
  [36,"36","SFP28_25G",25000,"SFP28",0.696388888888889,0.85],
  [37,"37","SFP28_25G",25000,"SFP28",0.7333333333333334,0.25],
  [38,"38","SFP28_25G",25000,"SFP28",0.7333333333333334,0.55],
  [39,"39","SFP28_25G",25000,"SFP28",0.7333333333333334,0.85],
  [40,"40","SFP28_25G",25000,"SFP28",0.7702777777777777,0.25],
  [41,"41","SFP28_25G",25000,"SFP28",0.7702777777777777,0.55],
  [42,"42","SFP28_25G",25000,"SFP28",0.7702777777777777,0.85],
  [43,"43","SFP28_25G",25000,"SFP28",0.8072222222222223,0.25],
  [44,"44","SFP28_25G",25000,"SFP28",0.8072222222222223,0.55],
  [45,"45","SFP28_25G",25000,"SFP28",0.8072222222222223,0.85],
  [46,"46","SFP28_25G",25000,"SFP28",0.8441666666666667,0.25],
  [47,"47","SFP28_25G",25000,"SFP28",0.8441666666666667,0.55],
  [48,"48","SFP28_25G",25000,"SFP28",0.8441666666666667,0.85],
  [49,"49","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.25],
  [50,"50","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.55],
  [51,"51","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.85],
  [52,"52","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.25],
  [53,"53","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.55],
  [54,"54","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.85],
  [55,"55","QSFP_DD_400G",400000,"QSFP-DD",0.9550000000000001,0.25],
  [56,"56","QSFP_DD_400G",400000,"QSFP-DD",0.9550000000000001,0.55],
  [57,"MGMT","RJ45_1G",1000,"MGMT",0.18,0.55],
  [58,"CONSOLE","Console",0,"CONSOLE",0.275,0.55]
];

/** Build the literal historical58-port fixture verified field-for-field against frozen438; no QA files are needed by CI. */
function historicalDevice(model) {
  return {id:"",name:"saved custom switch",category:"Switch",positionX:23,positionY:29,model,
    faceplate:{unitsU:2,totalPorts:58,rows:2,portSpacingX:23,portSpacingY:29,vendorColor:"#243b31",hasSfpSlots:true,vendor:"Juniper",layout:"juniper",inventoryRevision:0},
    ports:historicalRows.map(([portIndex,label,type,speedMbps,group,faceplateX,faceplateY])=>({id:"",deviceId:"",mode:type==="Console"?"Unconfigured":"Access",nativeVlan:type==="Console"?0:1,
      allowedVlans:[],isPoe:false,status:"down",portIndex,label,type,speedMbps,group,faceplateX,faceplateY}))};
}

/** Create new inventory or the independent verified historical fixture, then assign saved identities for compatibility checks. */
function deviceFor(c,legacy=false) {
  const d=legacy?historicalDevice(c.model):instantiateProfile(hardwareCatalog.find(p=>p.vendor==="Juniper"&&p.model===c.model),"saved custom switch",{x:23,y:29});d.id="saved-device";d.rackId="rack-x";d.rackPosition=9;
  d.ports.forEach(p=>{p.id=`saved-${p.portIndex}`;p.deviceId=d.id;});return d;
}

/** Test positive-area intersections while allowing exactly touching edges. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.sku} resolves its exact base hardware population`,()=>{
    const d=deviceFor(c),p=resolveJuniperQFXSpineFaceplate(d);assert.equal(p.sku,c.sku);assert.equal(d.ports.length,c.count);
    assert.equal(Object.values(p.faces).flatMap(f=>f.ports).length,c.count);
    assert.equal(d.ports.filter(p=>p.type==="Power").length,2);
    assert.equal(d.ports.filter(p=>p.type==="SFP_PLUS_10G").length,c.sfp);
    assert.equal(d.ports.filter(p=>p.type==="SFP28_25G").length,0);
    assert.equal(p.faces.rear.components.filter(p=>p.role.startsWith("chassis-fan")).length,c.fans);
    assert.equal(p.faces.front.ports.filter(p=>p.connectorKind==="qsfp").length,c.qsfp);
    assert.equal(p.faces.front.components.filter(p=>(p.role.endsWith("output")||p.role.endsWith("input"))&&p.role!=="grandmaster-clock-input").length,c.timing);
    assert.equal(p.faces.rear.ports.filter(p=>p.type!=="Power").length,c.rearNetwork);
    assert.ok(p.faces.front.components.every(p=>p.active===false));
  });
  test(`${c.sku} preserves full old identities and maps only source-compatible sockets`,()=>{
    for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);if(legacy)delete d.faceplate.inventoryRevision;
      assert.equal(d.faceplate.unitsU,legacy?2:c.units,"Original2U allocation and selected native units are preserved");
      if(legacy)assert.deepEqual(d.ports.filter(p=>p.portIndex>=57).map(p=>[p.portIndex,p.type]),[[57,"RJ45_1G"],[58,"Console"]],"Constructor orders all uplinks before management groups");
      if(legacy)assert.equal(d.ports.find(p=>p.portIndex===57).label,"MGMT");
      d.ports.forEach(p=>Object.assign(p,{label:`user ${p.portIndex}`,speedMbps:100,nativeVlan:7,allowedVlans:[7,99],isPoe:true,group:"custom"}));d.ports.reverse();
      const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`peer-${p.id}`,label:"full cable",color:"#aabbcc",points:[{x:3,y:4}]}))},before=structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scenes=["front","rear"].map(face=>buildFaceplateScene(d,{x:0,y:0,width:690,height:100},{face}));
      assert.equal(scenes.reduce((n,s)=>n+s.ports.length,0),legacy?c.mapped:c.count);assert.equal(scenes[0].unmappedPorts.length,legacy?58-c.mapped:0);assert.deepEqual(topology,before);
      if(legacy)assert.deepEqual(scenes.flatMap(s=>s.ports.map(p=>p.port.portIndex)).sort((a,b)=>a-b),(c.mapped===2?[57,58]:[49,50,51,52,53,54,55,56,57,58]),"Only explicit source-compatible original identities map");
      d.ports=d.ports.filter(p=>[1,3,49,57,58].includes(p.portIndex));d.ports.find(p=>p.portIndex===1).type="USB_C_CONSOLE";
      const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.ok(sparse.unmappedPorts.some(p=>p.id==="saved-1"));assert.ok(sparse.ports.every(p=>p.port.id===`saved-${p.port.portIndex}`));
      d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });
  test(`${c.sku} native/saved body proportions, captions and unclaimed hardware stay exact`,()=>{
    for(const width of [460,690])for(const units of [1,2,4])for(const face of ["front","rear"])for(const legacy of [false,true]) {
      const d=deviceFor(c,legacy);d.faceplate.unitsU=units;const s=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face});
      const fit=Math.min(1,units/c.units);assert.ok(Math.abs(s.chassis.width-width*fit)<1e-7);assert.ok(Math.abs(s.chassis.height-690*c.height/c.rack*fit)<1e-7);
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

test("Selected850/1100/1600W inlets retain their source keys and distinct cable retainers",()=>{
  for(const [kind,ring,vertices] of [["juniper-qfx-spine-c14-850",true,6],["juniper-qfx-spine-c16-1100",false,10],["juniper-qfx-spine-c16-1600",true,10]]) {
    const inlet=hardwarePrimitives({kind,x:0,y:0,width:28,height:35});
    assert.equal(inlet.filter(p=>p.fill==="#c5ced1").length,3);
    assert.equal(inlet.filter(p=>p.kind==="polygon").length,ring?2:1);
    assert.equal(inlet.find(p=>p.kind==="polygon").points.length,vertices);
  }
});

test("QFX5210 selected rack brackets retain five round holes and the front photo's pullout tab",()=>{
  const d=deviceFor(cases[1]),profile=resolveJuniperQFXSpineFaceplate(d);
  assert.equal(profile.faces.front.components.filter(p=>p.role==="serial-number-pullout").length,1);
  assert.ok(hardwarePrimitives({kind:"juniper-qfx-spine-pullout5210",x:0,y:0,width:20,height:3}).some(p=>p.fill==="#e3b42d"));
  for(const height of [40,123]) {
    const holes=hardwarePrimitives({kind:"juniper-qfx-spine-ear5210",x:0,y:0,width:24,height}).filter(p=>p.kind==="circle");
    assert.equal(holes.length,5);assert.equal(new Set(holes.map(p=>p.cy)).size,5);
    for(const p of holes)assert.ok(p.cy-p.r>=0&&p.cy+p.r<=height);
  }
});

test("5220 source-supported1G management maps without broadening to undocumented edited types",()=>{
  const d=deviceFor(cases[2],true),mgmt=d.ports.find(p=>p.portIndex===57);
  assert.equal(mgmt.type,"RJ45_1G");
  let scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"front"});
  assert.ok(scene.ports.some(p=>p.port.id===mgmt.id));assert.equal(mgmt.type,"RJ45_1G");
  mgmt.type="RJ45_2_5G";scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:200},{face:"front"});
  assert.ok(scene.unmappedPorts.some(p=>p.id===mgmt.id));assert.ok(!scene.ports.some(p=>p.port.id===mgmt.id));
});

test("Selected5200/5210/5220 gray source panels retain the scoped light Juniper palette",()=>{
  for(const c of cases)for(const legacy of [false,true])assert.equal(resolveFaceplateTemplate(deviceFor(c,legacy)).id,"juniper-ex-entry");
  const other=instantiateProfile(hardwareCatalog.find(p=>p.vendor==="Juniper"&&p.model==="QFX5110 family"),"other",{x:0,y:0});
  assert.notEqual(resolveFaceplateTemplate(other).id,"juniper-ex-entry","Earlier graphite QFX selection remains distinct");
});

test("QFX5200/5210/5220 current and unclaimed source primitives stay within their460/690 component bounds",()=>{
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
