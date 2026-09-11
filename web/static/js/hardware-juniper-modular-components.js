import {addJuniperQFXNextComponent} from "./hardware-juniper-qfx-next-components.js";

const reuse={"juniper-modular-mesh":"juniper-qfx-next-mesh","juniper-modular-smb":"juniper-qfx-next-smb"};

/** Dispatch only inspected EX9204 and QFX10008 ancillary artwork and rectangular C20 inlets. */
export function addJuniperModularComponent(art,c) {
  const v=c.variant||c.kind;
  if(reuse[v])return addJuniperQFXNextComponent(art,{...c,kind:reuse[v],variant:undefined});
  if(typeof v!=="string"||!v.startsWith("juniper-modular-"))return false;
  if(v==="juniper-modular-ex-c20"||v==="juniper-modular-qfx-c20")c20(art,v.includes("-ex-"));
  else if(v.endsWith("-ear"))ear(art,c,v.includes("-ex-"));
  else if(v==="juniper-modular-qfx-fan")fanTray(art,c);
  else if(v==="juniper-modular-ex-craft")craft(art,c);
  else if(v==="juniper-modular-qfx-status")statusPanel(art,c);
  else if(v==="juniper-modular-ex-bank-leds")bankLeds(art,c);
  else if(v==="juniper-modular-re2-status")reLeds(art,c);
  else if(v==="juniper-modular-re2-ssd")ssd(art,c);
  else if(v==="juniper-modular-ex-rear")rearPlate(art);
  else if(v==="juniper-modular-ex-tray")trayEnd(art);
  else if(v.endsWith("-ejector"))ejector(art,c,v.includes("-ex-"));
  else if(v.endsWith("-cover"))cover(art,c,v==="juniper-modular-qfx-cover");
  else if(v==="juniper-modular-earth")earth(art,c);
  else if(v==="juniper-modular-rocker")rocker(art);
  else if(v==="juniper-modular-strip")art.rect(.01,.01,.98,.98,"#b4b4b4","#6c6c6c",.04);
  else if(v==="juniper-modular-status3")leds(art,c,3,false);
  else if(v==="juniper-modular-status4-horizontal")leds(art,c,4,true);
  else return false;
  return true;
}

/** Trace the rectangular AC on/off rocker separately from circular ejectors and reset controls. */
function rocker(art) {
  art.rect(.03,.03,.94,.94,"#848484","#5b5b5b",.06);
  art.rect(.15,.10,.70,.80,"#313131","#b5b5b5",.04);
  art.line(.50,.24,.50,.40,"#bebebe");
  art.circle(.50,.68,.10,"#313131","#bebebe");
}

/** Draw C20's rectangular mouth and three blades, rotating EX's inlet to match its portrait source. */
function c20(art,portrait) {
  art.rect(.025,.025,.95,.95,"#939393","#606060",.07);art.rect(.09,.09,.82,.82,"#1a1a1a","#c5c5c5",.12);
  for(const [x,y] of [[.5,.34],[.30,.66],[.70,.66]]) {
    if(portrait)art.rect(y-.055,1-x-.105,.11,.21,"#cccccc","#868686",.01);
    else art.rect(x-.105,y-.055,.21,.11,"#cccccc","#868686",.01);
  }
}

/** Draw the chassis flange's visible mounting holes without adding a generic row of screws. */
function ear(art,c,ex) {
  art.rect(.02,.005,.96,.99,"#acacac","#717171",.02);
  const ys=ex?[.035,.21,.40,.60,.79,.965]:[.025,.16,.31,.46,.61,.77,.955];
  const r=Math.min(c.width*.22,c.height*.018)/Math.min(c.width,c.height);
  for(const y of ys)art.circle(.5,y,r,"#c0c0c0","#6d6d6d");
}

/** Draw QFX's installed fan-tray guard, two handles and status lamps; its eleven internal rotors stay hidden. */
function fanTray(art,c) {
  art.rect(.012,.005,.976,.99,"#b3b3b3","#5c5c5c",.03);
  for(let row=0;row<10;row++)for(let col=0;col<4;col++)art.rect(.038+col*.235,.17+row*.062,.20,.049,"#4d4d4d","#8d8d8d",.035);
  for(const y of [.14,.84]) {art.rect(.025,y,.95,.013,"#909090","#5a5a5a",.03);art.rect(.06,y+.013,.88,.014,"#bebebe","#6c6c6c",.03);}
  for(const x of [.04,.96])for(const y of [.025,.965])art.circle(x,y,.018,"#cccccc","#656565");
  for(let n=0;n<4;n++)art.circle(.06+n*.08,.06,.009,"#4f4f4f","#7d7d7d");
  art.label("FAN TRAY",.49,.11,Math.min(7,c.height*.016));
}

/** Draw the EX craft panel's grouped lamps, four offline controls and separate alarm relay contacts. */
function craft(art,c) {
  art.rect(.005,.01,.99,.98,"#42494c","#6c6c6c",.015);art.label("JUNIPER EX9204",.14,.38,Math.min(7,c.width*.25/(13*.62)));
  for(const x of [.30,.39])for(const y of [.21,.37,.53])art.circle(x,y,.025,"#5d5d5d","#7c7c7c");
  for(const x of [.29,.39,.49,.59]) {art.circle(x,.80,.058,"#969696","#6e6e6e");art.circle(x-.025,.66,.018,"#5f5f5f");art.circle(x+.025,.66,.018,"#5f5f5f");}
  for(const x of [.58,.61,.64,.67])for(const y of [.24,.43])art.circle(x,y,.024,"#5c5c5c","#787878");
  for(const x of [.49,.51])art.circle(x,.3,.022,"#5c5c5c");
  art.circle(.715,.33,.06,"#8b8b8b","#646464");art.circle(.76,.33,.065,"#8d8d8d","#646464");
  for(let block=0;block<2;block++) {const x=.80+block*.087;art.rect(x,.25,.077,.28,"#b2b2b2","#696969",.01);for(let p=0;p<3;p++)art.circle(x+.016+p*.024,.39,.020,"#565656");}
  art.label("ALARM",.881,.64,Math.min(5,c.height*.11));
}

/** Draw the original QFX power-bus status panel, explicitly omitting the enhanced-bus blue stripe. */
function statusPanel(art,c) {
  art.rect(.02,.02,.96,.96,"#ababab","#6e6e6e",.02);
  for(let n=0;n<5;n++) {art.circle(.17,.15+n*.15,.065,"#585858","#888888");art.line(.37,.15+n*.15,.89,.15+n*.15,"#6b6b6b");}
}

/** Trace the two four-lamp rows beside each EX32XS port group. */
function bankLeds(art,c) {
  for(let n=0;n<8;n++)art.circle(.1+(n%4)*.26,n<4?.24:.76,Math.min(.06,c.height*.10/Math.min(c.width,c.height)),"#5d5d5d","#8c8c8c");
}

/** Draw the RE2's three routing indicators, offline control and two disk lamps. */
function reLeds(art,c) {
  for(const y of [.18,.43,.7])art.circle(.2,y,.065,"#5e5e5e","#888888");
  art.circle(.5,.7,.12,"#a8a8a8","#6d6d6d");for(const y of [.30,.64])art.circle(.84,y,.075,"#5d5d5d","#898989");
}

/** Depict the installed RE2 dual internal SSD carrier face and its two fasteners. */
function ssd(art,c) {
  art.rect(.01,.03,.98,.94,"#c4c4c4","#727272",.05);art.rect(.15,.13,.70,.72,"#8e8e8e","#686868",.03);
  art.label("SSD1 / SSD2",.5,.49,Math.min(7,c.height*.25));for(const x of [.08,.92])art.circle(x,.52,.06,"#b2b2b2","#767676");
}

/** Render the EX rear lower sheet-metal plate and small removable service plate without exposed fans. */
function rearPlate(art) {
  art.rect(.004,.005,.992,.99,"#b4b4b4","#757575",.02);art.rect(.04,.25,.30,.24,"#bdbdbd","#808080",.02);
  for(const x of [.025,.25,.55,.82,.975])art.circle(x,.93,.012,"#c1c1c1","#707070");
}

/** Render only the visible endplate and pull handle of an EX side-mounted fan tray or air filter. */
function trayEnd(art) {
  art.rect(.08,.01,.84,.98,"#b7b7b7","#6f6f6f",.015);art.rect(.27,.29,.46,.42,"#707070","#5b5b5b",.03);
  for(const y of [.12,.87])art.circle(.5,y,.16,"#b8b8b8","#727272");
}

/** Draw the selected card's ejector face using a horizontal EX lever or a tall QFX handle. */
function ejector(art,c,ex) {
  if(ex) {art.rect(.02,.24,.96,.52,"#7bbad0","#707070",.18);art.circle(.5,.50,.16,"#969696","#5c5c5c");}
  else {art.rect(.08,.01,.84,.98,"#7bbad0","#666666",.20);art.rect(.26,.22,.48,.55,"#818181","#626262",.10);}
}

/** Render a fitted blank cover; only QFX line-card covers have the traced perforated center and handles. */
function cover(art,c,mesh) {
  art.rect(.005,.02,.99,.96,c.variant==="juniper-modular-ex-cover"?"#485053":"#b2b2b2","#737373",.02);
  if(mesh) {for(let row=0;row<4;row++)for(let col=0;col<42;col++)art.circle(.075+col*.0205,.22+row*.18,.012,"#6a6a6a");
    for(const x of [.018,.952])art.rect(x,.16,.03,.68,"#7bbad0","#777777",.08);}
  else for(const x of [.025,.975])art.circle(x,.5,Math.min(.075,c.width*.013/Math.min(c.width,c.height)),"#c1c1c1","#7d7d7d");
}

/** Distinguish two protective-earth studs from a connectable power inlet. */
function earth(art,c) {
  art.rect(.03,.03,.94,.94,"#aaaaaa","#6d6d6d",.02);
  const horizontal=c.width>c.height;
  for(const n of [.28,.72])art.circle(horizontal?n:.5,horizontal?.5:n,.17,"#c2c2c2","#6c6c6c");
}

/** Place a specified inactive LED group along the actual source orientation. */
function leds(art,c,count,horizontal) {
  const r=Math.min(.14,.34/count);
  for(let n=0;n<count;n++)art.circle(horizontal?(n+.5)/count:.5,horizontal?.5:(n+.5)/count,r,"#595959","#858585");
}
