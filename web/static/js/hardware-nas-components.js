/** Dispatch only the NAS variants traced from the RS3621RPxs and TS-873AeU-RP manufacturer hardware guides. */
export function addNASComponent(art,component,colors) {
  const variant=component.variant;
  if(variant==="synology-r7")addR7Tray(art);
  else if(variant==="qnap-ts873aeu")addQNAPTray(art);
  else if(variant==="synology-delta-500w"||variant==="qnap-300w-rp")addNASSupply(art,component,variant==="synology-delta-500w");
  else if(variant==="synology-infiniband")addInfiniband(art);
  else if(variant==="qnap-60mm")addQNAPFan(art);
  else if(variant==="synology-square-grid") {
    const {columns,rows}=component;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)art.rect((col+.10)/columns,(row+.10)/rows,.80/columns,.80/rows,"#111d22",undefined,0);
  }
  else if(variant==="qnap-perforated"||variant==="qnap-brand-grille") {
    art.rect(.01,.025,.98,.95,"#c0c7c9",colors.ink,.015);
    addPerforations(art,.04,variant==="qnap-brand-grille"?.48:.07,.92,variant==="qnap-brand-grille"?.40:.85,14,variant==="qnap-brand-grille"?2:12);
    if(variant==="qnap-brand-grille")art.label("QNAP",.82,.26,7);
  } else if(variant==="synology-pcie-cover") {
    art.rect(.08,.025,.84,.95,"#79868b",colors.ink,.01);
    for(let i=0;i<19;i++)art.rect(.19,.08+i*.045,.62,.023,"#17262d",undefined,0);
  } else if(variant==="qnap-pcie-cover") {
    art.rect(.02,.04,.96,.92,"#bcc5c8",colors.ink,.01);art.rect(.12,.15,.81,.65,"#9faeb3",colors.ink,.01);
    art.circle(.06,.50,.085,"#687980",colors.ink);
  } else return false;
  return true;
}

/** Draw Type R7's black latch, sliding lock, broad recessed handle and three central horizontal slots without implying an installed disk. */
function addR7Tray(art) {
  art.rect(.01,.025,.98,.95,"#20272b","#0a151a",.035);
  art.rect(.045,.12,.905,.71,"#343c41","#0a151a",.025);
  art.rect(.075,.27,.125,.31,"#141f23","#687579",.035);
  art.rect(.225,.31,.070,.21,"#10191d","#536267",.025);
  art.rect(.247,.335,.018,.16,"#5d686d",undefined,.005);
  art.rect(.33,.19,.55,.56,"#151d21","#435155",.015);
  for(let i=0;i<3;i++)art.rect(.355,.25+i*.14,.32,.070,"#030b0e",undefined,.006);
  art.rect(.716,.24,.12,.46,"#394348",undefined,.02);
  art.rect(.045,.86,.035,.045,"#315246",undefined,.005);
}

/** Draw QNAP's silver perforated tray face, narrow left release strip and two inactive right-edge disk indicators. */
function addQNAPTray(art) {
  art.rect(.01,.025,.98,.95,"#c0c7c9","#203239",.012);
  art.rect(.04,.055,.045,.87,"#9ca9ae","#52666d",.01);
  addPerforations(art,.12,.15,.68,.72,12,4);
  art.rect(.86,.10,.075,.80,"#a6b4b8","#51666e",.01);
  for(const y of [.27,.57])art.rect(.881,y,.030,.105,"#315246",undefined,.005);
}

/** Draw staggered small ventilation holes inside the given normalized rectangle. */
function addPerforations(art,x,y,width,height,columns,rows) {
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const cx=x+(col+.35+(row%2)*.3)*width/columns,cy=y+(row+.4)*height/rows;
    art.rect(cx,cy,width/columns*.44,height/rows*.23,"#53666d",undefined,.1);
  }
}

/** Draw the photographed redundant supply orientation, keyed three-blade inlet, circular fan guard and manufacturer-specific release hardware. */
function addNASSupply(art,component,synology) {
  art.rect(.015,.025,.97,.95,"#b8c3c7","#1a2b32",.015);
  const fx=synology?.70:.31,cx=synology?.27:.735;
  const radius=Math.min(component.width*.235,component.height*.37),rx=radius/component.width,ry=radius/component.height;
  art.circle(fx,.49,radius/Math.min(component.width,component.height),"#122126","#657a83");
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2;
    art.line(fx+Math.cos(a)*rx*.25,.49+Math.sin(a)*ry*.25,fx+Math.cos(a+.45)*rx*.95,.49+Math.sin(a+.45)*ry*.95,"#a9b6bb");
  }
  art.circle(fx,.49,.11,"#9caaaf","#485f68");
  art.rect(cx-.12,.17,.24,.64,"#17242a","#72858c",.035);
  art.polygon([[cx-.085,.24],[cx+.07,.24],[cx+.10,.32],[cx+.10,.68],[cx+.065,.74],[cx-.085,.74],[cx-.10,.68],[cx-.10,.32]],"#061014","#526870");
  for(const [x,y] of [[cx-.05,.36],[cx-.05,.62],[cx+.055,.49]])art.rect(x-.014,y-.018,.028,.036,"#d0d6d8",undefined,.002);
  if(synology) {
    art.rect(.025,.55,.07,.32,"#28a897","#1d706a",.02);
    art.rect(.49,.055,.42,.07,"#132128","#65777e",.04);
    art.line(.16,.73,.16,.92,"#768e96");art.line(.16,.92,.42,.92,"#768e96");art.line(.42,.92,.42,.73,"#768e96");
  } else {
    art.line(.54,.08,.54,.92,"#82989f");art.line(.54,.08,.91,.08,"#82989f");art.line(.54,.92,.91,.92,"#82989f");
    art.rect(.92,.17,.045,.61,"#ced6d8","#6f858d",.02);
    art.circle(.925,.84,.022,"#315246");
  }
}

/** Draw the wide keyed Synology storage-expansion receptacle and two retaining screws, without borrowing an Ethernet connector shape. */
function addInfiniband(art) {
  art.rect(.04,.22,.92,.58,"#adbcc2","#263c46",.13);
  art.polygon([[.20,.32],[.79,.32],[.85,.43],[.82,.68],[.17,.68],[.14,.43]],"#071418","#536b75");
  art.rect(.23,.44,.53,.085,"#677e87",undefined,.004);
  for(const x of [.09,.91])art.circle(x,.50,.07,"#1b3039","#c0cbcf");
}

/** Draw the three stamped circular rear fan guards from QNAP's RP diagram with concentric guard wires and corner screws. */
function addQNAPFan(art) {
  art.rect(.015,.025,.97,.95,"#afbec3","#667d87",.10);
  for(const r of [.45,.36,.27])art.circle(.5,.5,r,undefined,"#546d77");
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    art.line(.5+Math.cos(a)*.18,.5+Math.sin(a)*.18,.5+Math.cos(a)*.46,.5+Math.sin(a)*.46,"#647e88");
  }
  art.circle(.5,.5,.15,"#8b9da4","#506973");
  for(const x of [.08,.92])for(const y of [.08,.92])art.circle(x,y,.034,"#b9c6cc","#425b65");
}
