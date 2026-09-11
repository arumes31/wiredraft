const black="#252323",silver="#c1c4c3",edge="#747b7c",ink="#edefed";

/** Render only the documented FG-5060 carrier assemblies and exact 5001E blade controls. */
export function addFortinetBladeComponent(art,component) {
 const v=component.variant;
 if(v==="fortinet-blade-fan-tray")fanTray(art);
 else if(v==="fortinet-blade-pem")pem(art);
 else if(v==="fortinet-blade-blank")blank(art);
 else if(v==="fortinet-blade-service-cover") {art.rect(.012,.025,.976,.95,black,edge,.02);screw(art,.075,.55,.10);}
 else if(v==="fortinet-blade-shelf-manager")shelfManager(art);
 else if(v==="fortinet-blade-sap")alarmPanel(art);
 else if(v==="fortinet-blade-lever")lever(art,component.reverse);
 else if(v==="fortinet-blade-screw")screw(art,.5,.5,.30);
 else if(v==="fortinet-blade-edge")art.rect(.003,.15,.994,.70,edge);
 else if(v==="fortinet-blade-filter")art.rect(.20,.005,.60,.99,"#727576","#3d4242");
 else if(v==="fortinet-blade-rear-rail") {
  art.rect(.03,.005,.94,.99,silver,edge);
  for(const y of [.10,.72,.93])art.circle(.5,y,.11,"#7e8585");
 } else if(v==="fortinet-blade-ground") {
  art.rect(.12,.04,.76,.91,"#c6d2c8",edge);
  for(const y of [.24,.66])screw(art,.5,y,.14);
  art.rect(.36,.83,.28,.12,"#65a767");
 } else if(v==="fortinet-blade-esd") {
  art.circle(.5,.5,.43,silver,edge);art.circle(.5,.5,.20,"#286b48");
 } else if(v==="fortinet-blade-base-leds") {
  for(const x of [.10,.30,.68,.88])art.circle(x,.65,.08,"#7ea85e");
 } else if(v==="fortinet-blade-system-leds") {
  for(const [i,color] of ["#bd695c","#8db169","#8db169","#8db169"].entries())art.rect(.05+i*.24,.22,.10,.56,color);
 } else if(v==="fortinet-blade-controls") {
  art.circle(.12,.58,.075,"#8f9797");art.rect(.42,.33,.11,.40,"#a3aaaa");art.circle(.84,.58,.075,"#72b4c4");
 } else if(component.kind==="fortinet-blade-usb-a-vertical") {
  art.rect(.06,.03,.88,.94,silver,edge,.015);art.rect(.24,.12,.54,.76,"#222f35");art.rect(.50,.22,.12,.55,"#8a979b");
 } else return false;
 return true;
}

/** Draw the retained air-baffle cover rather than unsupported board or RTM electronics. */
function blank(art) {
 art.rect(.006,.025,.988,.95,black,edge,.045);
 screw(art,.029,.53,.15);screw(art,.971,.53,.15);
}

/** Draw one captive retention screw, with all strokes contained by its assembly. */
function screw(art,x,y,r) {
 art.circle(x,y,r,silver,"#535e61");
 // Cross lines use the art circle's minimum-axis convention without assuming a square parent.
 art.circle(x,y,r*.36,"#606b6d");
}

/** Trace the narrow tray face, closed handle/latch and indicators; its six radial fans remain internal. */
function fanTray(art) {
 art.rect(.025,.004,.95,.992,black,edge,.015);
 art.circle(.23,.078,.075,"#a2a7a6");
 for(const [i,color]of ["#7bb2c1","#c7905a","#84a56a"].entries())art.circle(.48+i*.18,.073,.035,color);
 art.rect(.36,.265,.27,.46,"#656969","#858a87",.06);
 for(const y of [.29,.70])screw(art,.5,y,.055);
 art.rect(.25,.923,.48,.048,"#d0d2cf",edge,.03);art.circle(.50,.947,.10,"#91aa77");
 for(let i=0;i<6;i++)art.circle(.86,.32+i*.114,.030,i>=4?"#bd655a":"#959f9e");
}

/** Trace PEM A/B with two independent branch rockers and exposed dual-stud RTN/-48V terminals, without selected cables. */
function pem(art) {
 art.rect(.006,.025,.988,.95,silver,edge,.018);
 art.circle(.067,.55,.11,"#919c9e");
 for(const [i,color]of ["#6cb2c4","#c88267","#92b774"].entries())art.circle(.13+i*.039,.33,.027,color);
 for(const x of [.25,.48]) {
  art.rect(x,.22,.205,.62,"#20292d",edge,.01);art.rect(x+.035,.29,.135,.47,"#626a6c","#969f9f",.005);
  art.line(x+.061,.52,x+.105,.52,"#d6ddda");art.circle(x+.141,.52,.055,undefined,"#d6ddda");
 }
 art.rect(.735,.16,.245,.71,"#20282b",edge,.01);
 for(const y of [.34,.67])for(const x of [.79,.92])screw(art,x,y,.088);
}

/** Draw a closed extraction lever and its latch in the source's mirrored end positions. */
function lever(art,reverse=false) {
 const points=[[.03,.24],[.42,.24],[.46,.07],[.70,.07],[.70,.43],[.95,.43],[.95,.73],[.55,.73],[.48,.92],[.25,.92],[.25,.56],[.03,.56]];
 art.polygon(points.map(([x,y])=>[reverse?1-x:x,y]),"#888f90","#424b4e");
}

/** Trace the primary 5000SM face including its single exposed ETH0 and small control cluster. */
function shelfManager(art) {
 art.rect(.012,.025,.976,.95,black,edge,.02);screw(art,.080,.55,.10);
 rj45(art,.25,.25,.185,.54);
 for(let row=0;row<4;row++)art.circle(.19,.28+row*.14,.025,row%2?"#8caa77":"#b09c72");
 art.circle(.51,.58,.033,"#98a2a2");
 for(const [x,color]of [[.58,"#b57461"],[.66,"#89a967"],[.74,"#78b4c4"]])art.circle(x,.42,.036,color);
 art.polygon([[.41,.83],[.82,.70],[.97,.70],[.97,.83],[.80,.83],[.41,.95]],"#777e7e","#a2aaa8");
}

/** Draw the SAP's two serial jacks, status column, reset and exact two-row fifteen-pin alarm connector. */
function alarmPanel(art) {
 art.rect(.012,.025,.976,.95,black,edge,.02);screw(art,.040,.53,.11);
 rj45(art,.12,.30,.12,.50);rj45(art,.82,.30,.12,.50);
 for(let row=0;row<3;row++)for(let col=0;col<2;col++)art.circle(.34+col*.045,.32+row*.17,.023,col?"#ba9f66":"#b97366");
 art.polygon([[.47,.37],[.69,.37],[.72,.45],[.69,.76],[.47,.76],[.44,.45]],silver,"#6d787c");
 art.polygon([[.48,.44],[.68,.44],[.69,.50],[.67,.69],[.49,.69],[.47,.50]],"#3c494e");
 for(let row=0;row<2;row++)for(let pin=0;pin<(row?7:8);pin++)art.circle(.489+pin*.024+row*.012,.50+row*.12,.008,"#b2bebd");
 art.circle(.76,.57,.045,"#7d898a");
}

/** Render the noninteractive carrier RJ45 aperture within a local fractional rectangle. */
function rj45(art,x,y,width,height) {
 art.rect(x,y,width,height,silver,"#6a7a81",.015);
 art.polygon([[x+width*.15,y+height*.15],[x+width*.85,y+height*.15],[x+width*.85,y+height*.72],[x+width*.64,y+height*.72],[x+width*.64,y+height*.90],[x+width*.36,y+height*.90],[x+width*.36,y+height*.72],[x+width*.15,y+height*.72]],"#263b47");
 for(let i=0;i<8;i++)art.line(x+width*(.25+i*.071),y+height*.24,x+width*(.25+i*.071),y+height*.42,"#b1a278");
}
