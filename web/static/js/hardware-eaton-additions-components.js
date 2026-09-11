/** Draw only Eaton's explicitly selected original rack hardware; return false for every other variant. */
export function addEatonAdditionComponent(a,c){
 const v=c.variant||c.kind;if(typeof v!=='string'||!v.startsWith('eaton-addition-'))return false;
 if(v==='eaton-addition-front'||v==='eaton-addition-rear'){a.rect(0,0,1,1,v.endsWith('front')?'#272a2d':'#454a4d','#181f23',.005);return true;}
 if(v==='eaton-addition-ear'){a.rect(.02,.01,.96,.98,'#444a4e','#12191d');for(const y of [.14,.82])a.rect(.30,y,.4,.07,'#0c1418',undefined,.03);return true;}
 if(v==='eaton-addition-blank'){a.rect(.005,.005,.99,.99,'#2d3033','#22272b',.02);return true;}
 if(v==='eaton-addition-grille'){grille(a,c);return true;}
 if(v==='eaton-addition-logo'){a.rect(.02,.08,.96,.84,'#cbd0d2','#30383c');a.label('EATON',.5,.5,Math.min(8,c.width/3.4));return true;}
 if(v==='eaton-addition-display'){display(a,c);return true;}
 if(v==='eaton-addition-fan'){fan(a,c);return true;}
 if(v==='eaton-addition-slot'){a.rect(.02,.01,.96,.98,'#41474a','#9ca3a7',.05);for(const y of [.07,.92])a.circle(.5,y,.035,'#bcc3c6','#272e32');return true;}
 if(v==='eaton-addition-c13'||v==='eaton-addition-c13-portrait'){iec(a,v.endsWith('portrait'),false,false,!v.endsWith('portrait'));return true;}
 if(v==='eaton-addition-c19'||v==='eaton-addition-c19-inverted'){iec(a,false,true,false,v.endsWith('inverted'));return true;}
 if(v==='eaton-addition-c20-portrait'){iec(a,true,true,true);return true;}
 if(v==='eaton-addition-battery180'){battery180(a);return true;}
 if(v==='eaton-addition-battery72'){battery72(a,c);return true;}
 if(v==='eaton-addition-gland'){gland(a,c);return true;}
 if(v==='eaton-addition-usbb'){a.rect(.03,.02,.94,.96,'#9caaaf','#17272e',.08);a.polygon([[.20,.17],[.64,.17],[.83,.34],[.83,.81],[.17,.81],[.17,.34]],'#101b21');a.rect(.41,.33,.21,.31,'#859497');return true;}
 if(v==='eaton-addition-detect'){a.rect(.03,.025,.94,.95,'#909a9f','#233039');a.polygon([[.17,.15],[.83,.15],[.83,.64],[.67,.64],[.67,.84],[.33,.84],[.33,.64],[.17,.64]],'#0c141a');for(let i=0;i<4;i++)a.rect(.26+i*.13,.22,.045,.20,'#9f986f');return true;}
 if(v==='eaton-addition-terminal'){a.rect(.05,.02,.90,.96,'#366458','#182a25',.04);for(let i=0;i<2;i++){a.rect(.17,.12+i*.42,.66,.31,'#203830');a.line(.30,.26+i*.42,.69,.26+i*.42,'#a0b1a6');}return true;}
 if(v==='eaton-addition-db9'||v==='eaton-addition-db15'){serial(a,c,v.endsWith('db15')?15:9);return true;}
 if(v==='eaton-addition-breaker'){a.rect(.02,.025,.96,.95,'#777f83','#172228',.02);a.rect(.30,.17,.60,.61,'#313b41','#111a20');a.line(.11,.48,.21,.48,'#131c23');return true;}
 return false;
}
/** Draw the source silver perforated bezel with alternating rows of bounded ventilation apertures. */
function grille(a,c){a.rect(.005,.005,.99,.99,'#a9adae','#51585c',.025);const cols=Math.max(8,Math.floor(c.width/6)),rows=Math.max(5,Math.floor(c.height/6));for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){const x=.03+(col+(r%2)*.35)*.92/cols,y=.04+r*.92/rows;a.rect(x,y,.58/cols,.52/rows,'#141c20',undefined,.02);}}
/** Represent the five-button original LCD as an inactive screen without inventing current readings. */
function display(a,c){a.rect(.01,.02,.98,.96,'#202629','#0c151a',.05);a.rect(.11,.19,.78,.51,'#183756','#6c7377',.02);for(let i=0;i<3;i++)a.rect(.21+i*.23,.08,.06,.045,'#6e7577');for(let i=0;i<5;i++){a.rect(.08+i*.17,.77,.15,.14,'#454d53','#172329',.025);if(i===4)a.circle(.155+i*.17,.84,Math.min(.035,c.width*.045/Math.min(c.width,c.height)),'#a8b0b3');}}
/** Draw a circular wire guard and fixed fan, with radii bounded at both application widths. */
function fan(a,c){a.rect(.005,.005,.99,.99,'#333a3e','#9da5a9',.03);for(const r of [.44,.37,.30,.23,.16])a.circle(.5,.5,r,r===.44?'#10191e':'transparent','#a3abad');a.circle(.5,.5,.105,'#5a666c','#acb5b9');for(const [x,y]of[[.08,.08],[.92,.08],[.08,.92],[.92,.92]]){a.line(x,y,1-x,1-y,'#afb7ba');a.circle(x,y,.035,'#b0b6b9','#2c373c');}}
/** Draw three-aperture C13/C19 receptacles or a C20 inlet, rotating the actual aperture pattern with its mounting. */
function iec(a,portrait,large,male,inverted=false){
 a.rect(.01,.015,.98,.97,'#737d83','#131e25',.07);
 const pts=large?[[.13,.15],[.87,.15],[.87,.85],[.13,.85]]:[[.21,.12],[.79,.12],[.91,.30],[.91,.88],[.09,.88],[.09,.30]];
 a.polygon(pts.map(([x,y])=>portrait?[1-y,x]:[x,inverted?1-y:y]),'#17242c','#b0b7ba');
 for(const [x,y]of[[.28,.62],[.5,.35],[.72,.62]]){const w=large?.18:.075,h=large?.07:.18,xx=portrait?1-y:x,yy=portrait?x:inverted?1-y:y;a.rect(xx-(portrait?h:w)/2,yy-(portrait?w:h)/2,portrait?h:w,portrait?w:h,male?'#c4cdd0':'#03090d');}
}
/** Trace the original180V keyed rectangular three-contact battery connector, not a generic IEC receptacle. */
function battery180(a){a.rect(.015,.025,.97,.95,'#757e82','#18262c',.15);a.rect(.07,.14,.86,.70,'#171f25','#abb2b5',.12);for(let i=0;i<3;i++){const x=.13+i*.255;a.polygon([[x,.29],[x+.04,.22],[x+.19,.22],[x+.22,.34],[x+.22,.64],[x+.17,.73],[x+.04,.73],[x,.63]],'#717b80','#c5cccf');a.rect(x+.05,.37,.13,.19,'#273138');}a.rect(.47,.22,.035,.50,'#a5b0b6');}
/** Trace the five round contact positions and keyed hexagonal shell of the original72V5PX battery connector. */
function battery72(a,c){a.polygon([[.17,.03],[.83,.03],[.98,.48],[.83,.97],[.17,.97],[.02,.48]],'#9fa7aa','#17262d');a.polygon([[.25,.12],[.76,.12],[.89,.49],[.75,.87],[.25,.87],[.12,.49]],'#1c292f','#65787e');for(const [x,y]of[[.35,.30],[.65,.30],[.5,.5],[.35,.70],[.65,.70]]){a.circle(x,y,.08,'#b4c0c5');a.circle(x,y,.044,'#142026');}a.rect(.18,.40,.025,.16,'#ccd2d5');}
/** Show the covered terminal-block cable entrance, avoiding exposed terminal screws or a fake IEC connector. */
function gland(a,c){a.rect(.015,.015,.97,.97,'#353e43','#a0a9ad',.025);a.circle(.5,.5,.38,'#1e292f','#87969e');a.circle(.5,.5,.28,'#172229','#63747d');a.circle(.5,.5,.20,'#0a1318','#354850');for(const y of [.075,.925])a.circle(.12,y,.025,'#bec6c9');}
/** Draw noninteractive portrait D-shell monitoring, relay or parallel sockets with the verified contact count. */
function serial(a,c,count){a.polygon([[.16,.10],[.75,.10],[.88,.23],[.88,.77],[.75,.90],[.16,.90],[.05,.77],[.05,.23]],'#9da8ad','#172931');a.polygon([[.28,.19],[.65,.19],[.76,.29],[.76,.72],[.65,.81],[.28,.81]],'#192b34');const rows=count===15?3:2,per=count===15?5:5;for(let row=0;row<rows;row++)for(let col=0;col<(count===9&&row===1?4:per);col++)a.rect(.32+row*.13,.26+col*.11,.045,.045,'#b5c1c8');}
