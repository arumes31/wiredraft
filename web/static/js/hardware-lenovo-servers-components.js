/** Draw only the verified Lenovo/System x chassis components; unknown variants use the shared dispatcher. */
export function addLenovoServerComponent(a,c) {
  const v=c.variant||c.kind;
  if(typeof v!=="string"||!v.startsWith("lenovo-server-")) return false;
  if(v==="lenovo-server-front"||v==="lenovo-server-rear") {a.rect(0,0,1,1,v.endsWith("front")?"#222629":"#a5a9ab","#50585d",.008);return true;}
  if(v==="lenovo-server-ear") {a.rect(.02,.015,.96,.97,"#303438","#596064",.04);a.rect(.12,.59,.76,.045,"#171c20");a.circle(.5,.12,.09,"#8e9395");a.rect(.18,.68,.61,.25,"#353a3e");return true;}
  if(v==="lenovo-server-lff"||v==="lenovo-server-g3hs") {a.rect(.01,.015,.98,.97,"#131719","#676c70",.02);a.rect(.075,.14,.72,.66,"#080b0d","#3b4348",.02);mesh(a,.085,.18,.70,.57,16,3);a.rect(.05,.73,.77,.12,"#3b4145");a.rect(.84,.10,.10,.78,"#353a3d");a.rect(.96,.16,.023,.65,v.endsWith("g3hs")?"#7d8489":"#aa2937");a.rect(.855,.22,.025,.14,"#677174");a.rect(.899,.22,.025,.14,"#687277");a.label(c.label??"",.87,.71,3.5);return true;}
  if(v==="lenovo-server-slot") {a.rect(.005,.03,.99,.94,"#a9adae","#5f656a",.025);mesh(a,.06,.20,.88,.61,22,2);return true;}
  if(v==="lenovo-server-blank"||v==="lenovo-server-lcd") {a.rect(.01,.03,.98,.94,"#202529","#596168",.02);if(v.endsWith("lcd"))a.rect(.05,.10,.88,.72,"#060b10","#343c40",.02);return true;}
  if(v==="lenovo-server-diagnostic") {a.rect(.02,.02,.96,.96,"#b6bbbd","#626a70",.04);a.rect(.14,.16,.72,.64,"#10171c");for(let n=0;n<4;n++)a.rect(.2+n*.15,.38,.06,.25,"#aa9d65");return true;}
  if(v==="lenovo-server-psu") {a.rect(.01,.025,.98,.95,"#a1a7a9","#515b60",.025);const radius=Math.min(.40,c.width*.245/Math.min(c.width,c.height));a.circle(.26,.5,radius,"#111a1e","#b3b8ba");a.circle(.26,.5,radius*.675,"#333b40","#919b9f");a.label(c.label??"",.26,.5,5);a.rect(.51,.055,.04,.88,"#3d454a","#b8c0c3",.02);a.rect(.956,.57,.028,.35,"#d28530","#7d582e");a.circle(.912,.18,.028,"#677174");a.circle(.912,.31,.028,"#657073");return true;}
  if(v==="lenovo-server-c14") {a.rect(.02,.01,.96,.98,"#535c60","#adb7ba",.03);a.polygon([[.17,.13],[.69,.13],[.86,.30],[.86,.70],[.69,.87],[.17,.87]],"#0a1317","#808c93");for(const [x,y] of [[.32,.31],[.61,.5],[.32,.69]])a.rect(x-.07,y-.025,.14,.05,"#c1c9cc");return true;}
  return false;
}
/** Create a bounded ventilation mesh rather than inventing visible rear system fans. */
function mesh(a,x,y,w,h,cols,rows) {for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)a.rect(x+c*w/cols,y+r*h/rows,w/cols*.62,h/rows*.6,"#151e23",undefined,.01);}
