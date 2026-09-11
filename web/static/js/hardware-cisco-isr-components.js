/** Render source-specific ISR4331/4431 cooling, covers and power hardware through shared Canvas/SVG primitives. */
export function addCiscoISRHardware(art,component){
  const variant=component.variant;if(!variant?.startsWith("isr-"))return false;
  if(variant==="isr-hex-vent"){hexVent(art,component);return true;}
  if(variant==="isr-4431-vent"){
    for(let col=0;col<12;col++){art.rect(.015+col*.081,.04,.045,.87,"#172c35","#536c76",.35);for(let row=0;row<3;row++)art.line(.017+col*.081,.26+row*.20,.057+col*.081,.26+row*.20,"#536b75");}
    return true;
  }
  if(variant==="isr-switch"){art.rect(.03,.02,.94,.96,"#9daeb5","#546c78",.06);art.rect(.17,.16,.66,.68,"#263d48","#a1b2b8",.13);art.line(.48,.23,.48,.37,"#a8babf");return true;}
  if(variant==="isr-ground"){for(const y of [.22,.77]){art.circle(.5,y,.18,"#aab9bf","#526d7c");art.line(.36,y,.64,y,"#496776");}return true;}
  if(variant==="isr-nim-cover"||variant==="isr-sm-cover"){
    art.rect(.003,.01,.994,.98,"#748a96","#384e5c",.018);
    const columns=variant==="isr-sm-cover"?17:9;
    for(let row=0;row<3;row++)for(let col=0;col<columns;col++)art.rect(.07+col*.86/columns,.11+row*.23,.64/columns,.115,"#263e4b","#94a5ac",.20);
    for(const x of [.035,.965]){art.circle(x,.50,.045,"#a9b8be","#3c5869");art.line(x-.013,.50,x+.013,.50,"#345569");}
    art.label(component.label,.50,.89,5);return true;
  }
  if(variant==="isr-status-4331"||variant==="isr-status-4431"){
    const labels=variant==="isr-status-4331"?["POE0","FLASH","TEMP","PWR","SSD","ISC","FAN","STAT"]:["PSU0","PSU1","GE","FLASH","TEMP","PWR","POE0","POE1","BOOST","ISC","FAN","STAT"];
    const columns=labels.length/2;
    art.rect(.01,.01,.98,.98,"#263d48","#8296a0",.35);
    for(const [i,label]of labels.entries()){const x=(i%columns+.5)/columns,y=i<columns?.35:.75;art.circle(x,y,.025,"#9facaa","#bbc6c5");art.label(label,x,y-.17,3.3);}
    return true;
  }
  if(variant==="isr-4431-psu"){
    art.rect(.005,.015,.99,.97,"#536e7c","#243d4b",.025);
    // Each selected supply has its own visible left fan, middle release latch and right C14 inlet.
    const cx=.22,cy=.49,radius=Math.min(.37*component.height,.20*component.width),r=radius/Math.min(component.width,component.height);
    art.circle(cx,cy,r,"#1d3540","#8296a1");
    for(let i=0;i<8;i++){const a=i*Math.PI/4,dx=radius*.81/component.width,dy=radius*.81/component.height;art.line(cx+dx*.38*Math.cos(a),cy+dy*.38*Math.sin(a),cx+dx*Math.cos(a),cy+dy*Math.sin(a),"#758c99");}
    art.circle(cx,cy,.10,"#526c7b","#9aaab1");art.rect(.47,.19,.055,.57,"#9babaf","#536d7a",.02);
    art.line(.535,.32,.585,.32,"#bed0d1",2);art.line(.585,.32,.585,.79,"#bed0d1",2);
    art.polygon([[.70,.19],[.91,.19],[.955,.34],[.955,.76],[.655,.76],[.655,.34]],"#172b35","#a0afb5");
    for(const [x,y]of [[.797,.31],[.721,.51],[.873,.51]])art.rect(x,y,.027,.13,"#bdc7c5","#6c828b",.004);
    art.label(component.label,.74,.90,5);return true;
  }
  return false;
}

/** Keep honeycomb openings isotropic and fully inside each measured source vent rectangle. */
function hexVent(art,component){
  const columns=Math.max(5,Math.round(component.width/7)),dx=.98/columns,rx=dx*.32,ry=rx*component.width/component.height,dy=ry*2.4;
  for(let row=0;row<Math.floor(.96/dy);row++)for(let col=0;col<columns-row%2;col++){
    const cx=.01+(col+.5+row%2*.5)*dx,cy=.02+(row+.5)*dy;
    art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#1e3744","#7f939e");
  }
}
