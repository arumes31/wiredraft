/** Draw inspected Meraki modular supplies, fan handles, covers and proprietary stack fittings in both renderers. */
export function addMerakiAdvancedHardware(art,component){
  const variant=component.variant||component.kind;if(typeof variant!=="string"||!variant.startsWith("meraki-advanced-"))return false;
  if(variant==="meraki-advanced-grille"){honeycomb(art,component,.02,.08,.96,.84,Math.max(22,Math.ceil(component.width/component.height*3)));return true;}
  if(variant==="meraki-advanced-module-rail"){art.rect(.01,.1,.98,.8,"#8e999c","#42545a",.05);for(let i=0;i<12;i++)art.rect(.035+i*.08,.18,.045,.62,"#23353b",undefined,.01);return true;}
  art.rect(.015,.025,.97,.95,"#bfc6c6","#3d4d52",.015);
  if(variant==="meraki-advanced-stack"){
    art.rect(.06,.12,.88,.76,"#55686e","#d6dddd",.035);
    for(let i=0;i<3;i++){art.rect(.13,.16+i*.245,.74,.10,"#202d33","#9aa6a7",.01);art.rect(.12,.28+i*.245,.76,.07,"#cad0cf","#586b70",.01);}
    for(const y of [.06,.94])art.circle(.5,y,.035,"#cbd0cf","#344951");return true;
  }
  if(variant==="meraki-advanced-id-panel"){art.rect(.05,.08,.90,.80,"#e4e8e4","#98a3a4",.025);for(let i=0;i<16;i++)art.rect(.08+i*.051,.29,.020,.29,"#516468",undefined,0);return true;}
  if(variant==="meraki-advanced-psu-cover"){
    art.rect(.11,.09,.77,.78,"#d1d5d2","#65787d",.04);for(const x of [.04,.92])art.rect(x,.11,.045,.73,"#9ca9a9","#546a71",.012);
    for(let i=0;i<9;i++)art.rect(.22+i*.063,.23+Math.abs(4-i)*.025,.020,.22-Math.abs(4-i)*.025,"#8a979a",undefined,.008);return true;
  }
  if(variant==="meraki-advanced-fan"){
    art.circle(.5,.5,.44,"#2b3a40","#d2d9d5");honeycomb(art,component,.045,.06,.91,.87,6);
    for(const x of [.08,.84])art.rect(x,.13,.075,.74,"#96a6a6","#3b5159",.02);
    art.rect(.08,.40,.84,.23,"#6c8589","#31434b",.04);art.rect(.24,.43,.52,.16,"#b9c6c3","#587077",.03);
    for(const [x,y]of [[.07,.07],[.91,.07],[.07,.91],[.91,.91]])art.circle(x,y,.025,"#dde1dc","#65757a");return true;
  }
  if(variant==="meraki-advanced-stackpower"){
    art.rect(.12,.06,.77,.88,"#253a42","#a5b0b0",.02);
    for(const y of [.20,.61]){art.rect(.24,y,.48,.19,"#b4bfbc","#233b43",.012);art.rect(.34,y+.04,.15,.10,"#182c32",undefined,.005);}
    art.rect(.77,.24,.10,.54,"#829391","#273e49",.01);return true;
  }
  if(variant==="meraki-advanced-640w"||variant==="meraki-advanced-715w"){
    honeycomb(art,component,.025,.06,.57,.76,12);
    art.polygon([[.61,.22],[.65,.15],[.89,.15],[.94,.23],[.94,.68],[.61,.68]],"#18292f","#9caeae");
    for(const [x,y]of [[.775,.29],[.70,.51],[.85,.51]])art.rect(x-.014,y-.045,.028,.09,"#c8ceca",undefined,.002);
    // The MS250/MS350 source specifies a C15 cable, whose matching C16 inlet has the lower heat-key notch.
    if(variant==="meraki-advanced-640w")art.rect(.759,.60,.032,.09,"#bfc6c6",undefined,0);
    art.rect(.12,.86,.80,.05,"#c4cdca","#526b73",.01);art.rect(.46,.72,.10,.18,"#6a8281","#384d55",.01);art.rect(.89,.32,.085,.16,"#819391","#3e515a",.005);return true;
  }
  return false;
}

/** Keep source honeycomb cells isotropic and entirely inside each normalized component rectangle. */
function honeycomb(art,component,x,y,width,height,columns){
  const dx=width/columns,rx=dx*.39,ry=rx*component.width/component.height,dy=ry*2.05;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns-row%2;col++){
    const cx=x+(col+.5+row%2*.5)*dx,cy=y+(row+.5)*dy;art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#283a40","#839594");
  }
}
