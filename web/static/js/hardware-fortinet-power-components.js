/** Render the inspected Fortinet power assemblies through shared Canvas/SVG primitives. */
export function addFortinetPowerComponent(art,component){
 const variant=component.variant;if(typeof variant!=="string"||!variant.startsWith("fortinet-power-"))return false;
 if(variant==="fortinet-power-cover"){
  art.rect(.035,.035,.93,.93,"#b9c0c0","#607075",.02);
  for(let i=0;i<component.screwRows;i++)for(const x of [.075,.925]){
   const y=.09+i*.82/(component.screwRows-1);art.circle(x,y,.025,"#859395","#536568");
  }return true;
 }
 if(variant==="fortinet-power-ground"){
  art.rect(.08,.03,.84,.94,"#9ba6a7","#526369",.02);
  for(const y of [.25,.75]){art.circle(.5,y,.24,"#a8b4b5","#485b62");art.line(.32,y,.68,y,"#43565e",1);art.line(.5,y-.15,.5,y+.15,"#43565e",1);}return true;
 }
 if(variant==="fortinet-power-square-grille"||variant==="fortinet-power-square-fan"){
  const cells=9,gap=.012;
  for(let row=0;row<cells;row++)for(let col=0;col<cells;col++){
   if((row===0||row===8)&&(col===0||col===8))continue;
   art.rect(.025+col*.105,.025+row*.105,.105-gap,.105-gap,"#202b2e",undefined,.018);
  }
  if(variant.endsWith("-fan"))for(const r of [.42,.32,.22])art.circle(.5,.5,r,undefined,"#748082");
  return true;
 }
 if(variant==="fortinet-power-ac-portrait"||variant==="fortinet-power-dc-portrait"){portraitSupply(art,variant.includes("-dc-"));return true;}
 if(variant!=="fortinet-power-ac-horizontal")return false;
 art.rect(.015,.015,.97,.97,"#9da8aa","#3e5056",.018);
 for(let y=.05;y<.96;y+=.11)for(let x=.04;x<.96;x+=.12)art.rect(x,y,.087,.067,"#293b40",undefined,.004);
 art.rect(.055,.055,.67,.80,"#29363c","#616f74",.04);
  art.polygon([[.18,.15],[.57,.15],[.66,.26],[.66,.72],[.57,.82],[.18,.82],[.09,.72],[.09,.26]],"#182a31","#6b7d80");
  for(const [x,y] of [[.36,.30],[.20,.55],[.52,.55]])art.rect(x,y,.035,.16,"#c8d2d3",undefined,.003);
 art.rect(.77,.09,.09,.61,"#2d393e","#45545a",.02);art.rect(.82,.75,.145,.18,"#39938f","#326e71",.015);
 art.circle(.71,.20,.025,"#879584");art.circle(.71,.32,.025,"#918967");return true;
}

/** Trace the 3960E guide's stacked supply: left extraction handle, upper inlet and lower latch. */
function portraitSupply(art,dc){
 art.rect(.025,.025,.95,.95,"#9da8aa","#3e5056",.018);
 for(let y=.07;y<.95;y+=.10)for(let x=.08;x<.90;x+=.12)art.rect(x,y,.085,.055,"#293b40",undefined,.004);
 art.rect(.31,.06,.60,.61,"#29363c","#616f74",.025);
 if(dc){
  art.rect(.40,.12,.37,.43,"#737f82","#313f47",.018);
  for(const y of [.22,.44]){art.circle(.57,y,.075,"#b7c0c1","#3b4c53");art.line(.51,y,.63,y,"#374951",1);}
 }else{
  art.polygon([[.40,.10],[.76,.10],[.86,.20],[.86,.51],[.76,.61],[.40,.61],[.35,.54],[.35,.17]],"#182a31","#6b7d80");
  for(const [x,y] of [[.44,.21],[.64,.34],[.44,.48]])art.rect(x,y,.13,.03,"#c8d2d3",undefined,.003);
 }
 art.rect(.12,.20,.12,.52,"#2d393e","#45545a",.025);
 art.rect(.145,.235,.07,.43,"#9da8aa",undefined,.018);
 art.rect(.32,.70,.58,.10,"#c0c6c7","#53616a",.01);
 art.circle(.47,.86,.025,"#879584");art.circle(.69,.86,.025,"#918967");
 art.rect(.31,.92,.24,.05,"#39938f","#326e71",.01);
}
