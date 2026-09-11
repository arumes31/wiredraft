/** Dispatch only artwork traced from the selected EX4400/EX4600 primary hardware diagrams. */
export function addJuniperEXCoreComponent(art,c) {
  const v=c.variant||c.kind;
  if(v==="juniper-ex-core-c16-portrait")inlet(art,true);
  else if(v==="juniper-ex-core-c14-portrait")inlet(art,false);
  else if(v==="juniper-ex-core-mesh")mesh(art,c);
  else if(v==="juniper-ex-core-fan4400")fan4400(art,c);
  else if(v==="juniper-ex-core-fan4600")fan4600(art,c);
  else if(v==="juniper-ex-core-psu4400")psu4400(art,c);
  else if(v==="juniper-ex-core-psu4600-grille") {for(let y=0;y<2;y++)for(let x=0;x<3;x++)art.rect(.04+x*.32,.03+y*.48,.27,.42,"#23302c","#86948d",.015);}
  else if(v==="juniper-ex-core-cover4400") {art.rect(.01,.01,.98,.98,"#3d4843","#7c8981",.025);art.circle(.50,.50,.09,"#8b9690","#263b2e");art.circle(.50,.50,.06,"#526258","#a2b0a7");}
  else if(v==="juniper-ex-core-expansion-cover")expansionCover(art,c);
  else if(v==="juniper-ex-core-solid") {art.rect(.01,.01,.98,.98,"#3d4843","#687b6b",.025);for(const x of [.05,.95])for(const y of [.10,.85])art.circle(x,y,.023,"#7d8c81","#28382e");}
  else if(v==="juniper-ex-core-status8")status(art,4,2);
  else if(v==="juniper-ex-core-status4")status(art,4,1);
  else if(v==="juniper-ex-core-status3")status(art,3,1);
  else if(v==="juniper-ex-core-status1")status(art,1,1);
  else if(v==="juniper-ex-core-label") {art.rect(.01,.01,.98,.98,"#7e8d82","#435b48",.01);for(let y=0;y<4;y++)art.line(.16,.18+y*.20,.84,.18+y*.20,"#3c5343");}
  else if(v==="juniper-ex-core-edge")art.rect(.01,.01,.98,.98,"#88948c","#2c3e32",.01);
  else if(v==="juniper-ex-core-latch") {art.rect(.05,.01,.90,.98,"#ba7040","#59422d",.06);art.line(.50,.13,.50,.85,"#d39b66");}
  else if(v==="juniper-ex-core-ear") {art.rect(.01,.01,.98,.98,"#4b5850","#7f9283",.025);for(const y of [.09,.77])art.rect(.17,y,.66,.14,"#1d3024","#8fa294",.04);art.circle(.50,.50,.10,"#657b69","#1c3823");}
  else return false;
  return true;
}

/** Draw the selected PSU's keyed portrait inlet, distinct blade direction and EX4600 retention clip. */
function inlet(art,highTemperature) {
  art.rect(.01,.01,.98,.98,"#68776e","#233b2b",.025);
  const points=highTemperature?[[.13,.10],[.64,.10],[.87,.25],[.87,.75],[.64,.90],[.13,.90],[.13,.58],[.32,.58],[.32,.42],[.13,.42]]:
    [[.13,.25],[.35,.10],[.88,.10],[.88,.90],[.35,.90],[.13,.75]];
  art.polygon(points,"#17271d","#a5b6aa");
  for(const [x,y] of highTemperature?[[.43,.27],[.66,.50],[.43,.73]]:[[.66,.27],[.42,.50],[.66,.73]])art.rect(x-.09,y-.025,.18,.05,"#c5ced1",undefined,.003);
  if(!highTemperature) {
    const outer=[],inner=[];for(let n=0;n<=20;n++){const a=Math.PI*.75+n*Math.PI*1.50/20;outer.push([.53+Math.cos(a)*.35,.47+Math.sin(a)*.29]);inner.unshift([.53+Math.cos(a)*.28,.47+Math.sin(a)*.23]);}
    art.polygon([...outer,...inner],"#9faea4","#566e5e");art.rect(.68,.61,.22,.08,"#a7b6ab","#536958",.01);
  }
}

/** Fill the source ventilation regions with hexagonal apertures whose aspect follows the component's real dimensions. */
function mesh(art,c) {
  const cols=Math.max(4,Math.round(c.width/5)),rows=Math.max(1,Math.round(c.height/5));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
    const x=(col+.5+(row%2)*.2)/(cols+.2),y=(row+.5)/rows,pts=[];
    for(let n=0;n<6;n++){const a=n*Math.PI/3;pts.push([x+Math.cos(a)*.42/(cols+.2),y+Math.sin(a)*.42/rows]);}art.polygon(pts,"#15291d","#65796b");
  }
}

/** Draw inactive status indicators with source legend strokes, never asserted operating states. */
function status(art,rows,cols) {
  for(let col=0;col<cols;col++)for(let row=0;row<rows;row++) {
    const x=(col+.25)/cols,y=(row+.5)/rows;art.circle(x,y,.055,"#637b69","#233d2b");art.line(x+.12/cols,y,(col+.95)/cols,y,"#93a697");
  }
}

/** Trace EX4400 fan-module guard, orange frame, cross-braces and small central AIR OUT label. */
function fan4400(art,c) {
  art.rect(.01,.01,.98,.98,"#b96c3a","#65492f",.035);mesh(art,c);
  for(const reverse of [false,true])art.polygon((reverse?[[.04,.25],[.16,.25],[.90,.75],[.90,.88],[.76,.83]]:[[.96,.25],[.84,.25],[.10,.75],[.10,.88],[.24,.83]]),"#bd7c49","#795a37");
  art.rect(.26,.45,.48,.23,"#a3afa5","#645d42",.015);art.label("AIR OUT",.5,.565,Math.min(5,c.height*.1));
  for(const [x,y] of [[.12,.11],[.88,.11],[.12,.89],[.88,.89]])art.circle(x,y,.04,"#a5b2a9","#394f3f");
}

/** Trace QFX5100-FAN-AFO's X-braced honeycomb guard and opposing extraction tabs. */
function fan4600(art,c) {
  art.rect(.01,.01,.98,.98,"#aa6439","#61462e",.035);mesh(art,c);
  art.polygon([[.035,.10],[.16,.08],[.94,.85],[.93,.95],[.80,.93],[.045,.22]],"#bc7a48","#6c4a2d");
  art.polygon([[.965,.10],[.84,.08],[.06,.85],[.07,.95],[.20,.93],[.955,.22]],"#bc7a48","#6c4a2d");
  for(const x of [.035,.845])art.rect(x,.39,.12,.27,"#c18450","#6c4a2d",.02);
  art.rect(.28,.41,.44,.23,"#9fad9e","#56664e",.015);art.label("AIR OUT",.5,.525,Math.min(5,c.height*.1));
}

/** Trace the1600W PSU fan guard and its horizontal extraction handle across the center. */
function psu4400(art,c) {
  art.rect(.01,.01,.98,.98,"#7b8980","#374e3c",.025);mesh(art,c);art.circle(.50,.50,.38,"#22372a","#abb8ad");
  art.circle(.50,.50,.24,undefined,"#8fa595");for(let n=0;n<8;n++){const a=n*Math.PI/4;art.line(.5+Math.cos(a)*.25,.5+Math.sin(a)*.25,.5+Math.cos(a)*.38,.5+Math.sin(a)*.38,"#9aafa0");}
  art.rect(.04,.43,.92,.16,"#be7b46","#65492d",.06);for(const [x,y] of [[.10,.10],[.90,.10],[.10,.90],[.90,.90]])art.circle(x,y,.045,"#a5b4a9","#39523f");
}

/** Draw the actual blank expansion plate with top fasteners and narrow upper/lower vent strips. */
function expansionCover(art,c) {
  art.rect(.01,.01,.98,.98,"#44524a","#819588",.025);for(const x of [.06,.94])art.circle(x,.14,.035,"#9aada0","#2c4935");
  for(const y of [.025,.94])for(let n=0;n<12;n++)art.rect(.12+n*.063,y,.045,.04,"#182e20","#6f8977",.006);
}
