/** Dispatch only source-traced PowerStore and ME5 parts; leave all other manufacturers to the shared renderer. */
export function addDellStorageComponent(art,component,colors) {
  const face=component.inverted?turnArt(art):art,v=component.variant;
  if(["powerstore-tlc","powerstore-nvram"].includes(v))addPowerStoreCarrier(face,v);
  else if(v==="me5-sff")addME5Carrier(face);
  else if(v==="powerstore-2100w")addPowerStoreSupply(face,component);
  else if(v==="me5-580w")addME5Supply(face);
  else if(v==="powerstore-io-cover") {
    face.rect(.015,.03,.97,.94,"#899a9f",colors.ink,.015);
    for(let row=0;row<3;row++)for(let col=0;col<12;col++)face.rect(.04+col*.077,.16+row*.21,.050,.11,"#17262b",undefined,.006);
    face.rect(.90,.68,.050,.16,"#cc6b32",undefined,.008);
  } else if(v==="powerstore-unused-serial") {
    face.rect(.01,.025,.98,.95,"#bfa929",colors.ink,.01);
    face.rect(.05,.48,.23,.24,"#263c44","#84969e",.06);
    face.polygon([[.40,.24],[.90,.24],[.83,.70],[.47,.70]],"#aab9bf","#4f6770");
    for(let n=0;n<9;n++)face.circle(.48+(n%5)*.075,n<5?.38:.53,.024,"#183139");
  } else if(v==="me5-sas-expansion") {
    face.rect(.06,.025,.88,.95,"#a2b1b7",colors.ink,.025);face.rect(.15,.13,.70,.73,"#11252d","#5f7a87",.025);
    for(let row=0;row<2;row++)face.rect(.23,.32+row*.28,.54,.055,"#899da7",undefined,.004);
  } else if(v==="me5-controller-handle") {
    face.rect(.015,.08,.97,.84,"#b1bfc5","#3c5560",.15);face.line(.39,.08,.39,.92,"#748b96");
  } else return false;
  return true;
}

/** Apply180degree artwork rotation in normalized coordinates, matching inverted nodes and PCMs without altering scene primitives. */
function turnArt(art) {
  return {rect:(x,y,w,h,...rest)=>art.rect(1-x-w,1-y-h,w,h,...rest),circle:(x,y,...rest)=>art.circle(1-x,1-y,...rest),
    line:(x1,y1,x2,y2,...rest)=>art.line(1-x1,1-y1,1-x2,1-y2,...rest),polygon:(points,...rest)=>art.polygon(points.map(([x,y])=>[1-x,1-y]),...rest),
    label:(text,x,y,...rest)=>art.label(text,1-x,1-y,...rest)};
}

/** Draw PowerStore's narrow metal latch carrier with its orange TLC release or yellow NVRAM warning latch. */
function addPowerStoreCarrier(art,variant) {
  art.rect(.03,.01,.94,.98,"#14252d","#07171e",.015);
  art.polygon([[.16,.02],[.80,.02],[.89,.09],[.81,.74],[.69,.87],[.22,.87],[.13,.73]],"#a9b8bf","#4a626e");
  art.rect(.26,.16,.40,.55,"#263e49","#0c222c",.015);
  for(let n=0;n<6;n++)art.rect(.32,.21+n*.072,.22,.022,"#9eb0b9",undefined,.005);
  const nvram=variant==="powerstore-nvram";
  art.rect(.17,.76,.64,.15,nvram?"#b4a739":"#c66d37","#774d35",.015);
  if(nvram) {art.rect(.35,.10,.29,.07,"#c7b13d",undefined,.005);art.rect(.18,.84,.64,.095,"#4f5140",undefined,.006);}
  for(const x of [.30,.62])art.circle(x,.955,.044,"#294c5b");
}

/** Draw ME5's taller curved release handle, four paired hexagonal vent groups and lower locking block. */
function addME5Carrier(art) {
  art.rect(.025,.015,.95,.97,"#a6b6bf","#253f4c",.025);
  art.polygon([[.13,.18],[.23,.10],[.74,.10],[.87,.18],[.82,.25],[.17,.25]],"#7e949f","#3e5c6a");
  art.rect(.15,.30,.69,.43,"#1d3540","#718b97",.02);
  for(let row=0;row<4;row++)for(let col=0;col<2;col++) {
    const x=.20+col*.30,y=.33+row*.092;
    art.polygon([[x+.025,y],[x+.19,y],[x+.23,y+.035],[x+.19,y+.070],[x+.025,y+.070],[x-.01,y+.035]],"#334f5c","#9bafb8");
  }
  art.rect(.22,.81,.54,.11,"#687f8b","#354f5b",.025);
  art.rect(.29,.83,.39,.07,"#c0cbd1",undefined,.01);
  for(const x of [.29,.57])art.rect(x,.20,.14,.033,"#365362",undefined,.005);
}

/** Trace the2100W PowerStore supply's square fan cage, black pull handle, orange latch and rectangular C20 inlet. */
function addPowerStoreSupply(art,component) {
  art.rect(.01,.025,.98,.95,"#a9b8be","#263d47",.015);
  const radius=Math.min(component.width*.215,component.height*.38);
  art.circle(.275,.49,radius/Math.min(component.width,component.height),"#132a35","#b7c5cc");
  for(let n=0;n<4;n++) {const a=n*Math.PI/2;art.line(.275+Math.cos(a)*.055,.49+Math.sin(a)*.13,.275+Math.cos(a+.3)*.20,.49+Math.sin(a+.3)*.35,"#8098a4");}
  art.rect(.08,.68,.39,.075,"#172933","#65808d",.035);art.circle(.275,.49,.10,"#4d6876","#8099a5");
  art.rect(.60,.16,.25,.65,"#162c36","#637f8e",.025);art.rect(.635,.22,.18,.53,"#06171f",undefined,.02);
  for(const [x,y] of [[.685,.33],[.685,.63],[.77,.48]])art.rect(x-.012,y-.027,.024,.054,"#d0d6d8",undefined,.002);
  art.rect(.86,.63,.064,.28,"#d27839","#975325",.035);
  art.line(.60,.07,.95,.07,"#b9c7cf");art.line(.95,.07,.95,.89,"#b9c7cf");art.line(.95,.89,.63,.89,"#b9c7cf");
  for(let n=0;n<3;n++)art.circle(.885,.25+n*.115,.027,n?"#6e6445":"#315447");
}

/** Trace the580W PCM's full-height honeycomb grille, left LEDs/switch/C14 and right orange release latch; cooling fans remain behind the grille. */
function addME5Supply(art) {
  art.rect(.01,.015,.98,.97,"#a6b7bf","#294450",.015);
  for(let row=0;row<15;row++)for(let col=0;col<7;col++) {
    const x=.32+col*.061+(row%2)*.023,y=.07+row*.057;
    art.polygon([[x,y+.01],[x+.024,y],[x+.049,y+.01],[x+.049,y+.035],[x+.024,y+.048],[x,y+.035]],"#344e5b","#92a9b4");
  }
  for(const x of [.095,.20])for(const y of [.11,.21])art.circle(x,y,.028,"#495e5c","#233e4b");
  art.rect(.055,.34,.22,.135,"#263d46","#677e89",.015);art.rect(.085,.365,.145,.079,"#92a4ac",undefined,.01);
  art.line(.12,.383,.12,.414,"#27404d");art.line(.17,.40,.205,.40,"#27404d");
  art.polygon([[.05,.59],[.09,.55],[.24,.55],[.28,.60],[.28,.87],[.24,.91],[.09,.91],[.05,.86]],"#172d38","#6e8794");
  for(const [x,y] of [[.108,.66],[.108,.81],[.216,.74]])art.rect(x-.019,y-.010,.038,.020,"#d0d6d8",undefined,.002);
  art.rect(.81,.06,.14,.21,"#536f7f","#2c4958",.01);art.rect(.81,.73,.14,.21,"#536f7f","#2c4958",.01);
  art.rect(.84,.34,.09,.31,"#ced9df","#6a8594",.02);art.rect(.85,.39,.024,.20,"#cf783b",undefined,.015);
}
