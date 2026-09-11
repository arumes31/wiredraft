/** Dispatch only the selected CyberPower/Vertiv parts and their actual input socket shapes. */
export function addRemainingUPSComponent(art,component) {
  const variant=component.variant||component.kind;
  if(variant==="pr1500-front")addCyberFront(art,component);
  else if(variant==="gxt5-front")addVertivFront(art,component);
  else if(variant==="pr1500-nema15")addNemaOutlet(art,component);
  else if(variant==="gxt5-c13")addC13(art);
  else if(variant==="gxt5-c14")addC14(art);
  else if(variant==="cyberpower-captive-input")addCaptiveCord(art);
  else if(variant==="pr1500-fan")addFan(art,component);
  else if(variant==="gxt5-hex-vent")addHexGrille(art,14,8);
  else if(variant==="ups-usb-b")addUSBMonitor(art);
  else if(variant==="ups-breaker") {art.circle(.5,.5,.44,"#909c9e","#15262b");art.circle(.5,.5,.31,"#263238","#b2bbbd");}
  else if(variant==="gxt5-terminal")addTerminals(art);
  else if(variant==="gxt5-ebc")addBatteryConnector(art);
  else if(variant==="rdu101-status-indicator")art.rect(.04,.05,.92,.90,"#6b757a","#293d46",.01);
  else return false;
  return true;
}

/** Draw unequal NEMA5-15R blade slots and a separate ground aperture, with critical outlets in grey. */
function addNemaOutlet(art,component) {
  art.rect(.025,.025,.95,.95,component.critical?"#acb3b5":"#222b2e","#101c21",.11);
  art.rect(.14,.13,.72,.75,component.critical?"#939ea1":"#344044","#111e23",.10);
  art.rect(.32,.25,.075,.26,"#05090b",undefined,.006);art.rect(.62,.29,.065,.20,"#05090b",undefined,.006);
  art.circle(.51,.70,.086,"#05090b");
}

/** Draw the C13's three female receptacle apertures rather than a generic power-symbol icon. */
function addC13(art) {
  art.rect(.015,.025,.97,.95,"#abb5b8","#172a32",.055);
  art.polygon([[.18,.14],[.82,.14],[.91,.29],[.87,.82],[.13,.82],[.09,.29]],"#333e42","#0e1d23");
  for(const [x,y] of [[.26,.36],[.49,.48],[.72,.36]])art.rect(x-.027,y-.055,.054,.23,"#05090b",undefined,.004);
}

/** Draw the vertically mounted C14 input with three horizontal metal blades. */
function addC14(art) {
  art.polygon([[.18,.04],[.83,.04],[.97,.18],[.97,.82],[.83,.97],[.18,.97],[.03,.82],[.03,.18]],"#909da3","#13262e");
  art.polygon([[.25,.14],[.78,.14],[.87,.25],[.87,.76],[.76,.88],[.24,.88],[.13,.76],[.13,.26]],"#17272d","#657981");
  for(const [x,y] of [[.59,.30],[.43,.50],[.59,.70]])art.rect(x-.105,y-.023,.21,.046,"#d0d6d8",undefined,.002);
}

/** Depict the fixed input cord's rear grommet and cable tail without inventing an IEC inlet. */
function addCaptiveCord(art) {
  art.circle(.42,.34,.28,"#151c20","#8b979d");art.circle(.42,.34,.15,"#090f13","#404c52");
  art.polygon([[.34,.31],[.49,.31],[.55,.56],[.91,.74],[.86,.91],[.43,.69]],"#111b20","#58676d");
}

/** Trace the PR1500 slatted bezel and right-side LCD/control cluster, with the screen blank and LEDs inactive. */
function addCyberFront(art,component) {
  art.rect(.002,.01,.996,.98,"#171e22","#647176",.020);
  for(const [start,width,count] of [[.012,.422,6],[.451,.13,2],[.851,.137,2]]) {
    art.rect(start,.055,width,.89,"#090f12","#455258",.012);
    for(let col=0;col<count;col++)for(let row=0;row<11;row++)art.rect(start+.006+col*width/count,.085+row*.073,width/count-.012,.034,"#566065","#0e191e",.003);
  }
  art.rect(.598,.066,.173,.867,"#10181c","#5e6b70",.014);art.rect(.616,.205,.137,.586,"#0b171b","#51666e",.011);
  art.label("CyberPower",.684,.143,Math.min(8,component.height*.070));
  art.circle(.807,.282,.066,"#17272c","#819399");art.circle(.807,.282,.037,"#273c42","#627d86");
  art.circle(.807,.765,.086,"#969fa3","#0c2029");art.label("SELECT",.807,.586,Math.min(6,component.height*.047));
  for(const x of [.006,.994])for(const y of [.11,.88])art.circle(x,y,.015,"#080f12","#707c81");
}

/** Draw the GXT5 diamond grille, central-right control module and rack handles in its horizontal orientation. */
function addVertivFront(art,component) {
  art.rect(.002,.01,.996,.98,"#232e34","#6b7b81",.018);
  for(const [left,width,columns] of [[.026,.586,29],[.828,.145,7]])for(let row=0;row<11;row++)for(let col=0;col<columns;col++) {
    const x=left+col*width/columns,y=.055+row*.08;
    art.polygon([[x+.004,y+.035],[x+.010,y],[x+.016,y+.035],[x+.010,y+.071]],"#0b151a","#48565c");
  }
  art.rect(.105,.36,.069,.27,"#9ca8ad","#22353f",.012);art.label("VERTIV",.140,.505,Math.min(7,component.height*.052));
  art.rect(.627,.145,.188,.718,"#151f25","#627680",.016);art.rect(.665,.29,.112,.43,"#0b171b","#526d77",.008);
  for(let n=0;n<4;n++)art.circle(.647,.309+n*.123,.022,"#71848c","#122934");
  art.circle(.794,.316,.014,"#425953","#1b2f33");art.circle(.794,.403,.014,"#645d48","#283237");
  art.circle(.794,.721,.034,"#61757e","#112832");
  for(const x of [.008,.982]) {art.rect(x,.24,.012,.49,"#111f25","#59747e",.005);art.rect(x,.26,.005,.45,"#ac4d22",undefined,.002);}
}

/** Draw the one rotor visible on the CyberPower rear, clipped within its square guard. */
function addFan(art,component) {
  art.rect(.025,.025,.95,.95,"#202d33","#8b999e",.025);
  const radius=Math.min(component.width*.43,component.height*.43)/Math.min(component.width,component.height);
  art.circle(.5,.5,radius,"#0b191f","#71858e");
  for(let n=0;n<7;n++) {
    const a=n*Math.PI*2/7;art.polygon([[.5,.5],[.5+Math.cos(a)*.38,.5+Math.sin(a)*.38],[.5+Math.cos(a+.58)*.35,.5+Math.sin(a+.58)*.35]],"#657881","#243b47");
  }
  art.circle(.5,.5,.14,"#536974","#172d38");
  for(const y of [.12,.3,.5,.7,.88])art.line(.085,y,.915,y,"#a1adb1");
}

/** Render only hexagonal ventilation holes; the GXT5 source rear does not expose a fan rotor. */
function addHexGrille(art,columns,rows) {
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const w=.94/columns,h=.90/rows,x=.02+col*w+(row%2)*w*.28,y=.04+row*h;
    art.polygon([[x+w*.18,y],[x+w*.65,y],[x+w*.83,y+h*.45],[x+w*.65,y+h*.9],[x+w*.18,y+h*.9],[x,y+h*.45]],"#102229","#708087");
  }
}

/** Draw the bevelled USB-B monitoring receptacle, kept outside the logical port inventory. */
function addUSBMonitor(art) {
  art.rect(.015,.015,.97,.97,"#99a8ad","#233e49",.02);
  art.polygon([[.17,.12],[.82,.12],[.91,.29],[.91,.87],[.09,.87],[.09,.29]],"#122c37","#708690");
  art.rect(.32,.34,.36,.34,"#526c79","#102b38",.006);
}

/** Depict the distinct three-column dry-contact block and its paired terminal apertures. */
function addTerminals(art) {
  art.rect(.01,.01,.98,.98,"#aab8b8","#203d46",.02);
  for(let col=0;col<3;col++)for(let row=0;row<3;row++)art.rect(.07+col*.31,.10+row*.28,.21,.18,"#173641","#6c8c98",.004);
}

/** Trace the external battery connector's three stacked contacts and adjoining latch bosses, without an attached cabinet. */
function addBatteryConnector(art) {
  art.rect(.02,.025,.96,.95,"#94a6ad","#183642",.025);
  for(let row=0;row<3;row++) {art.rect(.12,.09+row*.29,.34,.23,"#172f39","#577480",.012);art.circle(.76,.20+row*.29,.091,"#4a6774","#19333f");}
}
