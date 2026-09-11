/** Dispatch source-traced FAS8300 hardware without changing shared parts used by other models. */
export function addNetAppComponent(art,component,colors) {
  if(component.variant==="fas8300-fan-module")addFanModule(art);
  else if(component.variant==="fas8300-1600w-platinum")addSupply(art,component);
  else if(component.variant==="fas8300-slot-cover")addSlotCover(art,component);
  else if(component.variant==="fas8300-sas") {
    art.rect(.025,.025,.95,.95,"#a7b4b7",colors.ink,.035);art.rect(.14,.16,.72,.65,"#172b32","#6b8189",.025);
    for(let row=0;row<2;row++)for(let n=0;n<6;n++)art.rect(.20+n*.095,.30+row*.27,.035,.13,"#a49b63",undefined,.005);
  } else return false;
  return true;
}

/** Draw the front fan's opaque cover and closed cam handle rather than inventing a visible circular rotor. */
function addFanModule(art) {
  art.rect(.015,.02,.97,.96,"#a8b6bd","#334d59",.018);
  art.rect(.075,.08,.86,.79,"#91a3ae","#526c79",.016);
  art.line(.09,.16,.09,.80,"#d2dade");art.line(.12,.80,.84,.80,"#506c7a");
  art.polygon([[.035,.67],[.09,.73],[.15,.89],[.91,.89],[.95,.79],[.97,.75],[.97,.96],[.10,.96],[.04,.82]],"#5f7784","#273f4c");
  art.rect(.72,.049,.10,.066,"#7197ad","#365b70",.014);
  art.circle(.877,.079,.015,"#4d665c","#253f4b");
  art.rect(.12,.71,.065,.024,"#5d7786",undefined,.005);
}

/** Trace the original Platinum AC module: visible rotor, black three-blade C14 inlet, folded handle and blue locking tab. */
function addSupply(art,component) {
  art.rect(.01,.01,.98,.98,"#aab9c1","#2a4350",.02);
  art.rect(.04,.07,.51,.84,"#1d3039","#7a8f9b",.025);
  const radius=Math.min(component.width*.24,component.height*.39)/Math.min(component.width,component.height);
  art.circle(.295,.48,radius,"#13262f","#91a7b2");
  for(let n=0;n<7;n++) {
    const a=n*Math.PI*2/7,points=[[.295,.48],[.295+Math.cos(a)*.23,.48+Math.sin(a)*.39],[.295+Math.cos(a+.5)*.20,.48+Math.sin(a+.5)*.33]];
    art.polygon(points,"#718995","#3a535f");
  }
  art.circle(.295,.48,.135,"#9aaeb9","#3d5967");
  art.polygon([[.62,.12],[.86,.12],[.91,.19],[.91,.69],[.85,.76],[.63,.76],[.58,.69],[.58,.19]],"#132833","#66808d");
  for(const [x,y] of [[.67,.29],[.80,.44],[.67,.59]])art.rect(x-.022,y-.011,.044,.022,"#d0d6d8",undefined,.002);
  art.rect(.84,.67,.052,.28,"#72b0d0","#3c6e85",.014);
  art.line(.91,.18,.96,.18,"#e0e4e6");art.line(.96,.18,.96,.94,"#e0e4e6");art.line(.96,.94,.89,.94,"#e0e4e6");
  for(const [x,y] of [[.055,.05],[.53,.05],[.055,.93],[.53,.93]])art.circle(x,y,.019,"#8a9ea9","#47616e");
}

/** Draw each individually numbered perforated PCIe blank in the manufacturer's one-plus-two-plus-two slot arrangement. */
function addSlotCover(art,component) {
  art.rect(.01,.015,.98,.96,"#aebbc2","#4b626d",.02);art.line(.035,.19,.965,.19,"#d4dce1");
  for(let row=0;row<2;row++)for(let col=0;col<16;col++) {
    const x=.16+col*.040,y=.37+row*.20;
    art.polygon([[x,y+.04],[x+.016,y],[x+.032,y+.04],[x+.032,y+.12],[x+.016,y+.16],[x,y+.12]],"#273d46",undefined);
  }
  art.label(component.text||"",.065,.57,Math.min(7,component.height*.25));
}
