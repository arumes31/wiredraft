/** Draw manufacturer-observed rugged brackets, terminal blocks and500D power hardware for both renderers. */
export function addFortinetFinalHardware(art,c){
 const variant=c.variant||c.kind;if(typeof variant!=="string"||!variant.startsWith("fortinet-final-"))return false;
 if(variant==="fortinet-final-body-112"||variant==="fortinet-final-body-216"){
  art.rect(.002,.002,.996,.996,"#b8c3be","#77898a",.006);
  if(variant.endsWith("216")){for(let i=0;i<32;i++){const y=.02+i*.03;for(const x of [.005,.923])art.polygon([[x,y],[x+.072,y+.005],[x+.072,y+.023],[x+.020,y+.023]],"#71898d","#bdc9c3");}art.rect(.083,.005,.834,.99,"#d9dfd8",undefined,.003);}
  else art.rect(.018,.012,.964,.976,"#d9dfd8",undefined,.003);return true;
 }
 if(variant==="fortinet-final-rj45-left"||variant==="fortinet-final-rj45-right"){
  const left=variant.endsWith("left");art.rect(.02,.025,.96,.95,"#58636a","#adb4b1",.02);art.rect(.12,.08,.76,.84,"#101d24",undefined,.01);
  art.rect(left?.04:.83,.35,.13,.30,"#16232a",undefined,.01);for(let i=0;i<8;i++)art.rect(left?.74:.19,.16+i*.084,.06,.032,"#ccb777",undefined,.003);return true;
 }
 if(variant==="fortinet-final-sfp-vertical"){art.rect(.035,.02,.93,.96,"#637478","#c5ccc6",.03);art.rect(.14,.08,.72,.84,"#172b32","#b9c0b8",.01);art.rect(.08,.32,.10,.36,"#88968d",undefined,.01);for(let i=0;i<2;i++)art.rect(.71,.24+i*.4,.07,.11,"#b7b597",undefined,.003);return true;}
 if(variant.includes("terminal")){terminal(art,c,variant.endsWith("5")?5:4);return true;}
 if(variant==="fortinet-final-ble"){art.circle(.5,.5,.42,"#dce0d2","#949e92");art.circle(.5,.5,.12,"#d4d8cc","#b8beb2");return true;}
 if(variant==="fortinet-final-usb-cover"){art.rect(.02,.06,.96,.88,"#aab4b1","#6a7679",.06);for(const x of [.14,.86]){art.circle(x,.5,.08,"#c2cbc3","#657573");art.line(x-.04,.5,x+.04,.5,"#475c62",.7);}return true;}
 if(variant.includes("grille")){grille(art,c,variant.includes("round"));return true;}
 if(variant==="fortinet-final-wlc-psu"){
  art.rect(.01,.02,.98,.96,"#aeb8b3","#536766",.02);for(let i=0;i<6;i++)art.rect(.07+i*.145,.07,.09,.08,"#263b43",undefined,.006);
  art.rect(.21,.22,.70,.12,"#1c2b32","#5c6b6e",.04);art.rect(.025,.18,.15,.28,"#182d33","#73827f",.02);art.rect(.09,.48,.16,.10,"#a6a878","#728477",.01);
  art.rect(.32,.43,.63,.51,"#233238","#96a39e",.04);art.polygon([[.42,.49],[.83,.49],[.91,.60],[.91,.86],[.35,.86],[.35,.60]],"#13242d","#657a7b");for(const [x,y]of [[.48,.67],[.78,.67],[.63,.53]])art.rect(x-.02,y,.04,.13,"#cabd85",undefined,.002);return true;
 }
 if(variant==="fortinet-final-wall-112"||variant==="fortinet-final-wall-216"){wall(art,variant.endsWith("112"));return true;}
 return false;
}

/** Keep terminal pins transverse to the long dimension, matching the unplugged front sockets. */
function terminal(art,c,count){
 art.rect(.025,.025,.95,.95,"#85928d","#bdc7bd",.01);art.rect(.08,.07,.84,.86,"#172730",undefined,.01);const vertical=c.height>c.width;
 for(let i=0;i<count;i++){const n=.16+i*.68/(count-1);art.circle(vertical?.50:n,vertical?n:.50,.045,"#bdc8b9","#6d827b");}
}
/** Retain circular ventilation holes or short horizontal slots without stretching their aspect. */
function grille(art,c,round){
 const cols=Math.max(3,Math.floor(c.width/(round?5:8))),rows=Math.max(2,Math.floor(c.height/(round?5:4))),dx=.94/cols,dy=.94/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<cols-(round?row%2:0);col++){const x=.03+(col+.5+(round?row%2*.5:0))*dx,y=.03+(row+.5)*dy;if(round)art.circle(x,y,Math.min(dx*c.width,dy*c.height)*.33/Math.min(c.width,c.height),"#263b42");else art.rect(x-dx*.34,y-dy*.24,dx*.68,dy*.48,"#263b42",undefined,.01);}
}
/** Trace the distinct supplied wall brackets and their fastening patterns from printed page10. */
function wall(art,horizontal){
 if(!horizontal)for(let i=0;i<29;i++){const y=.14+i*.025;for(const x of [.01,.93])art.polygon([[x,y],[x+.06,y],[x+.06,y+.017],[x+.018,y+.017]],"#819894","#bcc9c1");}
 /** Rotate a normalized drawing into the112F front-photo orientation. */
 const rect=(x,y,w,h,fill)=>horizontal?art.rect(y,1-x-w,h,w,fill,"#768a8c",.01):art.rect(x,y,w,h,fill,"#768a8c",.01);
 /** Transform rear screws and keyhole centers consistently with their plate. */
 const circle=(x,y,r,fill)=>art.circle(horizontal?y:x,horizontal?1-x:y,r,fill,"#6c8082");
 rect(.04,.13,.92,.74,"#bdc6bf");for(const top of [true,false]){const y=top?.01:horizontal?.51:.67;rect(.09,y,.82,horizontal?.48:.32,"#c8d0c7");const cy=top?.055:.945;rect(.445,cy-.024,.11,.048,"#334b54");rect(.477,cy-.045,.046,.09,"#334b54");for(const x of [.23,.77])circle(x,cy,.012,"#41575d");
 if(horizontal)for(const x of [.16,.39,.61,.84])circle(x,top?.445:.555,.019,"#aebcb3");else for(const [x,y]of [[.50,top?.24:.76],[.31,top?.30:.70],[.69,top?.30:.70]])circle(x,y,.018,"#9caaa3");}
 if(!horizontal)for(const [x,y]of [[.23,.48],[.77,.48],[.28,.54],[.72,.54]])circle(x,y,.012,"#8d9e96");
}
