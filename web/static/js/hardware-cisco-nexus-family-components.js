/** Render only the selected Nexus3064/5548 visible hardware through common Canvas/SVG primitives. */
export function addCiscoNexusFamilyHardware(art,component){
  const variant=component.variant;if(!variant?.startsWith("nexus-"))return false;
  if(variant==="nexus-disabled-link"){
    const upper=component.label==="L1";
    art.rect(.01,.01,.98,.98,"#778c98","#304c5d",.035);art.rect(.10,.12,.80,.70,"#253e4c","#627e8d",.018);
    art.rect(.32,upper?.02:.74,.36,.18,"#253e4c",undefined,.018);for(let i=0;i<8;i++)art.line(.19+i*.085,upper?.68:.19,.19+i*.085,upper?.81:.32,"#7b897d");
    art.label(component.label,.5,.60,4);return true;
  }
  if(variant==="nexus-gem-cover"){
    art.rect(.004,.025,.992,.95,"#7e949e","#385563",.035);art.rect(.08,.19,.84,.48,"#8fa2aa","#5d7886",.04);
    for(const x of [.035,.965]){art.circle(x,.49,.065,"#bac6c9","#476777");art.line(x-.008,.45,x+.008,.53,"#466575");}
    art.label(component.label,.5,.84,6);return true;
  }
  if(variant==="nexus-3064-fan"||variant==="nexus-5548-fan"){
    art.rect(.004,.02,.992,.96,"#738c99","#324f60",.025);
    hexGrille(art,component,.12,.12,.74,.72,variant==="nexus-3064-fan"?38:20);
    art.line(.055,.20,.055,.76,"#c0cccf",2);art.line(.055,.20,.10,.20,"#c0cccf",2);art.line(.055,.76,.10,.76,"#c0cccf",2);
    art.circle(.92,.74,.050,"#b6c4c9","#4c6e80");art.circle(.92,.43,.025,"#819d7e","#bdd0c1");
    art.label(component.label,.48,.93,4.5);return true;
  }
  if(variant==="nexus-3064-psu"||variant==="nexus-5548-psu"){
    const wide=variant==="nexus-3064-psu",left=wide?.66:.57,right=wide?.87:.84;
    art.rect(.004,.02,.992,.96,"#728a98","#304e60",.025);
    hexGrille(art,component,.055,.12,wide?.48:.40,.61,wide?14:6);
    // The portrait IEC inlet is beside the grille, with a vertical extraction handle and release latch.
    art.polygon([[left,.19],[right-.05,.19],[right,.30],[right,.68],[right-.05,.79],[left,.79]],"#203845","#c2cccf");
    for(const [x,y]of [[right-.085,.46],[left+.035,.29],[left+.035,.63]])art.rect(x,y,.045,.035,"#c8d1cf","#718997",.003);
    art.line(left-.05,.20,left-.05,.81,"#c4d0d1",2);art.line(left-.05,.20,left+.015,.20,"#c4d0d1",2);art.line(left-.05,.81,left+.015,.81,"#c4d0d1",2);
    art.rect(.916,.48,.052,.30,"#72948c","#b8c9c7",.03);
    for(const y of [.77,.86])art.circle(.05,y,.021,y===.77?"#98866d":"#738f76","#b9c4bd");
    art.label(component.label,.42,.93,4.5);return true;
  }
  return false;
}

/** Draw isotropic honeycomb perforations inside the source grille while leaving hidden fan counts unspecified. */
function hexGrille(art,component,x,y,width,height,columns){
  const dx=width/columns,rx=dx*.34,ry=rx*component.width/component.height,dy=ry*2.4;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns-row%2;col++){
    const cx=x+(col+.5+row%2*.5)*dx,cy=y+(row+.5)*dy;
    art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#203a49","#92a3ac");
  }
}
