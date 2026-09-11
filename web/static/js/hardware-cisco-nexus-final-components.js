/** Draw only the selected7009 source-specific service hardware with shared Canvas/SVG primitives. */
export function addCiscoNexusFinalHardware(art,component){
  const variant=component.variant;if(typeof variant!=="string"||!variant.startsWith("nexus-final-"))return false;
  if(variant==="nexus-final-strip"){art.rect(0,0,1,1,"#708994","#afbdc2",.001);if(component.label)art.label(component.label,.58,.5,5);return true;}
  if(variant==="nexus-final-ejector"){art.rect(.05,.03,.90,.94,"#a9bcc5","#475e6c",.03);art.polygon([[.15,.20],[.82,.05],[.85,.67],[.55,.95],[.20,.80]],"#687f89","#c3d0d1");return true;}
  if(variant==="nexus-final-blank"){
    art.rect(.004,.03,.992,.94,"#8199a7","#b0c2ca",.015);art.line(.06,.84,.94,.84,"#4c6979");for(const x of [.023,.977])art.circle(x,.5,.07,"#b7c8ce","#415a6b");art.label(component.label,.5,.48,5);return true;
  }
  if(variant==="nexus-final-hood"){
    art.rect(.005,.05,.99,.80,"#637f91","#adc1c8",.02);art.line(.03,.94,.97,.94,"#405d70",2);art.label(component.label,.65,.48,6);for(const x of [.12,.16,.20])art.circle(x,.45,.06,"#86a190","#324e60");return true;
  }
  if(variant==="nexus-final-cable-frame"){
    art.rect(.22,.01,.56,.98,"#657e8e","#b5c5cc",.02);for(let i=0;i<9;i++){const y=.025+i*.105;art.rect(.06,y,.88,.018,"#b5c7cb","#425d6d",.01);art.line(.13,y+.018,.13,y+.078,"#b5c7cb",2);}return true;
  }
  if(variant==="nexus-final-intake"){
    art.rect(.004,.005,.992,.99,"#7f97a4","#a9bdc6",.01);mesh(art,component,.035,.055,.93,.88,38);art.rect(.497,.09,.006,.81,"#b6c6ce",undefined,.001);return true;
  }
  if(variant==="nexus-final-fabric"){
    art.rect(.004,.02,.992,.96,"#7795a8","#b6c5cd",.025);art.rect(.09,.17,.76,.52,"#597d96","#aec2cc",.02);
    art.line(.10,.82,.82,.82,"#b9c8d1",2);art.line(.10,.55,.10,.82,"#b9c8d1",2);art.line(.82,.55,.82,.82,"#b9c8d1",2);
    art.circle(.94,.32,.047,"#b7c5ca","#405f74");art.circle(.94,.75,.02,"#619473","#38586b");art.label(component.label,.47,.38,5);return true;
  }
  if(variant==="nexus-final-fan-cover"){
    art.rect(.005,.005,.99,.99,"#7b97a8","#c2cfd4",.008);art.rect(.12,.40,.69,.14,"#64869c","#aac0cb",.02);art.label(component.label,.46,.47,6);
    art.line(.89,.35,.94,.35,"#c7d2d6",3);art.line(.94,.35,.94,.56,"#c7d2d6",3);art.line(.89,.56,.94,.56,"#c7d2d6",3);
    for(const x of [.03,.31,.60,.96])for(const y of [.016,.98])art.circle(x,y,.005,"#b7c9d1","#355468");art.rect(.86,.025,.105,.04,"#bbc8cf","#4a6478",.005);return true;
  }
  if(variant==="nexus-final-6kw"){
    art.rect(.008,.015,.984,.97,"#8ba0ab","#3b586b",.025);mesh(art,component,.16,.07,.42,.34,10);mesh(art,component,.16,.57,.42,.32,10);
    art.circle(.085,.16,.06,"#aebdc7","#314e63");art.line(.085,.12,.085,.18,"#294c63");
    for(const y of [.12,.60]){art.rect(.72,y,.20,.27,"#1c3548","#bfd0d4",.018);for(const [x,dy]of [[.81,.055],[.77,.18],[.855,.18]])art.rect(x,y+dy,.034,.025,"#c8d5d6",undefined,.001);}
    art.rect(.05,.445,.59,.055,"#aebfc7","#3f5e70",.02);art.line(.05,.39,.05,.51,"#d2dcde",2);art.line(.64,.39,.64,.51,"#d2dcde",2);
    for(const y of [.57,.67,.77])art.circle(.075,y,.018,"#80a18d","#405e71");art.label(component.label,.41,.945,5);return true;
  }
  return false;
}

/** Draw physical perforations without asserting any hidden rotor population. */
function mesh(art,component,x,y,width,height,columns){
  const dx=width/columns,rx=dx*.31,ry=rx*component.width/component.height,dy=ry*2.6;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns;col++){
    const cx=x+(col+.5)*dx,cy=y+(row+.5)*dy;
    art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#253f53","#a5bac5");
  }
}
