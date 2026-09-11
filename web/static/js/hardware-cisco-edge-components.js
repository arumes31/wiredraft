/** Draw only source-specific compact Cisco hardware in the common Canvas/SVG primitive pipeline. */
export function addCiscoEdgeHardware(art,component){
  const variant=component.variant;if(!variant?.startsWith("edge-"))return false;
  if(variant==="edge-wlc-vent"){perforations(art,component,.01,.02,.98,.96,Math.max(3,Math.round(component.width/4)),false);return true;}
  if(variant==="edge-wlc-rear"){
    art.rect(.003,.03,.994,.94,"#acb8be","#637781",.018);
    perforations(art,component,.06,.18,.88,.56,50,true);
    art.rect(.09,.42,.04,.09,"#172b36","#6f858c",.03);
    // The documented input has six contacts and a centered upper latch, not a barrel jack or IEC inlet.
    art.polygon([[.877,.41],[.907,.41],[.907,.55],[.925,.55],[.925,.83],[.858,.83],[.858,.55],[.877,.55]],"#1d3038","#718890");
    for(let row=0;row<2;row++)for(let col=0;col<3;col++)art.rect(.864+col*.019,.58+row*.115,.013,.085,"#68828b","#b8c5c7",.002);
    for(const x of [.03,.964])art.circle(x,.49,.045,"#bac6ca","#657c87");
    art.label("12V DC",.897,.91,5);return true;
  }
  if(variant==="edge-isr-power"){
    art.circle(.10,.20,.10,"#bcc7ca","#758892");art.line(.05,.20,.15,.20,"#657f8e");art.line(.10,.13,.10,.27,"#657f8e");
    art.circle(.36,.50,.055,"#1e333d","#80969f");art.circle(.61,.50,.14,"#172d36","#82969c");
    art.polygon([[.80,.18],[.88,.18],[.88,.30],[.95,.30],[.95,.95],[.74,.95],[.74,.30],[.80,.30]],"#23373f","#8fa3a8");
    for(let row=0;row<2;row++)for(let col=0;col<2;col++)art.rect(.776+col*.084,.41+row*.255,.045,.13,"#92a29c","#c5ceca",.004);
    return true;
  }
  if(variant==="edge-isr-lock"){art.rect(.04,.09,.92,.82,"#a4b2b5","#697e87",.25);art.rect(.20,.25,.60,.50,"#23353d",undefined,.15);return true;}
  if(variant==="edge-isr-bezel"){
    art.rect(.003,.035,.994,.93,"#b5bec2","#667e87",.025);art.rect(.012,.08,.976,.81,"#c1c8ca","#819299",.02);
    art.label("ISR 1100 Series",.085,.20,7);art.label("CISCO",.505,.60,10);
    for(let i=0;i<9;i++){const height=[.08,.17,.24,.13,.30,.13,.24,.17,.08][i];art.rect(.461+i*.011,.43-height,.005,height,"#647f8d",undefined,.002);}
    // The shared bezel retains dormant option indicators on the selected non-radio base SKU.
    for(let i=0;i<6;i++)art.circle(.083+i*.025,.60,.024,i<2?"#486e72":"#77898d","#8d9da2");
    for(const [label,x]of [["STATUS",.083],["VPN",.108]])art.label(label,x,.80,4);
    return true;
  }
  return false;
}

/** Draw isotropic circular or hexagonal perforations wholly within a measured vent region. */
function perforations(art,component,x,y,width,height,columns,hex){
  const dx=width/columns,rx=dx*.31,ry=rx*component.width/component.height,dy=ry*2.5;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns-row%2;col++){
    const cx=x+(col+.5+row%2*.5)*dx,cy=y+(row+.5)*dy;
    if(hex)art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#263e4b","#71868f");
    else art.circle(cx,cy,rx*component.width/Math.min(component.width,component.height),"#304852","#657c86");
  }
}
