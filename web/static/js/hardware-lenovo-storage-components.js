const metal="#aeb3b5",edge="#697174",black="#222629",orange="#d97430",green="#52683e";

/** Draw only the individually traced Lenovo storage and IBM tape assemblies. */
export function addLenovoStorageComponent(input,c) {
 if(typeof c.variant!=="string"||!c.variant.startsWith("lenovo-storage-"))return false;
 const art=c.inverted?invertedArt(input):input,v=c.variant;
 if(v==="lenovo-storage-housing") {art.rect(.006,.025,.988,.95,metal,edge,.012);art.label(c.label,.12,.10,5.5);}
 else if(v==="lenovo-storage-de-sff")deCarrier(art);
 else if(v==="lenovo-storage-d-sff")dCarrier(art,false);
 else if(v==="lenovo-storage-d-lff")dCarrier(art,true);
 else if(v==="lenovo-storage-front-status") {
  art.rect(.035,.01,.93,.98,black);
  for(let i=0;i<3;i++)art.rect(.26,.11+i*.10,.32,.062,i?"#768281":green);
  art.rect(.12,.49,.76,.18,"#758a73");art.label("00",.50,.58,5.5);
 } else if(v==="lenovo-storage-right-bezel") {
  art.rect(.025,.015,.95,.97,black);art.rect(.20,.06,.62,.30,"#0f1416");
  for(let i=0;i<5;i++)art.rect(.25,.62+i*.032,.50,.010,"#a1a7a6");
 } else if(v==="lenovo-storage-de-psu")dePower(art);
 else if(v==="lenovo-storage-d-psu")dPower(art);
 else if(v==="lenovo-storage-orange-latch")art.polygon([[.025,.075],[.90,.31],[.97,.87],[.025,.92]],orange);
 else if(v==="lenovo-storage-hic-cover") {
  art.rect(.018,.10,.964,.80,"#969fa2",edge);screw(art,.13,.50,.18);screw(art,.87,.50,.18);
 } else if(v==="lenovo-storage-controller-leds") {
  for(let n=0;n<3;n++)art.circle(.17+n*.33,.51,.11,n?green:"#9ba6a8");
 } else if(v==="lenovo-storage-esm-handle") {
  art.rect(.02,.06,.96,.86,"#262d31",edge,.05);art.rect(.46,.18,.36,.62,orange);
 } else if(v==="lenovo-storage-proprietary-service") {
  art.rect(.10,.05,.80,.90,"#34434b",edge);art.circle(.50,.21,.18,"#727f85");
 } else if(v==="lenovo-storage-tape-left"||v==="lenovo-storage-tape-ear") {
  art.rect(.03,.025,.94,.95,black,edge);screw(art,.23,.78,.10);
  if(v.endsWith("left"))art.rect(.38,.73,.38,.12,"#afb5b5");
 } else if(v==="lenovo-storage-tape-magazine") {
  art.rect(.003,.01,.994,.98,black,edge);mesh(art,.02,.04,.96,.92,30,7);
  art.rect(.26,.25,.45,.57,"#242a2e",edge,.05);art.rect(.28,.32,.41,.09,"#696f71");
  art.polygon([[.30,.41],[.69,.41],[.70,.72],[.29,.72]],"#41474b",edge);
 } else if(v==="lenovo-storage-tape-operator")tapeOperator(art);
 else if(v==="lenovo-storage-tape-cover") {
  art.rect(.005,.025,.99,.95,metal,edge);for(const x of [.04,.50,.96])screw(art,x,.20,.040);
 } else if(v==="lenovo-storage-recess-edge")art.rect(.01,.05,.98,.90,"#7d878b");
 else if(v==="lenovo-storage-tape-psu") {
  art.rect(.006,.025,.988,.95,metal,edge);mesh(art,.56,.08,.39,.80,12,5);
  inlet(art,.04,.16,.19,.64);rocker(art,.37,.38,.10,.38);
 } else if(v==="lenovo-storage-screw-hole")art.circle(.5,.5,.25,"#192127");
 else return false;
 return true;
}

/** Rotate a physical module180degrees without rotating printed application text. */
function invertedArt(art) {
 return {rect:(x,y,w,h,...rest)=>art.rect(1-x-w,1-y-h,w,h,...rest),circle:(x,y,...rest)=>art.circle(1-x,1-y,...rest),
  line:(x,y,a,b,...rest)=>art.line(1-x,1-y,1-a,1-b,...rest),polygon:(points,...rest)=>art.polygon(points.map(([x,y])=>[1-x,1-y]),...rest),
  label:(text,x,y,...rest)=>art.label(text,1-x,1-y,...rest)};
}

/** Place a captive screw using the renderer's minimum-axis circle convention. */
function screw(art,x,y,r) {art.circle(x,y,r,"#b9bfc0",edge);art.circle(x,y,r*.30,"#535f64");}

/** Trace bounded small perforations; fan blades are intentionally hidden behind the grille. */
function mesh(art,x,y,w,h,columns,rows) {
 for(let r=0;r<rows;r++)for(let c=0;c<columns;c++)art.rect(x+(c+.18)*w/columns,y+(r+.15)*h/rows,w/columns*.60,h/rows*.62,"#192024");
}

/** Draw the rounded DE SFF handle, center honeycomb opening and lower release inset. */
function deCarrier(art) {
 art.rect(.045,.008,.91,.984,"#34383a",edge,.13);art.rect(.14,.05,.70,.21,"#484d4f",edge,.10);
 screw(art,.68,.12,.11);mesh(art,.16,.35,.67,.25,3,7);art.rect(.33,.70,.33,.19,"#1d2325",edge,.04);
 art.rect(.21,.94,.12,.023,green);
}

/** Trace D-series red latch strips, perforated handle and indicators in their SFF/LFF orientations. */
function dCarrier(art,lff) {
 art.rect(.028,.028,.944,.944,"#222628",edge,.015);
 if(lff) {
  art.rect(.045,.045,.008,.91,"#864e4d");mesh(art,.22,.17,.44,.53,10,4);
  art.polygon([[.23,.74],[.62,.74],[.66,.84],[.22,.84]],"#b3b9ba");art.circle(.91,.14,.032,green);art.circle(.91,.86,.022,"#87918d");
 } else {
  art.rect(.31,.085,.40,.013,"#a45550");art.rect(.22,.15,.56,.12,"#363d40",edge);
  mesh(art,.19,.36,.62,.35,3,9);art.rect(.20,.78,.64,.032,"#858c8f");art.circle(.69,.925,.063,green);
 }
}

/** Draw a C14 input with the chamfered opening and three rectangular blade contacts. */
function inlet(art,x,y,w,h) {
 art.polygon([[x+w*.19,y],[x+w*.81,y],[x+w,y+h*.20],[x+w,y+h*.82],[x+w*.81,y+h],[x+w*.19,y+h],[x,y+h*.82],[x,y+h*.20]],"#171d21",edge);
 for(const [a,b] of [[.28,.27],[.67,.27],[.48,.66]])art.rect(x+w*a,y+h*b,w*.11,h*.20,"#aab3b7");
}

/** Draw the source's physical rocker with an unfilled O ring that Canvas and SVG interpret identically. */
function rocker(art,x,y,w,h) {
 art.rect(x,y,w,h,"#454b4f",edge,.03);art.rect(x+w*.44,y+h*.17,w*.12,h*.19,"#c5cdcc");
 art.circle(x+w*.5,y+h*.68,Math.min(w,h)*.16,undefined,"#c5cdcc");
}

/** Trace a913W DE power/fan canister: two grille fields, center warning strip and right inlet/rocker. */
function dePower(art) {
 art.rect(.005,.018,.99,.963,metal,edge,.035);mesh(art,.035,.06,.29,.77,10,5);mesh(art,.49,.06,.29,.77,10,5);
 art.rect(.334,.06,.14,.77,"#4d5458");screw(art,.395,.135,.075);
 for(const [x,y]of [[.35,.39],[.42,.39],[.35,.59],[.42,.59]])art.polygon([[x,y+.10],[x+.028,y],[x+.054,y+.10]],"#a99b51");
 rocker(art,.802,.26,.065,.48);inlet(art,.90,.15,.079,.65);
 art.rect(.39,.86,.21,.063,orange);art.rect(.015,.925,.96,.02,"#495357");
}

/** Trace one580W D-series PCM, including its tall grille, vertical handle and stacked status/AC controls. */
function dPower(art) {
 art.rect(.015,.008,.97,.984,metal,edge,.035);mesh(art,.27,.06,.51,.89,13,12);
 art.rect(.815,.285,.12,.48,"#646c6d",edge,.035);art.rect(.835,.35,.077,.34,"#373f42");
 for(let n=0;n<4;n++)art.circle(.082+(n%2)*.077,.105+Math.floor(n/2)*.09,.034,n?green:"#8e9d8d");
 rocker(art,.055,.32,.18,.145);inlet(art,.055,.53,.18,.29);
 for(const y of [.045,.82]){art.rect(.815,y,.14,.11,"#6595b0");art.rect(.829,y+.016,.11,.025,"#c5cbd0");}
}

/** Draw the16-character LCD, four arrow keys, four status lights and emergency magazine release. */
function tapeOperator(art) {
 art.rect(.005,.015,.99,.97,black,edge);art.circle(.035,.16,.020,"#86918f");art.line(.035,.29,.035,.83,"#7e8787");
 art.rect(.12,.24,.51,.40,"#72837a","#a2ada4");
 for(let n=0;n<4;n++)art.circle(.15+n*.14,.115,.028,"#82958a");
 for(const [x,y]of [[.70,.20],[.83,.20],[.70,.60],[.83,.60]]){art.circle(x,y,.070,"#676f72",edge);art.circle(x,y,.035,"#20282b");}
 art.rect(.16,.80,.64,.035,"#969f9c");
}
