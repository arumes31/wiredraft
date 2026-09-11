/** Render only the source-specific PA-7050 covers, first-generation cards and power fittings. */
export function addPA7050Hardware(art,component) {
  const variant=component.variant||component.kind;
  if(typeof variant!=="string"||!variant.startsWith("pa7050-"))return false;
  if(variant==="pa7050-mesh"){rearMesh(art,component);return true;}
  if(variant==="pa7050-strip"){art.rect(.003,.08,.994,.84,"#69747a");return true;}
  if(variant==="pa7050-c20"){inlet(art);return true;}
  if(variant==="pa7050-ground"){for(const x of [.27,.72]){art.polygon(Array.from({length:6},(_,i)=>[x+.18*Math.cos(i*Math.PI/3),.5+.37*Math.sin(i*Math.PI/3)]),"#ccd0ce","#44535b");art.circle(x,.5,.10,"#7d8a8c","#c0c9ca");}return true;}
  if(variant==="pa7050-ac"){supply(art,component);return true;}
  if(variant==="pa7050-tall-ejector"){art.rect(.07,.03,.85,.94,"#4d565a","#26383f",.015);art.rect(.16,.12,.65,.60,"#101f26");art.rect(.05,.77,.90,.16,"#718086",undefined,.035);return true;}
  if(variant==="pa7050-low-ejector"){art.rect(.03,.08,.94,.84,"#54636a","#24343d",.13);art.rect(.15,.21,.48,.56,"#91a0a4",undefined,.08);return true;}
  art.rect(.025,.025,.950,.950,"#a2a9ab","#56646c",.01);
  if(variant==="pa7050-header") {
    art.polygon([[.015,.04],[.17,.34],[.98,.38],[.98,.68],[.17,.65],[.015,.95]],"#c6cccb","#66757b");art.label("PALO ALTO",.19,.53,Math.min(13,component.width*.055));art.label("PA-7050",.87,.18,Math.min(9,component.width*.026));
  } else if(variant==="pa7050-fan-cover"||variant==="pa7050-filter") {
    for(const y of [.29,.64])art.rect(.39,y,.24,.091,"#d4d9d5","#68787f",.08);
    if(variant==="pa7050-fan-cover") {art.circle(.50,.035,.13,"#c4cbcb","#55656c");for(const y of [.069,.093])art.circle(.50,y,.035,"#40565f");art.circle(.50,.97,.13,"#c4cbcb","#55656c");}
  } else if(variant==="pa7050-blank") {
    for(const x of [.018,.935]){art.rect(x,.19,.036,.58,"#38474f","#697b82",.04);art.rect(x,.80,.050,.12,"#5b6b70",undefined,.04);}
  } else if(variant==="pa7050-amc") {
    for(const y of [.16,.31])art.circle(.055,y,.020,"#445c65");art.rect(.84,.15,.07,.20,"#35494f");art.rect(.075,.74,.20,.13,"#677980","#263c44",.04);art.label(component.label,.52,.56,Math.min(8,component.width*.08));
  } else if(variant==="pa7050-breaker") {
    art.rect(.13,.05,.74,.90,"#526169","#1d333b",.05);art.rect(.18,.10,.64,.32,"#c8d0ce",undefined,.04);art.label("OFF",.50,.53,Math.min(5,component.width*.20));art.label("ON",.50,.80,Math.min(5,component.width*.20));
  }
  return true;
}

/** Preserve the rear C20's horizontal blade orientation and separate mounting flange. */
function inlet(art) {
  art.rect(.026,.026,.948,.948,"#69777d","#30434c",.06);art.rect(.16,.12,.68,.76,"#09161d",undefined,.01);
  for(const [x,y]of [[.43,.35],[.28,.59],[.58,.59]])art.rect(x,y,.15,.063,"#d0d6d8",undefined,.02);
  for(const x of [.075,.925])art.circle(x,.5,.04,"#c6cece","#30434b");
}

/** Draw exactly two circular visible grilles per front supply with bounded guard rings. */
function supply(art,c) {
  art.rect(.026,.026,.948,.948,"#a9b1b3","#4b6069",.02);
  const radius=Math.min(c.width*.177,c.height*.40),rx=radius/c.width,ry=radius/c.height;
  for(const x of [.25,.62]) {
    art.circle(x,.50,radius/Math.min(c.width,c.height),"#24333a");
    for(const scale of [1,.72,.37])art.polygon(Array.from({length:32},(_,i)=>[x+rx*scale*Math.cos(i*Math.PI/16),.50+ry*scale*Math.sin(i*Math.PI/16)]),undefined,"#bdc7c9");
    art.line(x-rx,.5,x+rx,.5,"#b2bfc1",.6);art.line(x,.5-ry,x,.5+ry,"#b2bfc1",.6);
  }
  art.rect(.90,.13,.047,.70,"#384f5a","#798d94",.08);
  for(let i=0;i<3;i++)art.circle(.823,.29+i*.12,.014,"#4c646b");
}

/** Preserve the rear panel's three visible rows of hexagonal ventilation openings. */
function rearMesh(art,c) {
  const radius=c.height*.14,step=radius*1.82,count=Math.floor((c.width-radius*2)/step);
  for(const cy of [.20,.50,.80])for(let i=0;i<count;i++) {
    const cx=(c.width-(count-1)*step)/2+i*step;
    art.polygon(Array.from({length:6},(_,j)=>[(cx+radius*Math.cos(j*Math.PI/3+Math.PI/6))/c.width,cy+radius*Math.sin(j*Math.PI/3+Math.PI/6)/c.height]),"#24333a","#708087");
  }
}
