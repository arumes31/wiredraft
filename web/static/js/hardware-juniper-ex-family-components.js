/** Draw only hardware traced from EX2300-48P and EX3400-48P manufacturer figures. */
export function addJuniperEXFamilyComponent(art,component) {
  const v=component.variant||component.kind;
  if(v==="juniper-ex-c14")c14(art);
  else if(v==="juniper-ex-c14-portrait")c14Portrait(art);
  else if(v==="juniper-ex-fixed-guard")honeycomb(art,component,true);
  else if(v==="juniper-ex-honeycomb")honeycomb(art,component,false);
  else if(v==="juniper-ex-fan-module")fanModule(art,component);
  else if(v==="juniper-ex-psu-fan")psuFan(art);
  else if(v==="juniper-ex-psu-cover")psuCover(art);
  else if(v==="juniper-ex-handle") {art.rect(.05,.03,.90,.94,"#788588","#263739",.20);art.rect(.30,.17,.40,.65,"#374848","#c0c9c9",.15);}
  else if(v==="juniper-ex-label") {art.rect(.015,.04,.97,.92,"#b4bcb9","#5c6966",.035);for(let n=0;n<6;n++)art.line(.15,.20+n*.10,.75,.20+n*.10,"#808d88");}
  else if(v==="juniper-ex-status")status(art,component);
  else if(v==="juniper-ex-ear") {art.rect(.01,.01,.98,.98,"#8d9896","#354946",.03);for(const y of [.12,.73])art.rect(.18,y,.63,.14,"#223a35","#bdc5c1",.04);}
  else return false;
  return true;
}

/** Draw the source's3 chassis plus4 mode lamps, or the supply's2 neutral status lamps. */
function status(art,component) {
  if(component.role==="psu0-status") {for(const x of [.25,.75])art.circle(x,.5,.20,"#6f8076","#334d40");return;}
  for(let column=0;column<2;column++)for(let row=0;row<(column?4:3);row++) {
    art.circle(.15+column*.52,.10+row*.25,.048,"#6f8076","#334d40");art.line(.23+column*.52,.10+row*.25,.43+column*.52,.10+row*.25,"#8b9a92");
  }
}

/** Draw actual hexagonal perforations, optionally restricted to the round fixed-fan exhaust boundary. */
function honeycomb(art,component,round) {
  const module=component.variant==="juniper-ex-fan-module",cols=round||module?7:Math.max(8,Math.round(component.width/5)),rows=round||module?7:2;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
    const x=(c+.5+(r%2)*.25)/(cols+.25),y=(r+.5)/rows;if(round&&((x-.5)**2+(y-.5)**2)>.235)continue;
    const rx=.44/(cols+.25),ry=.43/rows,points=[];for(let n=0;n<6;n++){const a=n*Math.PI/3;points.push([x+Math.cos(a)*rx,y+Math.sin(a)*ry]);}art.polygon(points,"#233d36","#7c8e86");
  }
}

/** Trace the EX3400 fan module's perforated guard, crossed braces, center AIR OUT label and extraction tabs. */
function fanModule(art,component) {
  art.rect(.01,.01,.98,.98,"#a2aeaa","#4b6259",.035);honeycomb(art,component,false);
  for(const [x1,y1,x2,y2] of [[.08,.10,.90,.89],[.90,.10,.08,.89]])art.line(x1,y1,x2,y2,"#c6cecb");
  art.rect(.25,.39,.50,.23,"#b3c4ba","#4d6558",.025);art.label("AIR OUT",.5,.51,Math.min(6,component.height*.12));
  for(const x of [.025,.865])art.rect(x,.405,.11,.19,"#72897a","#354f41",.01);
}

/** Trace the PSU fan's seven curved guard apertures from figure13, without asserting hidden rotor blade geometry. */
function psuFan(art) {
  art.rect(.015,.015,.97,.97,"#adb6b4","#566863",.025);
  for(let n=0;n<7;n++) {
    const a=n*Math.PI*2/7,points=[];
    for(let k=0;k<=6;k++) {const t=a+k*.11;points.push([.5+Math.cos(t)*.44,.5+Math.sin(t)*.44]);}
    for(let k=6;k>=0;k--) {const t=a+.15+k*.085;points.push([.5+Math.cos(t)*.29,.5+Math.sin(t)*.29]);}
    art.polygon(points,"#344c43","#718c7c");
  }
}

/** Draw both source D-shaped spare-bay grips entirely within their unchanged cover, with no inlet or fan. */
function psuCover(art) {
  art.rect(.01,.01,.98,.98,"#9caaa4","#455e51",.025);
  for(const side of [0,1]) {
    const cx=side?.94:.06,sign=side?-1:1,pts=[];
    for(let n=0;n<=16;n++){const a=-Math.PI/2+n*Math.PI/16;pts.push([cx+sign*Math.cos(a)*.23,.5+Math.sin(a)*.32]);}
    for(let n=16;n>=0;n--){const a=-Math.PI/2+n*Math.PI/16;pts.push([cx+sign*Math.cos(a)*.18,.5+Math.sin(a)*.25]);}
    art.polygon(pts,"#bac7bf","#5a7262");art.rect(side?.92:.04,.18,.04,.64,"#a6b7ac","#5a7262",.012);
  }
  art.line(.025,.10,.975,.10,"#c0cbc5");art.line(.025,.90,.975,.90,"#566c5f");
}

/** Draw a C14 inlet with its keyed upper corners and three metal blade contacts. */
function c14(art) {
  art.rect(.01,.01,.98,.98,"#8b9e94","#344e40",.035);art.polygon([[.23,.13],[.77,.13],[.91,.33],[.91,.86],[.09,.86],[.09,.33]],"#102c20","#afc1b7");
  for(const [x,y] of [[.29,.58],[.5,.36],[.71,.58]])art.rect(x-.025,y-.10,.05,.20,"#c5ced1",undefined,.003);
}

/** Rotate the EX3400 PSU's C14 keyed outline and contacts into its documented portrait orientation. */
function c14Portrait(art) {
  art.rect(.01,.01,.98,.98,"#8b9e94","#344e40",.035);art.polygon([[.87,.23],[.87,.77],[.67,.91],[.14,.91],[.14,.09],[.67,.09]],"#102c20","#afc1b7");
  for(const [x,y] of [[.42,.29],[.64,.5],[.42,.71]])art.rect(x-.10,y-.025,.20,.05,"#c5ced1",undefined,.003);
}
