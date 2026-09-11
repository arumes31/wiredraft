/** Render only X695-specific assemblies and X870 timing/storage/handle details; shared exact parts retain their existing renderer. */
export function addExtremeFinalComponent(art, component, colors) {
  if (component.variant === "extreme-final-750w") supply750(art, component);
  else if (component.variant === "extreme-final-fan001") fan001(art);
  else if (component.variant === "extreme-final-timing") {
    art.circle(.5,.5,.43,"#b9c2c7","#394d58");
    art.circle(.5,.5,.33,undefined,"#475e69");
    art.circle(.5,.5,.22,"#526873","#c1c9cd");
    art.circle(.5,.5,.075,"#25363e");
  } else if (component.kind === "extreme-final-micro-a") {
    art.rect(.025,.08,.95,.84,"#b2bdc4","#4e6470",.025);
    art.rect(.13,.26,.74,.46,"#22363f");
    art.rect(.26,.35,.48,.10,"#a5b5bc");
  } else if (component.variant === "extreme-final-slide") {
    art.rect(.025,.12,.95,.76,"#485159","#a7b4bd",.08);
    for(let i=0;i<8;i++) art.line(.16+i*.09,.25,.16+i*.09,.74,"#71808a");
  } else if (component.variant === "extreme-final-tab") {
    art.polygon([[.10,.05],[.55,.05],[.87,.20],[.92,.73],[.58,.95],[.10,.95]],"#9cbf50","#536c32");
    art.line(.30,.15,.30,.84,"#5c7537");
  } else if (component.variant === "extreme-final-status") {
    for(let row=0;row<4;row++) for(let column=0;column<2;column++) art.circle(.25+column*.45,.12+row*.23,.09,"#91a77a",colors.ink);
  } else return false;
  return true;
}

/** Trace XN-FAN-001-F honeycomb face with a left release spine and red front-to-back tab. */
function fan001(art) {
  art.rect(.025,.025,.95,.95,"#b3bdc3","#556b75",.025);
  for(let row=0;row<8;row++) for(let column=0;column<6;column++) art.rect(.21+column*.12,.10+row*.10,.075,.063,"#40545e");
  art.rect(.07,.16,.085,.72,"#b3bdc3","#546b74",.015);
  art.rect(.07,.55,.085,.25,"#a95056","#754247",.015);
}

/** Trace the exact shared750W supply: sideways C14 at left, fan at right, wire pull handle and red airflow release tab. */
function supply750(art, component) {
  art.rect(.025,.025,.95,.95,"#b3bdc3","#4c636e",.025);
  art.rect(.045,.28,.075,.43,"#b05259","#753b43",.015);
  art.polygon([[.18,.25],[.43,.25],[.48,.34],[.48,.70],[.18,.70],[.14,.62],[.14,.34]],"#23363f","#ccd6db");
  for(const [x,y] of [[.23,.37],[.34,.47],[.23,.57]]) art.rect(x,y,.07,.027,"#c3cfd6");
  art.rect(.56,.15,.35,.69,"#263b45","#6c7f88",.025);
  const radius=Math.min(component.width*.145,component.height*.25);
  art.circle(.735,.49,radius/Math.min(component.width,component.height),"#b2c0c8","#526b78");
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2;
    art.line(.735+Math.cos(angle)*radius*.40/component.width,.49+Math.sin(angle)*radius*.40/component.height,
      .735+Math.cos(angle)*radius/component.width,.49+Math.sin(angle)*radius/component.height,"#81959f");
  }
  art.rect(.545,.13,.37,.73,undefined,"#b7c5cd",.07);
  for(const y of [.17,.27,.37]) art.circle(.08,y,.022,"#8cac70","#49644c");
}
