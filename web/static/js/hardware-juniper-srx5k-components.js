import {addJuniperModularComponent} from "./hardware-juniper-modular-components.js";

/** Dispatch the selected SRX5000 components, preserving source-specific socket and supply orientation. */
export function addJuniperSRX5KComponent(art,c) {
  let v=c.variant||c.kind;if(typeof v!=="string"||!v.startsWith("juniper-srx5k-"))return false;
  v=v.slice(14);const vertical=v.endsWith("-v");if(vertical){v=v.slice(0,-2);art=rotate(art);}
  if(["qsfp","sfp","rj45","usb"].includes(v))connector(art,v);
  else if(v==="c20")c20(art,c,false);
  else if(v==="c20-diagonal")c20(art,c,true);
  else if(v==="craft")craft(art,c);
  else if(v==="legend")legend(art,c);
  else if(v==="mesh")mesh(art,c,false);
  else if(v==="grid")mesh(art,c,true);
  else if(v==="slots")slots(art,c);
  else if(v==="ear")ear(art,c);
  else if(v==="leds")leds(art,c);
  else if(v==="tray")tray(art,c);
  else if(v==="cover")cover(art,c);
  else if(v==="psu")psu(art,c);
  else if(v==="strip")art.rect(.01,.02,.98,.96,"#b6b8ba","#646a6e",.02);
  else if(v==="handle")handle(art);
  else if(v==="ejector")ejector(art);
  else if(v==="rocker")return addJuniperModularComponent(art,{...c,variant:"juniper-modular-rocker"});
  else if(v==="earth")return addJuniperModularComponent(art,{...c,variant:"juniper-modular-earth"});
  else return false;return true;
}

/** Rotate horizontal card artwork clockwise into SRX5800's actual vertical card slots. */
function rotate(a) {
  return {rect:(x,y,w,h,...s)=>a.rect(1-y-h,x,h,w,...s),circle:(x,y,...s)=>a.circle(1-y,x,...s),
    line:(x,y,u,v,...s)=>a.line(1-y,x,1-v,u,...s),polygon:(p,...s)=>a.polygon(p.map(([x,y])=>[1-y,x]),...s),
    label:(s,x,y,z)=>a.label(s,1-y,x,z)};
}

/** Draw empty optical cages, storage USB, or keyed copper/serial RJ45 without lit link state. */
function connector(a,kind) {
  a.rect(.02,.04,.96,.92,"#90999d","#56636a",.04);a.rect(.08,.14,.84,.70,"#14212a","#adb4b8",.02);
  if(kind==="rj45") {a.rect(.35,.73,.30,.18,"#14212a","#83939b",.01);for(let n=0;n<8;n++)a.rect(.20+n*.085,.19,.034,.30,"#a7a184",undefined,.003);}
  else if(kind==="usb")a.rect(.20,.30,.60,.21,"#a4adb3","#4f606b",.01);
  else {a.rect(.13,.64,.74,.10,"#425664","#8b9ba2",.01);for(let n=0;n<(kind==="qsfp"?8:5);n++)a.rect(.20+n*(kind==="qsfp"?.082:.13),.67,.03,.10,"#8b8f86",undefined,.002);}
}

/** Draw C20 blades rather than the ambiguous female contacts used in some manufacturer line drawings. */
function c20(a,c,diagonal) {
  if(!diagonal) {a.rect(.025,.025,.95,.95,"#9b9b9b","#62696e",.06);a.rect(.10,.08,.80,.84,"#182126","#b8c1c6",.05);
    for(const [x,y] of [[.33,.5],[.67,.28],[.67,.72]])a.rect(x-.055,y-.10,.11,.20,"#c9ced0","#7d888e",.01);return;}
  const angle=-18*Math.PI/180,ratio=c.width/c.height,fit=Math.min(1,.98/(.86*Math.cos(angle)+.60*Math.abs(Math.sin(angle))/ratio),.98/(.86*Math.abs(Math.sin(angle))*ratio+.60*Math.cos(angle)));
  /** Rotate an inlet rectangle in physical aspect, retaining a bounded diagonal outer envelope. */
  const rect=(x,y,w,h,fill,stroke)=>a.polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([u,v])=>[.5+fit*((u-.5)*Math.cos(angle)-(v-.5)*Math.sin(angle)/ratio),.5+fit*((u-.5)*Math.sin(angle)*ratio+(v-.5)*Math.cos(angle))]),fill,stroke);
  rect(.07,.20,.86,.60,"#8e969b","#525c62");rect(.13,.25,.74,.50,"#131d23","#bcc2c5");
  for(const [x,y] of [[.5,.38],[.32,.61],[.68,.61]])rect(x-.07,y-.027,.14,.054,"#c9ced0","#758086");
}

/** Trace the chassis-specific craft lamps, offline controls and distinct pair of alarm terminals. */
function craft(a,c) {
  a.rect(.005,.01,.99,.98,"#454c51","#a6aeb3",.02);a.label(c.model||"SRX5000",.11,.32,Math.min(8,c.width*.15/5));
  const count=c.controls||4,start=count===4?.23:count===8?.20:.027,step=count===4?.077:count===8?.086:.073;
  for(let n=0;n<count;n++){const x=start+n*step;a.circle(x,.78,.045,"#8199a3","#a6b9c1");a.circle(x-.013,.58,.020,"#526069");a.circle(x+.013,.58,.020,"#526069");}
  const host=count===14?[.46,.54]:[.23,.31],fan=count===14?.38:.43,power=count===14?.27:.51;
  for(const x of host)for(const y of [.16,.31,.46])a.circle(x,y,.018,"#6a7378","#949da1");
  for(let n=0;n<(count===14?6:4);n++)a.circle(fan+(n%3)*.014,.22+Math.floor(n/3)*.17,.016,"#6a7378","#949da1");
  for(let n=0;n<8;n++)a.circle(power+(n%4)*.016,.18+Math.floor(n/4)*.18,.016,"#6a7378","#949da1");
  for(const x of [.72,.76])a.circle(x,.29,.042,"#b0b1ad","#686c69");a.circle(.80,.29,.041,"#76858c","#b3bdc0");
  for(let n=0;n<2;n++){const x=.85+n*.065;a.rect(x,.16,.060,.27,"#668576","#344b40",.01);for(let p=0;p<3;p++)a.circle(x+.011+p*.018,.29,.017,"#253f30");}
}

/** Reproduce perforated PSU surfaces or the SRX5800 square exhaust guard with bounded apertures. */
function mesh(a,c,grid) {
  const cols=Math.max(3,Math.min(44,Math.floor(c.width/7))),rows=Math.max(2,Math.min(18,Math.floor(c.height/7)));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=(col+.5)/cols,y=(row+.5)/rows;
    if(grid)a.rect(x-.38/cols,y-.38/rows,.76/cols,.76/rows,"#182127","#646e73",.015);
    else a.circle(x,y,Math.min(c.width/cols,c.height/rows)*.30/Math.min(c.width,c.height),"#182127","#6c777d");}
}

/** Trace the high-capacity2050W PSU's horizontal rounded ventilation slots from its detailed figure. */
function slots(a,c) {const cols=Math.max(2,Math.floor(c.width/16)),rows=Math.max(2,Math.floor(c.height/8));for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)a.rect((x+.12)/cols,(y+.20)/rows,.76/cols,.60/rows,"#1e292e","#6e7c84",.13);}

/** Draw fitted front flanges; slot holes use model-specific counts rather than a generic rack screw row. */
function ear(a,c) {a.rect(.04,.005,.92,.99,"#aeb3b7","#566268",.02);for(let n=0;n<c.holes;n++)a.rect(.22,.015+n*.93/(c.holes-1),.56,.022,"#303c43","#7c8990",.10);}

/** Place only inactive source lamps; the count and row shape are supplied by each inspected panel. */
function leds(a,c) {const count=c.count||3,cols=c.cols||1,rows=Math.ceil(count/cols);for(let n=0;n<count;n++)a.circle((n%cols+.5)/cols,(Math.floor(n/cols)+.5)/rows,Math.min(.14,.31/Math.max(cols,rows)),"#657279","#8f9da4");}

/** Draw a closed module or Routing Engine slot without suggesting hidden installed endpoints. */
function cover(a,c) {a.rect(.01,.02,.98,.96,c.metal?"#aeb4b8":"#454e54","#919aa0",.02);const radius=Math.min(.06,2/Math.min(c.width,c.height),c.width*.025/Math.min(c.width,c.height));for(const x of [.03,.97])a.circle(x,.5,radius,"#9eaeb7","#60717b");}

/** Draw the visible horizontal front fan-tray endplate; the internal rotors are deliberately hidden. */
function tray(a,c) {a.rect(.01,.05,.98,.90,"#4c545a","#909aa1",.02);for(const x of [.035,.965])a.circle(x,.5,.20,"#9eacb5","#586873");a.line(.09,.35,.91,.35,"#adb6bc");a.line(.09,.64,.91,.64,"#76858e");}

/** Trace the exposed metal face of a first-generation SRX5800 4100W supply around its separately placed hardware. */
function psu(a) {a.rect(.01,.005,.98,.99,"#bac0c4","#737c82",.02);for(const x of [.055,.945])for(const y of [.035,.965])a.circle(x,y,.020,"#a4afb7","#657582");}

/** Draw the blue module ejector used on the source photographs of all three chassis. */
function ejector(a) {a.rect(.015,.20,.97,.60,"#7bbad0","#465e6a",.15);a.circle(.50,.50,.16,"#81929c","#425866");}

/** Draw a metal supply pull handle within its own envelope. */
function handle(a) {a.rect(.13,.02,.74,.96,"#ccd2d6","#7b8a95",.18);a.rect(.31,.14,.38,.72,"#7f909c","#a3afb7",.12);}

/** Draw source port names as bounded strokes so clockwise card rotation also rotates the lettering. */
function legend(a,c) {
 const glyphs={"0":[[0,0,1,0,1,1,0,1,0,0]],"1":[[.3,.2,.6,0,.6,1],[.25,1,1,1]],"2":[[0,0,1,0,1,.5,0,.5,0,1,1,1]],"3":[[0,0,1,0,1,1,0,1],[0,.5,1,.5]],"4":[[0,0,0,.5,1,.5],[1,0,1,1]],"5":[[1,0,0,0,0,.5,1,.5,1,1,0,1]],"/":[[0,1,1,0]],"H":[[0,0,0,1],[1,0,1,1],[0,.5,1,.5]],"A":[[0,1,.5,0,1,1],[.25,.5,.75,.5]],"U":[[0,0,0,1,1,1,1,0]],"X":[[0,0,1,1],[0,1,1,0]],"C":[[1,0,0,0,0,1,1,1]],"O":[[0,0,1,0,1,1,0,1,0,0]],"N":[[0,1,0,0,1,1,1,0]],"M":[[0,1,0,0,.5,.5,1,0,1,1]],"G":[[1,0,0,0,0,1,1,1,1,.5,.5,.5]],"T":[[0,0,1,0],[.5,0,.5,1]]};
 const text=c.text||"",step=.92/Math.max(1,text.length),w=step*.72;
 for(let n=0;n<text.length;n++)for(const path of glyphs[text[n]]||[])for(let k=0;k<path.length-2;k+=2)a.line(.04+n*step+path[k]*w,.12+path[k+1]*.76,.04+n*step+path[k+2]*w,.12+path[k+3]*.76,"#d4dadc");
}
