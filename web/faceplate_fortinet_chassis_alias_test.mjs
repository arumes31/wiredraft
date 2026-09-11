import test from "node:test";
import assert from "node:assert/strict";
import {hardwareCatalog,instantiateProfile,upgradeInstalledPhysicalPorts} from "./static/js/catalog.js";
import {buildFaceplateScene} from "./static/js/faceplate-scene.js";
import {hardwarePrimitives} from "./static/js/hardware-components.js";
import {resolveModelFaceplate} from "./static/js/faceplate-models.js";
import {resolveFortinetFaceplate} from "./static/js/faceplate-fortinet-models.js";
import {resolveFortinetChassisAliasFaceplate} from "./static/js/faceplate-fortinet-chassis-alias-models.js";

// Independent complete historical literals, verified against actual frozen438 execution in QA only.
const historical={
  "FortiGate 6000F": {
    "id": "",
    "name": "saved FortiGate",
    "category": "Firewall",
    "model": "FortiGate 6000F",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 3,
      "totalPorts": 35,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#8f2525",
      "hasSfpSlots": true,
      "vendor": "Fortinet",
      "layout": "fortinet",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "1",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.34,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "2",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.34,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "3",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.38730769230769235,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 4,
        "label": "4",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.38730769230769235,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 5,
        "label": "5",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.4346153846153846,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 6,
        "label": "6",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.4346153846153846,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 7,
        "label": "7",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.48192307692307695,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 8,
        "label": "8",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.48192307692307695,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 9,
        "label": "9",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.5292307692307693,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 10,
        "label": "10",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.5292307692307693,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 11,
        "label": "11",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.5765384615384616,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 12,
        "label": "12",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.5765384615384616,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 13,
        "label": "13",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.6238461538461539,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 14,
        "label": "14",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.6238461538461539,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 15,
        "label": "15",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.6711538461538462,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 16,
        "label": "16",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.6711538461538462,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 17,
        "label": "17",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.7184615384615385,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 18,
        "label": "18",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.7184615384615385,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 19,
        "label": "19",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.7657692307692308,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 20,
        "label": "20",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.7657692307692308,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 21,
        "label": "21",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.8130769230769231,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 22,
        "label": "22",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.8130769230769231,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 23,
        "label": "23",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.8603846153846153,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 24,
        "label": "24",
        "type": "SFP28_25G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 25000,
        "isPoe": false,
        "status": "down",
        "group": "SFP28",
        "faceplateX": 0.8603846153846153,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 25,
        "label": "25",
        "type": "QSFP28_100G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 100000,
        "isPoe": false,
        "status": "down",
        "group": "QSFP28",
        "faceplateX": 0.9076923076923078,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 26,
        "label": "26",
        "type": "QSFP28_100G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 100000,
        "isPoe": false,
        "status": "down",
        "group": "QSFP28",
        "faceplateX": 0.9076923076923078,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 27,
        "label": "27",
        "type": "QSFP28_100G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 100000,
        "isPoe": false,
        "status": "down",
        "group": "QSFP28",
        "faceplateX": 0.9550000000000001,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 28,
        "label": "28",
        "type": "QSFP28_100G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 100000,
        "isPoe": false,
        "status": "down",
        "group": "QSFP28",
        "faceplateX": 0.9550000000000001,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 29,
        "label": "HA1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 30,
        "label": "HA2",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 31,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.22,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 32,
        "label": "MGMT2",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.265,
        "faceplateY": 0.25
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 33,
        "label": "MGMT3",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.265,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 34,
        "label": "CONSOLE1",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.265,
        "faceplateY": 0.85
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 35,
        "label": "CONSOLE2",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.31,
        "faceplateY": 0.25
      }
    ]
  },
  "FortiGate 7000E": {
    "id": "",
    "name": "saved FortiGate",
    "category": "Firewall",
    "model": "FortiGate 7000E",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 12,
      "totalPorts": 4,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#8f2525",
      "hasSfpSlots": false,
      "vendor": "Fortinet",
      "layout": "fortinet",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.29,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "MGMT2",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.9550000000000001,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "CONSOLE1",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.18,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 4,
        "label": "CONSOLE2",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.275,
        "faceplateY": 0.55
      }
    ]
  },
  "FortiGate 7000F": {
    "id": "",
    "name": "saved FortiGate",
    "category": "Firewall",
    "model": "FortiGate 7000F",
    "positionX": 23,
    "positionY": 29,
    "faceplate": {
      "unitsU": 12,
      "totalPorts": 4,
      "rows": 2,
      "portSpacingX": 23,
      "portSpacingY": 29,
      "vendorColor": "#8f2525",
      "hasSfpSlots": false,
      "vendor": "Fortinet",
      "layout": "fortinet",
      "inventoryRevision": 0
    },
    "ports": [
      {
        "id": "",
        "deviceId": "",
        "portIndex": 1,
        "label": "MGMT1",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.29,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 2,
        "label": "MGMT2",
        "type": "RJ45_1G",
        "mode": "Access",
        "nativeVlan": 1,
        "allowedVlans": [],
        "speedMbps": 1000,
        "isPoe": false,
        "status": "down",
        "group": "MGMT",
        "faceplateX": 0.9550000000000001,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 3,
        "label": "CONSOLE1",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.18,
        "faceplateY": 0.55
      },
      {
        "id": "",
        "deviceId": "",
        "portIndex": 4,
        "label": "CONSOLE2",
        "type": "Console",
        "mode": "Unconfigured",
        "nativeVlan": 0,
        "allowedVlans": [],
        "speedMbps": 0,
        "isPoe": false,
        "status": "down",
        "group": "CONSOLE",
        "faceplateX": 0.275,
        "faceplateY": 0.55
      }
    ]
  }
};
const cases=[{alias:"FortiGate 6000F",exact:"FortiGate 6301F",units:3,oldUnits:3,height:132,width:437,count:34,oldCount:35,mapped:31,psus:3,fans:3,blanks:0},{alias:"FortiGate 7000E",exact:"FortiGate 7060E",units:8,oldUnits:12,height:352.7,width:440,count:26,oldCount:4,mapped:2,psus:4,fans:3,blanks:2},{alias:"FortiGate 7000F",exact:"FortiGate 7081F",units:12,oldUnits:12,height:543.9,width:440,count:43,oldCount:4,mapped:2,psus:6,fans:3,blanks:6}];

/** Instantiate exact current alias or its complete independent saved inventory, then attach persisted identities. */
function deviceFor(c,old=false){const d=old?structuredClone(historical[c.alias]):instantiateProfile(hardwareCatalog.find(p=>p.model===c.alias),"saved FortiGate",{x:23,y:29});d.id="saved-firewall";d.rackId="rack-identity";d.rackPosition=7;for(const p of d.ports){p.id=`saved-port-${p.portIndex}`;p.deviceId=d.id;}return d;}

/** Detect interior overlap without rejecting touching artwork edges. */
function overlap(a,b){return a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;}

for(const c of cases){
 test(`${c.alias} selects only ${c.exact} and preserves the reused exact profile`,()=>{
  const exact=instantiateProfile(hardwareCatalog.find(p=>p.model===c.exact),"exact",{x:0,y:0}),before=structuredClone(resolveFortinetFaceplate(exact));
  const d=deviceFor(c),p=resolveFortinetChassisAliasFaceplate(d);assert.equal(d.ports.length,c.count);assert.equal(d.faceplate.unitsU,c.units);assert.equal(p.inventoryRevision,1);assert.deepEqual(p.evidence.models,[c.exact]);assert.equal(p.evidence.catalogAlias,c.alias);assert.equal(p.evidence.physicalDimensions.heightMm,c.height);
  assert.equal(p.faces.front.ports.length,c.count);assert.equal(Object.values(p.faces).flatMap(f=>f.components).filter(a=>a.kind==="psu").length,c.psus);assert.equal(p.faces.rear.components.filter(a=>a.kind==="fan").length,c.fans);assert.equal(p.faces.front.components.filter(a=>a.role==="unused-module").length,c.blanks);
  assert.ok(Object.values(p.faces).every(f=>f.components.every(a=>a.active===false)));assert.ok(p.faces.front.ports.every(a=>!a.compatibleTypes));assert.deepEqual(resolveFortinetFaceplate(exact),before);
 });
 test(`${c.alias} preserves full saved records,cables,revision semantics and physical media`,()=>{
  for(const old of [true,false]){const d=deviceFor(c,old);if(old)delete d.faceplate.inventoryRevision;d.ports.reverse();for(const p of d.ports)Object.assign(p,{label:`custom-${p.portIndex}`,speedMbps:123,mode:"Trunk",nativeVlan:37,allowedVlans:[37,91],isPoe:true,group:"saved-custom"});
   const topology={devices:[d],links:d.ports.map(p=>({id:`cable-${p.id}`,fromDeviceId:d.id,fromPortId:p.id,toDeviceId:"peer",toPortId:`remote-${p.id}`,label:"saved cable",color:"#123456",points:[{x:3,y:11}]}))},before=structuredClone(topology);
   assert.equal(upgradeInstalledPhysicalPorts(topology),false);const scene=buildFaceplateScene(d,{x:0,y:0,width:690,height:d.faceplate.unitsU*100},{face:"front"});assert.equal(scene.ports.length,old?c.mapped:c.count);assert.deepEqual(topology,before);assert.equal(d.ports.length,old?c.oldCount:c.count);assert.equal(d.faceplate.unitsU,old?c.oldUnits:c.units);
   if(old&&c.alias.endsWith("6000F")){assert.deepEqual(scene.unmappedPorts.map(p=>p.portIndex).sort((a,b)=>a-b),[29,30,33,35]);assert.equal(scene.ports.find(p=>p.port.portIndex===31).displayLabel,"custom-31");}
   d.ports=d.ports.filter(p=>[1,2,31,34].includes(p.portIndex));d.ports.find(p=>p.portIndex===1).type="USB_C_CONSOLE";const sparse=buildFaceplateScene(d,{x:0,y:0,width:460,height:d.faceplate.unitsU*100},{face:"front"});assert.ok(sparse.unmappedPorts.some(p=>p.portIndex===1));
   for(const revision of [99,-1,1.5,"1","0"]){d.faceplate.inventoryRevision=revision;const unknown=buildFaceplateScene(d,{x:0,y:0,width:460,height:d.faceplate.unitsU*100},{face:"front"});assert.equal(unknown.ports.length,0);assert.equal(unknown.unmappedPorts.length,d.ports.length);}
  }
 });
 test(`${c.alias} fits native and saved body proportions with clear sockets and captions`,()=>{
  for(const width of [460,690])for(const units of [2,c.units,c.oldUnits+2])for(const old of [false,true])for(const face of ["front","rear"]){const d=deviceFor(c,old);d.faceplate.unitsU=units;const scene=buildFaceplateScene(d,{x:0,y:0,width,height:units*100},{face}),scale=Math.min(1,units/c.units),all=[...scene.ports,...scene.components.filter(p=>!p.applicationOverlay)];
   assert.ok(Math.abs(scene.chassis.height-690*c.height/482.6*scale)<1e-7);assert.ok(Math.abs(scene.chassis.width-width*c.width/482.6*scale)<1e-7);
   for(const p of all)assert.ok(p.x>=scene.chassis.x-.001&&p.y>=scene.chassis.y-.001&&p.x+p.width<=scene.chassis.x+scene.chassis.width+.001&&p.y+p.height<=scene.chassis.y+scene.chassis.height+.001,`${c.alias} ${p.role||p.kind||p.displayLabel} bounds`);
   for(const p of scene.ports){for(const q of all)if(q!==p)assert.ok(!overlap(p,q),`${c.alias} ${p.displayLabel} overlaps ${q.role||q.kind||q.displayLabel}`);
    const a=p.labelPlacement;assert.equal(a.hidden===true,scale<.8||c.alias!=="FortiGate 6000F");if(a.hidden)continue;
    const w=Math.min(a.boxMaxWidth,Math.max(12,Math.min(a.maxWidth,p.displayLabel.length*a.fontSize)+6)),label={x:a.x-w/2,y:a.y-a.boxHeight/2,width:w,height:a.boxHeight};
    for(const q of all)assert.ok(!overlap(label,q),`${c.alias} caption ${p.displayLabel} overlaps ${q.role||q.kind||q.displayLabel} at${width}/${units}`);
   }
   if(old){const current=deviceFor(c);current.faceplate.unitsU=units;const fresh=buildFaceplateScene(current,{x:0,y:0,width,height:units*100},{face}),supplements=scene.components.filter(p=>p.ancillarySocket);assert.equal(supplements.length,fresh.ports.length-scene.ports.length);for(const a of supplements){const b=fresh.ports.find(p=>p.port.portIndex===a.physicalSlotIndex);assert.ok(b);for(const key of ["x","y","width","height"])assert.equal(a[key],b[key]);}}
  }
 });
}

test("Fortinet alias primitive envelopes and generation2 inlet details are source-specific",()=>{
 for(const c of cases)for(const width of [460,690])for(const old of [false,true])for(const face of ["front","rear"]){const d=deviceFor(c,old),scene=buildFaceplateScene(d,{x:0,y:0,width,height:d.faceplate.unitsU*100},{face});for(const component of [...scene.components.filter(p=>!p.applicationOverlay),...scene.ports.map(p=>({...p,kind:p.connectorKind}))])for(const p of hardwarePrimitives(component)){
  const pts=p.kind==="polygon"?p.points:p.kind==="rect"?[[p.x,p.y],[p.x+p.width,p.y+p.height]]:p.kind==="circle"?[[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]:p.kind==="line"?[[p.x1,p.y1],[p.x2,p.y2]]:[];
  for(const [x,y] of pts)assert.ok(x>=component.x-.001&&x<=component.x+component.width+.001&&y>=component.y-.001&&y<=component.y+component.height+.001,`${c.alias} ${component.role||component.kind} ${component.variant} primitive bounds`);
 }}
 const primitive=hardwarePrimitives({kind:"psu",variant:"fortinet-chassis-alias-c16-gen2",x:0,y:0,width:70,height:45,active:false});assert.equal(primitive.filter(p=>p.fill==="#bac2c5").length,3);assert.ok(primitive.some(p=>p.kind==="circle"&&p.fill==="#78858b"));assert.ok(primitive.some(p=>p.fill==="#8e9395"));
});


test("Native7000E/F physical legends replace oversized caption boxes without changing stored labels",()=>{
 for(const c of cases.slice(1))for(const width of [460,690])for(const old of [false,true]){const d=deviceFor(c,old),scene=buildFaceplateScene(d,{x:0,y:0,width,height:d.faceplate.unitsU*100},{face:"front"}),legends=scene.components.filter(p=>p.variant==="fortinet-chassis-alias-legend");assert.equal(legends.length,c.count);assert.ok(legends.every(p=>p.text&&p.role.startsWith("port")));
  for(const component of legends){const p=hardwarePrimitives(component);assert.equal(p.length,1);assert.equal(p[0].kind,"text");assert.ok(p[0].fontSize>0&&p[0].fontSize<=3.5);const textWidth=p[0].fontSize*p[0].text.length*.62;assert.ok(p[0].x-textWidth/2>=component.x&&p[0].x+textWidth/2<=component.x+component.width);assert.ok(p[0].y-p[0].fontSize/2>=component.y&&p[0].y+p[0].fontSize/2<=component.y+component.height);for(const other of [...scene.ports,...scene.components.filter(p=>!p.applicationOverlay&&p!==component)])assert.ok(!overlap(component,other),`${c.alias} ${component.role} overlaps ${other.role||other.kind}`);}
 }
});


test("Unrecognized and inherited model names retain the shared resolver null fallback",()=>{
 for(const model of ["constructor","toString","__proto__","hasOwnProperty","FortiGate 6000F unknown"]){const d={model,category:"Firewall",faceplate:{vendor:"Fortinet",unitsU:3},ports:[]},before=structuredClone(d);assert.equal(resolveFortinetChassisAliasFaceplate(d),null);assert.equal(resolveModelFaceplate(d),null);assert.deepEqual(d,before);}
});
