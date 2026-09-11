/** Render only the exact PA-3410's documented mesh, drive cover and AC supply details. */
export function addPA3410Hardware(art,component) {
  if(component.variant==="pa3410-mesh")addMesh(art,component);
  else if(component.variant==="pa3410-drive-cover")addDriveCover(art);
  else if(component.variant==="pa3410-ac")addSupply(art);
  else return false;
  return true;
}

/** Cut staggered hexagonal apertures whose aspect stays regular at either rendering width. */
function addMesh(art,component) {
  const radius=Math.min(2.2,component.height*.17,component.width*.1);
  const dx=radius*1.8,dy=radius*1.65;
  for(let row=0,y=radius+1;y+radius<component.height;row++,y+=dy) {
    for(let x=radius+1+(row%2)*dx/2;x+radius<component.width;x+=dx) {
      art.polygon(Array.from({length:6},(_,i)=>[(x+radius*Math.cos(i*Math.PI/3))/component.width,(y+radius*Math.sin(i*Math.PI/3))/component.height]),"#14232a");
    }
  }
}

/** Trace the covered SSD's two diagonal vent columns and captive screw. */
function addDriveCover(art) {
  art.rect(.025,.025,.95,.95,"#c0c5c5","#617076",.015);
  for(const col of [.25,.65])for(let i=0;i<7;i++)art.polygon([[col,.22+i*.064],[col+.08,.25+i*.064],[col+.08,.29+i*.064],[col,.26+i*.064]],"#18272d");
  art.circle(.85,.50,.052,"#acb5b7","#46585e");art.line(.825,.50,.875,.50,"#46585e");
}

/** Draw an AC C14 inlet with earth above live/neutral and a side release handle. */
function addSupply(art) {
  art.rect(.02,.025,.96,.95,"#b2babb","#526268",.02);
  art.rect(.027,.05,.946,.90,"#a6afb1","#506167",.025);
  for(const y of [.105,.835])for(let i=0;i<5;i++)art.rect(.070+i*.137,y,.102,.052,"#152229");
  art.rect(.075,.23,.69,.53,"#152229","#526167",.08);
  art.polygon([[.12,.34],[.22,.26],[.62,.26],[.72,.34],[.72,.69],[.12,.69]],"#081319","#73838a");
  for(const [x,y] of [[.397,.37],[.24,.49],[.554,.49]])art.rect(x,y,.044,.105,"#d0d6d8");
  art.rect(.81,.13,.070,.73,"#6c7b80","#374e58",.03);
  art.circle(.925,.35,.025,"#687b7e","#344d56");art.circle(.925,.50,.025,"#687b7e","#344d56");
  for(let i=0;i<4;i++)art.line(.78,.72+i*.046,.89,.72+i*.046,"#3c535d",.6);
}
