import {addJuniperEXFamilyComponent} from "./hardware-juniper-ex-family-components.js";

/** Dispatch only hardware verified for EX4100-48P and the selected EX4300-48P configuration. */
export function addJuniperEXNextComponent(art,c) {
  const v=c.variant||c.kind;
  // These exact JPSU-920 parts also appear in the independently inspected EX3400 source figures.
  if(v==="juniper-ex-next-c14-portrait")return addJuniperEXFamilyComponent(art,{...c,kind:"juniper-ex-c14-portrait",variant:undefined});
  if(v==="juniper-ex-next-psu4100")return addJuniperEXFamilyComponent(art,{...c,variant:"juniper-ex-psu-fan"});
  if(v==="juniper-ex-next-cover4100") {cover4100(art);return true;}
  if(v==="juniper-ex-next-c16")c16(art);
  else if(v==="juniper-ex-next-mesh"||v==="juniper-ex-next-psu4300")mesh(art,c);
  else if(v==="juniper-ex-next-fan4100")fan4100(art,c);
  else if(v==="juniper-ex-next-fan4300")fan4300(art,c);
  else if(v==="juniper-ex-next-status8")status(art,4,2);
  else if(v==="juniper-ex-next-status3")status(art,3,1);
  else if(v==="juniper-ex-next-status2") {for(const x of [.22,.78])art.circle(x,.5,.17,"#65786c","#34473c");}
  else if(v==="juniper-ex-next-lcd") {art.rect(.01,.01,.98,.98,"#7d8c83","#344c3e",.025);art.rect(.07,.16,.86,.69,"#2c3b32","#5b7161",.01);}
  else if(v==="juniper-ex-next-label") {art.rect(.01,.04,.98,.92,"#b6c0ba","#64736a",.025);for(let n=0;n<4;n++)art.line(.15,.25+n*.16,.80,.25+n*.16,"#839589");}
  else if(v==="juniper-ex-next-edge")art.rect(.01,.01,.98,.98,"#7d8b83","#43594b",.01);
  else if(v==="juniper-ex-next-handle"||v==="juniper-ex-next-orange-handle") {art.rect(.07,.01,.86,.98,v.endsWith("orange-handle")?"#b85c30":"#9aa99f","#4a6252",.17);art.line(.50,.11,.50,.88,"#c6cec9");}
  else if(v==="juniper-ex-next-ear") {art.rect(.01,.01,.98,.98,"#919e98","#415b4b",.03);for(const y of [.10,.76])art.rect(.18,y,.63,.15,"#293d31","#c2cec5",.06);art.circle(.50,.50,.11,"#7e9685","#385340");}
  else return false;
  return true;
}

/** Trace both D-shaped spare-bay grips within the actual cover, avoiding full circles beyond its side edges. */
function cover4100(art) {
  art.rect(.01,.01,.98,.98,"#9caaa4","#455e51",.025);
  for(const side of [0,1]) {
    const cx=side?.94:.06,sign=side?-1:1,pts=[];
    for(let n=0;n<=16;n++){const a=-Math.PI/2+n*Math.PI/16;pts.push([cx+sign*Math.cos(a)*.23,.5+Math.sin(a)*.32]);}
    for(let n=16;n>=0;n--){const a=-Math.PI/2+n*Math.PI/16;pts.push([cx+sign*Math.cos(a)*.18,.5+Math.sin(a)*.25]);}
    art.polygon(pts,"#bac7bf","#5a7262");art.rect(side?.92:.04,.18,.04,.64,"#a6b7ac","#5a7262",.012);
  }
  art.line(.025,.10,.975,.10,"#c0cbc5");art.line(.025,.90,.975,.90,"#566c5f");
}

/** Draw inactive chassis/port-mode lamps with tiny printed legend strokes. */
function status(art,rows,cols) {
  for(let col=0;col<cols;col++)for(let row=0;row<rows;row++) {
    const x=(col+.25)/cols,y=(row+.5)/rows;art.circle(x,y,.06,"#697b70","#3a5141");art.line(x+.08/cols,y,(col+.93)/cols,y,"#758c7d");
  }
}

/** Fill the source exhaust regions with aspect-consistent honeycomb apertures. */
function mesh(art,c) {
  const cols=Math.max(4,Math.round(c.width/5)),rows=Math.max(2,Math.round(c.height/5));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
    const x=(col+.5+(row%2)*.20)/(cols+.2),y=(row+.5)/rows,pts=[];
    for(let n=0;n<6;n++){const a=n*Math.PI/3;pts.push([x+Math.cos(a)*.43/(cols+.2),y+Math.sin(a)*.43/rows]);}art.polygon(pts,"#253e30","#819889");
  }
}

/** Trace EX4100's orange AFO fan frame, crossed braces and center airflow label over its honeycomb guard. */
function fan4100(art,c) {
  art.rect(.01,.01,.98,.98,"#aa5935","#553f2c",.035);mesh(art,c);
  art.polygon([[.025,.12],[.20,.12],[.87,.84],[.87,.96],[.70,.83]],"#b86a42","#8d532e");
  art.polygon([[.97,.12],[.80,.12],[.13,.84],[.13,.96],[.30,.83]],"#b86a42","#8d532e");
  art.rect(.21,.40,.58,.23,"#a4aba0","#705741",.025);art.label("AIR OUT",.5,.51,Math.min(6,c.height*.12));
}

/** Trace EX4300-FAN's honeycomb grille, front extraction handle and AIR OUT label without exposing a rotor. */
function fan4300(art,c) {
  art.rect(.01,.01,.98,.98,"#a2b0a6","#4e6755",.025);mesh(art,c);
  art.polygon([[.38,.035],[.52,.035],[.52,.13],[.43,.13],[.43,.85],[.52,.85],[.52,.96],[.38,.96],[.30,.86],[.30,.14]],"#9aac9e","#516958");
  art.rect(.79,.37,.18,.30,"#b7c4ba","#4e6857",.015);art.line(.83,.44,.93,.44,"#4b6353");art.line(.83,.53,.93,.53,"#4b6353");art.line(.83,.62,.93,.62,"#4b6353");
  for(const [x,y] of [[.15,.10],[.15,.90],[.85,.10],[.85,.90]])art.circle(x,y,.055,"#8ca092","#415d4c");
}

/** Trace the1100W supply's inverted C16 inlet, high-temperature key and three blade contacts from figure43. */
function c16(art) {
  art.rect(.01,.01,.98,.98,"#8d9f92","#3e5947",.035);
  art.polygon([[.10,.15],[.43,.15],[.43,.35],[.57,.35],[.57,.15],[.90,.15],[.90,.65],[.72,.88],[.28,.88],[.10,.65]],"#142f20","#b3c3b7");
  for(const [x,y] of [[.27,.43],[.73,.43],[.50,.69]])art.rect(x-.025,y-.09,.05,.18,"#c5ced1",undefined,.003);
}
