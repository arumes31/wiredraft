import assert from "node:assert/strict";
import test from "node:test";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {resolveJuniperModularFaceplate} from "./static/js/faceplate-juniper-modular-models.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {resolveFaceplateTemplate} from "./static/js/faceplate.js";
const cases=[{model:"EX9200 family",sku:"EX9204-AC-BND2",count:37,oldCount:60,mapped:[59],height:220.98,units:5,oldUnits:1,power:2},
  {model:"QFX10000 family",sku:"QFX10008-BASE",count:39,oldCount:58,mapped:[57,58],height:574.04,units:13,oldUnits:2,power:6}];
const historical = {"EX9200 family": {faceplate:{"unitsU":1,"totalPorts":60,"rows":2,"portSpacingX":23,"portSpacingY":29,"vendorColor":"#243b31","hasSfpSlots":true,"vendor":"Juniper","layout":"juniper","inventoryRevision":0}, rows:[
  [1,"1","RJ45_1G",1000,"access",0.29,0.25,"Access",1,true],
  [2,"2","RJ45_1G",1000,"access",0.29,0.55,"Access",1,true],
  [3,"3","RJ45_1G",1000,"access",0.29,0.85,"Access",1,true],
  [4,"4","RJ45_1G",1000,"access",0.32499999999999996,0.25,"Access",1,true],
  [5,"5","RJ45_1G",1000,"access",0.32499999999999996,0.55,"Access",1,true],
  [6,"6","RJ45_1G",1000,"access",0.32499999999999996,0.85,"Access",1,true],
  [7,"7","RJ45_1G",1000,"access",0.36,0.25,"Access",1,true],
  [8,"8","RJ45_1G",1000,"access",0.36,0.55,"Access",1,true],
  [9,"9","RJ45_1G",1000,"access",0.36,0.85,"Access",1,true],
  [10,"10","RJ45_1G",1000,"access",0.395,0.25,"Access",1,true],
  [11,"11","RJ45_1G",1000,"access",0.395,0.55,"Access",1,true],
  [12,"12","RJ45_1G",1000,"access",0.395,0.85,"Access",1,true],
  [13,"13","RJ45_1G",1000,"access",0.43,0.25,"Access",1,true],
  [14,"14","RJ45_1G",1000,"access",0.43,0.55,"Access",1,true],
  [15,"15","RJ45_1G",1000,"access",0.43,0.85,"Access",1,true],
  [16,"16","RJ45_1G",1000,"access",0.46499999999999997,0.25,"Access",1,true],
  [17,"17","RJ45_1G",1000,"access",0.46499999999999997,0.55,"Access",1,true],
  [18,"18","RJ45_1G",1000,"access",0.46499999999999997,0.85,"Access",1,true],
  [19,"19","RJ45_1G",1000,"access",0.5,0.25,"Access",1,true],
  [20,"20","RJ45_1G",1000,"access",0.5,0.55,"Access",1,true],
  [21,"21","RJ45_1G",1000,"access",0.5,0.85,"Access",1,true],
  [22,"22","RJ45_1G",1000,"access",0.535,0.25,"Access",1,true],
  [23,"23","RJ45_1G",1000,"access",0.535,0.55,"Access",1,true],
  [24,"24","RJ45_1G",1000,"access",0.535,0.85,"Access",1,true],
  [25,"25","RJ45_1G",1000,"access",0.5700000000000001,0.25,"Access",1,true],
  [26,"26","RJ45_1G",1000,"access",0.5700000000000001,0.55,"Access",1,true],
  [27,"27","RJ45_1G",1000,"access",0.5700000000000001,0.85,"Access",1,true],
  [28,"28","RJ45_1G",1000,"access",0.605,0.25,"Access",1,true],
  [29,"29","RJ45_1G",1000,"access",0.605,0.55,"Access",1,true],
  [30,"30","RJ45_1G",1000,"access",0.605,0.85,"Access",1,true],
  [31,"31","RJ45_1G",1000,"access",0.64,0.25,"Access",1,true],
  [32,"32","RJ45_1G",1000,"access",0.64,0.55,"Access",1,true],
  [33,"33","RJ45_1G",1000,"access",0.64,0.85,"Access",1,true],
  [34,"34","RJ45_1G",1000,"access",0.675,0.25,"Access",1,true],
  [35,"35","RJ45_1G",1000,"access",0.675,0.55,"Access",1,true],
  [36,"36","RJ45_1G",1000,"access",0.675,0.85,"Access",1,true],
  [37,"37","RJ45_1G",1000,"access",0.71,0.25,"Access",1,true],
  [38,"38","RJ45_1G",1000,"access",0.71,0.55,"Access",1,true],
  [39,"39","RJ45_1G",1000,"access",0.71,0.85,"Access",1,true],
  [40,"40","RJ45_1G",1000,"access",0.7449999999999999,0.25,"Access",1,true],
  [41,"41","RJ45_1G",1000,"access",0.7449999999999999,0.55,"Access",1,true],
  [42,"42","RJ45_1G",1000,"access",0.7449999999999999,0.85,"Access",1,true],
  [43,"43","RJ45_1G",1000,"access",0.78,0.25,"Access",1,true],
  [44,"44","RJ45_1G",1000,"access",0.78,0.55,"Access",1,true],
  [45,"45","RJ45_1G",1000,"access",0.78,0.85,"Access",1,true],
  [46,"46","RJ45_1G",1000,"access",0.815,0.25,"Access",1,true],
  [47,"47","RJ45_1G",1000,"access",0.815,0.55,"Access",1,true],
  [48,"48","RJ45_1G",1000,"access",0.815,0.85,"Access",1,true],
  [49,"49","SFP28_25G",25000,"SFP28",0.8500000000000001,0.25,"Access",1,false],
  [50,"50","SFP28_25G",25000,"SFP28",0.8500000000000001,0.55,"Access",1,false],
  [51,"51","SFP28_25G",25000,"SFP28",0.8500000000000001,0.85,"Access",1,false],
  [52,"52","SFP28_25G",25000,"SFP28",0.885,0.25,"Access",1,false],
  [53,"53","SFP28_25G",25000,"SFP28",0.885,0.55,"Access",1,false],
  [54,"54","SFP28_25G",25000,"SFP28",0.885,0.85,"Access",1,false],
  [55,"55","SFP28_25G",25000,"SFP28",0.9199999999999999,0.25,"Access",1,false],
  [56,"56","SFP28_25G",25000,"SFP28",0.9199999999999999,0.55,"Access",1,false],
  [57,"VC1","Stack",40000,"VC",0.9199999999999999,0.85,"Unconfigured",0,false],
  [58,"VC2","Stack",40000,"VC",0.9550000000000001,0.25,"Unconfigured",0,false],
  [59,"MGMT","RJ45_1G",1000,"MGMT",0.18,0.55,"Access",1,false],
  [60,"CONSOLE","USB_C_CONSOLE",0,"CONSOLE",0.275,0.55,"Unconfigured",0,false]
]},
"QFX10000 family": {faceplate:{"unitsU":2,"totalPorts":58,"rows":2,"portSpacingX":23,"portSpacingY":29,"vendorColor":"#243b31","hasSfpSlots":true,"vendor":"Juniper","layout":"juniper","inventoryRevision":0}, rows:[
  [1,"1","SFP28_25G",25000,"SFP28",0.29,0.25,"Access",1,false],
  [2,"2","SFP28_25G",25000,"SFP28",0.29,0.55,"Access",1,false],
  [3,"3","SFP28_25G",25000,"SFP28",0.29,0.85,"Access",1,false],
  [4,"4","SFP28_25G",25000,"SFP28",0.3269444444444444,0.25,"Access",1,false],
  [5,"5","SFP28_25G",25000,"SFP28",0.3269444444444444,0.55,"Access",1,false],
  [6,"6","SFP28_25G",25000,"SFP28",0.3269444444444444,0.85,"Access",1,false],
  [7,"7","SFP28_25G",25000,"SFP28",0.3638888888888889,0.25,"Access",1,false],
  [8,"8","SFP28_25G",25000,"SFP28",0.3638888888888889,0.55,"Access",1,false],
  [9,"9","SFP28_25G",25000,"SFP28",0.3638888888888889,0.85,"Access",1,false],
  [10,"10","SFP28_25G",25000,"SFP28",0.4008333333333333,0.25,"Access",1,false],
  [11,"11","SFP28_25G",25000,"SFP28",0.4008333333333333,0.55,"Access",1,false],
  [12,"12","SFP28_25G",25000,"SFP28",0.4008333333333333,0.85,"Access",1,false],
  [13,"13","SFP28_25G",25000,"SFP28",0.43777777777777777,0.25,"Access",1,false],
  [14,"14","SFP28_25G",25000,"SFP28",0.43777777777777777,0.55,"Access",1,false],
  [15,"15","SFP28_25G",25000,"SFP28",0.43777777777777777,0.85,"Access",1,false],
  [16,"16","SFP28_25G",25000,"SFP28",0.4747222222222222,0.25,"Access",1,false],
  [17,"17","SFP28_25G",25000,"SFP28",0.4747222222222222,0.55,"Access",1,false],
  [18,"18","SFP28_25G",25000,"SFP28",0.4747222222222222,0.85,"Access",1,false],
  [19,"19","SFP28_25G",25000,"SFP28",0.5116666666666667,0.25,"Access",1,false],
  [20,"20","SFP28_25G",25000,"SFP28",0.5116666666666667,0.55,"Access",1,false],
  [21,"21","SFP28_25G",25000,"SFP28",0.5116666666666667,0.85,"Access",1,false],
  [22,"22","SFP28_25G",25000,"SFP28",0.5486111111111112,0.25,"Access",1,false],
  [23,"23","SFP28_25G",25000,"SFP28",0.5486111111111112,0.55,"Access",1,false],
  [24,"24","SFP28_25G",25000,"SFP28",0.5486111111111112,0.85,"Access",1,false],
  [25,"25","SFP28_25G",25000,"SFP28",0.5855555555555556,0.25,"Access",1,false],
  [26,"26","SFP28_25G",25000,"SFP28",0.5855555555555556,0.55,"Access",1,false],
  [27,"27","SFP28_25G",25000,"SFP28",0.5855555555555556,0.85,"Access",1,false],
  [28,"28","SFP28_25G",25000,"SFP28",0.6225,0.25,"Access",1,false],
  [29,"29","SFP28_25G",25000,"SFP28",0.6225,0.55,"Access",1,false],
  [30,"30","SFP28_25G",25000,"SFP28",0.6225,0.85,"Access",1,false],
  [31,"31","SFP28_25G",25000,"SFP28",0.6594444444444445,0.25,"Access",1,false],
  [32,"32","SFP28_25G",25000,"SFP28",0.6594444444444445,0.55,"Access",1,false],
  [33,"33","SFP28_25G",25000,"SFP28",0.6594444444444445,0.85,"Access",1,false],
  [34,"34","SFP28_25G",25000,"SFP28",0.696388888888889,0.25,"Access",1,false],
  [35,"35","SFP28_25G",25000,"SFP28",0.696388888888889,0.55,"Access",1,false],
  [36,"36","SFP28_25G",25000,"SFP28",0.696388888888889,0.85,"Access",1,false],
  [37,"37","SFP28_25G",25000,"SFP28",0.7333333333333334,0.25,"Access",1,false],
  [38,"38","SFP28_25G",25000,"SFP28",0.7333333333333334,0.55,"Access",1,false],
  [39,"39","SFP28_25G",25000,"SFP28",0.7333333333333334,0.85,"Access",1,false],
  [40,"40","SFP28_25G",25000,"SFP28",0.7702777777777777,0.25,"Access",1,false],
  [41,"41","SFP28_25G",25000,"SFP28",0.7702777777777777,0.55,"Access",1,false],
  [42,"42","SFP28_25G",25000,"SFP28",0.7702777777777777,0.85,"Access",1,false],
  [43,"43","SFP28_25G",25000,"SFP28",0.8072222222222223,0.25,"Access",1,false],
  [44,"44","SFP28_25G",25000,"SFP28",0.8072222222222223,0.55,"Access",1,false],
  [45,"45","SFP28_25G",25000,"SFP28",0.8072222222222223,0.85,"Access",1,false],
  [46,"46","SFP28_25G",25000,"SFP28",0.8441666666666667,0.25,"Access",1,false],
  [47,"47","SFP28_25G",25000,"SFP28",0.8441666666666667,0.55,"Access",1,false],
  [48,"48","SFP28_25G",25000,"SFP28",0.8441666666666667,0.85,"Access",1,false],
  [49,"49","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.25,"Access",1,false],
  [50,"50","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.55,"Access",1,false],
  [51,"51","QSFP_DD_400G",400000,"QSFP-DD",0.8811111111111112,0.85,"Access",1,false],
  [52,"52","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.25,"Access",1,false],
  [53,"53","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.55,"Access",1,false],
  [54,"54","QSFP_DD_400G",400000,"QSFP-DD",0.9180555555555556,0.85,"Access",1,false],
  [55,"55","QSFP_DD_400G",400000,"QSFP-DD",0.9550000000000001,0.25,"Access",1,false],
  [56,"56","QSFP_DD_400G",400000,"QSFP-DD",0.9550000000000001,0.55,"Access",1,false],
  [57,"MGMT","RJ45_1G",1000,"MGMT",0.18,0.55,"Access",1,false],
  [58,"CONSOLE","Console",0,"CONSOLE",0.275,0.55,"Unconfigured",0,false]
]}};

/** Build the portable literal historical fixture; all fields are verified against the actual frozen438 constructor in QA. */
function historicalDevice(model) {
  const fixture=historical[model];
  return {id:"",name:"saved custom switch",category:"Switch",positionX:23,positionY:29,model,faceplate:structuredClone(fixture.faceplate),
    ports:fixture.rows.map(([portIndex,label,type,speedMbps,group,faceplateX,faceplateY,mode,nativeVlan,isPoe])=>({id:"",deviceId:"",mode,nativeVlan,allowedVlans:[],isPoe,status:"down",portIndex,label,type,speedMbps,group,faceplateX,faceplateY}))};
}

/** Assign saved device and endpoint identities to either the selected new inventory or literal original inventory. */
function deviceFor(c,legacy=false) {
  const d=legacy?historicalDevice(c.model):instantiateProfile(hardwareCatalog.find(p=>p.vendor==="Juniper"&&p.model===c.model),"saved custom switch",{x:23,y:29});
  d.id="saved-device";d.rackId="saved-rack";d.rackPosition=4;
  d.ports.forEach(p=>{p.id="saved-"+p.portIndex;p.deviceId=d.id;});return d;
}

/** Distinguish positive-area collisions from exactly touching physical boundaries. */
function overlap(a,b) {return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases) {
  test(`${c.sku} resolves its installed cards, service sockets and separate power inputs`,()=>{
    const d=deviceFor(c),p=resolveJuniperModularFaceplate(d);assert.equal(p.sku,c.sku);assert.equal(d.ports.length,c.count);
    assert.equal(Object.values(p.faces).flatMap(f=>f.ports).length,c.count);assert.equal(d.ports.filter(p=>p.type==="Power").length,c.power);
    assert.equal(p.faces.rear.ports.length,c.power);assert.equal(d.faceplate.unitsU,c.units);assert.deepEqual(p.evidence.models,[c.sku]);
    assert.equal(p.faces.front.components.filter(p=>/^(lc\d|lc0-sf1|cb1)-cover$/.test(p.role)).length,c.units===5?2:8);
    assert.ok(Object.values(p.faces).every(f=>f.components.every(p=>p.active===false)));
  });
  test(`${c.sku} preserves full original inventory and rejects incompatible or unknown revisions`,()=>{
    for(const legacy of [true,false]) {
      const d=deviceFor(c,legacy);assert.equal(d.ports.length,legacy?c.oldCount:c.count);assert.equal(d.faceplate.unitsU,legacy?c.oldUnits:c.units);
      if(legacy)delete d.faceplate.inventoryRevision;
      d.ports.reverse();d.ports.forEach(p=>Object.assign(p,{label:`custom ${p.portIndex}`,speedMbps:100,nativeVlan:7,allowedVlans:[7,99],isPoe:true,group:"custom group"}));
      const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`remote-${p.id}`,color:"#badead",label:"saved cable",points:[{x:1,y:3}]}))};
      const before=structuredClone(topology);assert.equal(upgradeInstalledPhysicalPorts(topology),false);
      const scenes=["front","rear"].map(face=>buildFaceplateScene(d,{x:0,y:0,width:690,height:d.faceplate.unitsU*100},{face}));
      assert.equal(scenes.flatMap(s=>s.ports).length,legacy?c.mapped.length:c.count);assert.deepEqual(topology,before);
      if(legacy)assert.deepEqual(scenes.flatMap(s=>s.ports.map(p=>p.port.portIndex)).sort((a,b)=>a-b),c.mapped);
      d.ports=d.ports.filter(p=>[1,33,57,58,59,60].includes(p.portIndex));d.ports.find(p=>p.portIndex===1).type="USB_C_CONSOLE";
      const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.ok(sparse.unmappedPorts.some(p=>p.id==="saved-1"));
      d.faceplate.inventoryRevision=99;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);
    }
  });
  test(`${c.sku} preserves native aspect, readable captions and exact unclaimed socket geometry`,()=>{
    for(const width of [460,690])for(const units of [c.oldUnits,c.units,c.units+2])for(const face of ["front","rear"])for(const legacy of [true,false]) {
      const d=deviceFor(c,legacy);d.faceplate.unitsU=units;const scene=buildFaceplateScene(d,{x:0,y:0,width,height:100*units},{face}),fit=Math.min(1,units/c.units);
      assert.ok(Math.abs(scene.chassis.width-width*fit)<1e-7);assert.ok(Math.abs(scene.chassis.height-690*c.height/482.6*fit)<1e-7);
      const physical=[...scene.ports,...scene.components.filter(p=>!p.applicationOverlay)];
      for(const p of physical)assert.ok(p.x>=scene.chassis.x-1e-7&&p.y>=scene.chassis.y-1e-7&&p.x+p.width<=scene.chassis.x+scene.chassis.width+1e-7&&p.y+p.height<=scene.chassis.y+scene.chassis.height+1e-7,`${p.role||p.displayLabel} chassis bounds`);
      for(const p of scene.ports) {
        for(const q of physical)if(p!==q)assert.ok(!overlap(p,q),`${p.displayLabel} socket overlaps ${q.role||q.displayLabel}`);
        const a=p.labelPlacement;assert.equal(a.hidden===true,fit<.8);
        if(a.hidden)continue;
        const w=Math.min(a.boxMaxWidth,Math.max(12,Math.min(a.maxWidth,p.displayLabel.length*a.fontSize)+6)),label={x:a.x-w/2,y:a.y-a.boxHeight/2,width:w,height:a.boxHeight};
        assert.ok(label.y>=scene.chassis.y&&label.y+label.height<=scene.chassis.y+scene.chassis.height);
        for(const q of physical)assert.ok(!overlap(label,q),`${p.displayLabel} caption overlaps ${q.role||q.displayLabel} at${width}/${units}`);
      }
      if(legacy) {
        const fresh=deviceFor(c);fresh.faceplate.unitsU=units;const current=buildFaceplateScene(fresh,{x:0,y:0,width,height:100*units},{face});
        const supplements=scene.components.filter(p=>p.ancillarySocket);assert.equal(supplements.length,current.ports.length-scene.ports.length);
        for(const a of supplements){const b=current.ports.find(p=>p.port.portIndex===a.physicalSlotIndex);assert.ok(b);for(const k of ["x","y","width","height"])assert.equal(a[k],b[k]);}
      }
    }
  });
}

test("Modular fan and power artwork follows exposed source hardware rather than internal rotor counts",()=>{
  const ex=resolveJuniperModularFaceplate(deviceFor(cases[0])),qfx=resolveJuniperModularFaceplate(deviceFor(cases[1]));
  assert.equal(ex.faces.rear.components.filter(p=>p.kind==="fan").length,0);assert.equal(ex.faces.rear.components.filter(p=>p.role==="fan-tray-endplate").length,1);
  assert.equal(qfx.faces.rear.components.filter(p=>p.kind==="fan").length,2);assert.equal(qfx.faces.rear.components.filter(p=>/^psu\d-cover$/.test(p.role)).length,3);
  assert.equal(qfx.faces.front.components.filter(p=>p.role.startsWith("reserved-sfp")).length,4);
  assert.equal(ex.faces.front.components.filter(p=>p.role.startsWith("sf2-external-sfp")).length,2);
  const craft=ex.faces.front.components.find(c=>c.role==="craft-interface");assert.equal(hardwarePrimitives({...craft,x:0,y:0,width:200,height:40})[0].fill,"#42494c");
  for(const profile of [ex,qfx])for(const c of profile.faces.front.components.filter(c=>c.role.endsWith("-ejector")))assert.ok(hardwarePrimitives({...c,x:0,y:0,width:20,height:40}).some(p=>p.fill==="#7bbad0"));
  for(const [profile,count] of [[ex,2],[qfx,3]]) {
    const switches=profile.faces.rear.components.filter(p=>p.role.endsWith("-switch"));assert.equal(switches.length,count);
    for(const c of switches) {assert.equal(c.variant,"juniper-modular-rocker");const art=hardwarePrimitives({...c,x:0,y:0,width:20,height:24});assert.equal(art.filter(p=>p.kind==="rect").length,2);}
  }
  for(const kind of ["juniper-modular-ex-c20","juniper-modular-qfx-c20"]) {
    const parts=hardwarePrimitives({kind,x:0,y:0,width:35,height:35});assert.equal(parts.filter(p=>p.fill==="#cccccc").length,3);assert.equal(parts.filter(p=>p.kind==="polygon").length,0);
    const blades=parts.filter(p=>p.fill==="#cccccc");assert.ok(blades.every(p=>kind.includes("-ex-")?p.height>p.width:p.width>p.height));
  }
});

test("Every modular source primitive remains bounded at native and actual old allocations",()=>{
  for(const c of cases)for(const width of [460,690])for(const legacy of [false,true])for(const face of ["front","rear"]) {
    const d=deviceFor(c,legacy),scene=buildFaceplateScene(d,{x:0,y:0,width,height:d.faceplate.unitsU*100},{face});
    assert.equal(resolveFaceplateTemplate(d).id,c.units===5?"juniper-ex":"juniper-ex-entry");
    for(const component of [...scene.components.filter(p=>!p.applicationOverlay),...scene.ports.map(p=>({...p,kind:p.connectorKind}))])for(const p of hardwarePrimitives(component)) {
      const points=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:p.kind==="text"?[[p.x-p.text.length*p.fontSize*.31,p.y-p.fontSize/2],[p.x+p.text.length*p.fontSize*.31,p.y+p.fontSize/2]]:[];
      for(const [x,y] of points)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${c.sku} ${component.role||component.kind} primitive bounds`);
    }
  }
});
