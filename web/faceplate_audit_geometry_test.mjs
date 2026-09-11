import assert from "node:assert/strict";
import test from "node:test";
import {hardwareContainsSocket} from "../scripts/faceplate-audit-geometry.mjs";

test("only explicitly declared chassis containers allow wholly contained sockets",()=>{
 const body={kind:"panel",hardwareLayer:"chassis-container",x:0,y:0,width:100,height:80};
 const socket={x:10,y:20,width:15,height:12};
 assert.equal(hardwareContainsSocket(body,socket),true);
 assert.equal(hardwareContainsSocket({...body,kind:"mounting-bracket"},socket),true);
 for(const kind of ["fan","psu","screw","usb"])assert.equal(hardwareContainsSocket({...body,kind},socket),false);
 for(const hardwareLayer of [undefined,true,"true","background"])assert.equal(hardwareContainsSocket({...body,hardwareLayer},socket),false);
 assert.equal(hardwareContainsSocket({...body,hardwareLayer:undefined,captionBackground:true},socket),false);
 for(const changed of [{x:-1},{y:-1},{x:90},{y:75}])assert.equal(hardwareContainsSocket(body,{...socket,...changed}),false);
 assert.equal(hardwareContainsSocket({...body,kind:"module-bay",variant:"populated",hardwareLayer:undefined},socket),true);
 assert.equal(hardwareContainsSocket({...body,kind:"module-bay",variant:"blank",hardwareLayer:undefined},socket),false);
});
