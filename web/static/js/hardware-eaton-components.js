/** Draw only the inspected Eaton panel, keyed power sockets and vertically installed card interfaces. */
export function addEatonComponent(art, component) {
  const variant = component.variant, kind = component.kind;
  if (kind === "eaton-c14" || variant === "eaton-c13") {
    art.rect(.035, .025, .93, .95, "#626e72", "#172126", .04);
    art.polygon([[.16,.13],[.67,.13],[.86,.29],[.86,.71],[.67,.87],[.16,.87]], "#111c20", "#a2afb1");
    for (const [x,y] of [[.36,.29],[.66,.5],[.36,.71]]) art.rect(x-.085,y-.027,.17,.054,kind === "eaton-c14" ? "#bcc7c7" : "#020608",undefined,.004);
  } else if (kind === "eaton-rj45") {
    art.rect(.03,.03,.94,.94,"#aab6b7","#20353d",.02);
    art.polygon([[.13,.15],[.69,.15],[.69,.34],[.85,.34],[.85,.66],[.69,.66],[.69,.85],[.13,.85]],"#071216");
    for(let i=0;i<8;i++)art.rect(.16,.22+i*.075,.12,.028,"#bbaa70",undefined,.002);
  } else if (kind === "eaton-micro") {
    art.polygon([[.13,.12],[.66,.12],[.86,.26],[.86,.74],[.66,.88],[.13,.88]],"#16252b","#a5b4b8");
    art.rect(.42,.22,.16,.56,"#819294",undefined,.003);
  } else if (kind === "eaton-db9") {
    art.rect(.045,.025,.91,.95,"#899b9f","#26383e",.025);
    art.polygon([[.20,.19],[.69,.15],[.86,.26],[.86,.74],[.69,.85],[.20,.81]],"#203036","#ced7d7");
    for(let row=0;row<5;row++)art.circle(.40,.25+row*.12,.036,"#b5c1c4");
    for(let row=0;row<4;row++)art.circle(.66,.31+row*.12,.036,"#b5c1c4");
    for(const y of [.075,.925])art.circle(.50,y,.055,"#ccd4d3","#34474c");
  } else if (variant === "eaton-bezel") {
    art.rect(.005,.01,.99,.98,"#151d21","#728086",.025);
    art.rect(.02,.035,.75,.93,"#a3adb0","#475b61",.008);
    perforations(art,component,.034,.055,.72,.89,72,true);
    art.rect(.085,.45,.07,.25,"#c4cbca","#6c7f84",.014);art.label("EATON",.12,.58,6);
  } else if (variant === "eaton-display") {
    art.rect(.02,.025,.96,.95,"#141e23","#526269",.025);
    art.rect(.07,.19,.86,.53,"#1d2b31","#54686e",.015);
    for(const x of [.12,.38,.86])art.circle(x,.10,.025,"#48575b");
    for(let i=0;i<5;i++)art.rect(.06+i*.18,.77,.16,.13,"#334349","#66797e",.010);
    art.rect(.07,.93,.86,.025,"#27596c",undefined,.004);
  } else if (variant === "eaton-mesh") {
    perforations(art,component,.015,.015,.97,.97,23);
  } else if (variant === "eaton-strip") {
    art.rect(.03,.03,.94,.94,"#78878a",undefined,.002);
  } else if (variant === "eaton-usb-a") {
    art.rect(.025,.04,.95,.92,"#9cabad","#26383f",.012);art.rect(.12,.20,.76,.60,"#09161b");art.rect(.17,.26,.63,.15,"#bec8c7");
  } else if (variant === "eaton-usb-b") {
    art.rect(.04,.03,.92,.94,"#aeb9bc","#26383f",.012);art.polygon([[.28,.16],[.72,.16],[.85,.32],[.85,.83],[.15,.83],[.15,.32]],"#122129");art.rect(.35,.43,.30,.22,"#8da0a6");
  } else if (variant === "eaton-button") {
    art.circle(.5,.5,.42,"#56666c","#85989e");
  } else if (variant === "eaton-terminal") {
    art.rect(.045,.035,.91,.93,"#688478","#213f36",.012);
    for(let i=0;i<3;i++){art.rect(.17,.10+i*.28,.62,.20,"#1b2e29");art.circle(.48,.20+i*.28,.05,"#a1b1ac");}
  } else if (variant === "eaton-battery") {
    art.rect(.03,.025,.94,.95,"#89999c","#263a42",.025);
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){art.rect(.12+col*.40,.10+row*.28,.32,.22,"#17272e","#bcc8c8",.005);art.rect(.23+col*.40,.14+row*.28,.09,.14,"#7e9399");}
  } else return false;
  return true;
}

/** Keep front and rear perforations isotropic inside their bounded sheet-metal regions. */
function perforations(art, component, x, y, width, height, columns, round = false) {
  const dx=width/columns,dy=dx*component.width/component.height;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns-(round?row%2:0);col++) {
    if(round)art.circle(x+(col+.5+row%2*.5)*dx,y+(row+.5)*dy,Math.max(dx,dy)*.28,"#162328");
    else art.rect(x+col*dx,y+row*dy,dx*.55,dy*.55,"#162328",undefined,.003);
  }
}
