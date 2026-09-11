/** Dispatch only physical details belonging to the three documented legacy EdgeMAX SKUs. */
export function addUbiquitiLegacyComponent(art,component) {
  const v=component.variant||component.kind;
  if(v==="ubiquiti-legacy-guard")addFanGuard(art);
  else if(v==="ubiquiti-legacy-perforations")addPerforations(art,component);
  else if(v==="ubiquiti-legacy-ear")addEar(art);
  else if(v==="ubiquiti-legacy-c14")addC14(art);
  else if(v==="ubiquiti-er8-c6")addC6(art);
  else if(v==="ubiquiti-er12-dc")addBarrel(art);
  else if(v==="ubiquiti-legacy-led")art.circle(.5,.5,.30,"#6b777a","#39464a");
  else if(v==="ubiquiti-legacy-legend")addLegend(art);
  else return false;
  return true;
}

/** Draw a printed three-state link/PoE legend as neutral bars, never as a socket or active status indicator. */
function addLegend(art) {
  for(let n=0;n<3;n++) {art.rect(.05,.08+n*.30,.28,.18,"#7b8586",undefined,.002);art.line(.46,.17+n*.30,.92,.17+n*.30,"#a8b1b2");}
}

/** Draw three interrupted annular vent rings from the source fan guard, without guessing hidden rotor blades. */
function addFanGuard(art) {
  for(const radius of [.20,.32,.44])for(let segment=0;segment<4;segment++) {
    const start=segment*Math.PI/2+.12,end=start+Math.PI/2-.25,points=[];
    for(let step=0;step<=8;step++) {const a=start+(end-start)*step/8;points.push([.5+Math.cos(a)*radius,.5+Math.sin(a)*radius]);}
    for(let step=8;step>=0;step--) {const a=start+(end-start)*step/8;points.push([.5+Math.cos(a)*(radius-.055),.5+Math.sin(a)*(radius-.055)]);}
    art.polygon(points,"#10252e","#243944");
  }
  for(const [x,y] of [[.055,.055],[.945,.945]]) {art.circle(x,y,.034,"#617780","#233d49");art.line(x-.018,y-.018,x+.018,y+.018,"#213a45");}
}

/** Trace rows of small rear ventilation holes with aspect-correct circular apertures. */
function addPerforations(art,component) {
  const columns=Math.max(5,Math.round(component.width/5)),rows=6;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)art.circle((col+.5)/columns,(row+.5)/rows,.030,"#15313b");
}

/** Draw an actual narrow rack ear with upper/lower mounting slots, rather than a generic handle. */
function addEar(art) {
  art.rect(.005,.01,.99,.98,"#35464d","#1b333e",.06);
  for(const y of [.08,.77])art.rect(.17,y,.66,.16,"#0c1d25","#84979f",.065);
}

/** Draw the rectangular three-blade C14 inlet on the ES-16 rear panel. */
function addC14(art) {
  art.rect(.015,.02,.97,.96,"#536b77","#1c3441",.025);
  art.polygon([[.22,.14],[.78,.14],[.91,.34],[.91,.83],[.09,.83],[.09,.34]],"#102530","#7f939c");
  for(const [x,y] of [[.29,.52],[.50,.35],[.71,.52]])art.rect(x-.025,y-.10,.050,.20,"#c5ced1",undefined,.003);
}

/** Trace the ER-8 datasheet's C6 cloverleaf inlet with three recessed round pins and the C5 cord interface. */
function addC6(art) {
  art.rect(.015,.025,.97,.95,"#46545c","#172e38",.02);art.rect(.09,.13,.82,.75,"#202d34","#70818a",.03);
  for(const [x,y] of [[.50,.36],[.28,.61],[.72,.61]])art.circle(x,y,.193,"#0d2029","#314953");
  for(const [x,y] of [[.50,.36],[.28,.61],[.72,.61]])art.circle(x,y,.040,"#c5ced1");
}

/** Draw the ER-12's green-edged DC barrel jack and its single center contact. */
function addBarrel(art) {
  art.rect(.025,.025,.95,.95,"#306a50","#1c3c38",.02);art.circle(.5,.5,.38,"#173029","#658779");
  art.circle(.5,.5,.25,"#081f1c","#102e28");art.circle(.5,.5,.07,"#c5ced1");
}
