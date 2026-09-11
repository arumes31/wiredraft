/** Draw source-specific Catalyst rear guards, handles and covered option positions for both renderers. */
export function addCatalystFamilyHardware(art,component) {
  const variant=component.variant;
  if(!variant?.startsWith("catalyst-")) return false;
  art.rect(.015,.025,.97,.95,"#abb2b3","#354249",.015);
  if(variant==="catalyst-stack-cover") {
    art.circle(.5,.34,.085,"#91999a","#475055");art.line(.46,.34,.54,.34,"#e1e5e4");
    art.rect(.06,.81,.88,.045,"#525e62",undefined,.002);return true;
  }
  if(variant==="catalyst-9500-ssd-cover") {
    art.rect(.15,.09,.70,.79,"#bfc5c4","#667276",.07);
    for(const y of [.18,.80]) art.circle(.5,y,.065,"#929c9b","#46545a");return true;
  }
  if(variant==="catalyst-9200-fixed-fan") {
    honeycomb(art,component,.06,.06,.88,.88,7);return true;
  }
  if(variant==="catalyst-9300-fan-t2") {
    art.circle(.5,.5,.43,"#25343b","#ced3d1");
    for(const r of [.16,.28,.39]) art.circle(.5,.5,r,"rgba(0,0,0,0)","#85908f");
    for(const x of [.17,.80]) art.rect(x,.08,.025,.84,"#abb2b3",undefined,.003);
    art.rect(.09,.39,.82,.22,"#9ba5a3","#35464c",.05);
    art.rect(.27,.44,.46,.12,"#d2d6d2","#707e80",.025);
    for(const [x,y] of [[.07,.07],[.89,.07],[.07,.89],[.89,.89]]) art.circle(x,y,.035,"#d1d7d5","#59696c");
    return true;
  }
  if(variant==="catalyst-9500-fantray") {
    honeycomb(art,component,.045,.13,.91,.70,15);
    art.rect(.13,.27,.74,.47,"#c8cecb","#53646a",.06);
    art.rect(.21,.33,.58,.34,"#acb8b4","#6f7c7f",.03);
    for(const x of [.055,.90]) art.rect(x,.30,.045,.40,"#afbab7","#42535a",.02);
    for(const x of [.08,.88]) art.circle(x,.075,.022,"#d9dedc","#5b6b70");return true;
  }
  if(["catalyst-c5-ac","catalyst-c1-ac","catalyst-9500-ac"].includes(variant)) {
    const left=variant==="catalyst-c5-ac"; const high=variant==="catalyst-9500-ac";
    if(high) {
      art.circle(.33,.43,.34,"#35434a","#d5dbd8");
      for(const r of [.19,.29]) art.circle(.33,.43,r,"rgba(0,0,0,0)","#a9b2af");
      art.rect(.12,.51,.47,.10,"#acb7b2","#4a6065",.015);
      art.rect(.275,.46,.105,.48,"#c8d0c8","#5f7475",.015);
    } else honeycomb(art,component,left?.34:.04,.08,left?.61:.52,.78,13);
    const x=left?.10:.65;
    if(high) {
      // Figure17 shows the C14 rotated clockwise: right-side chamfers and horizontal contact blades.
      art.polygon([[.65,.17],[.82,.17],[.88,.27],[.88,.73],[.82,.83],[.65,.83]],"#17272e","#cdd6d1");
      for(const [px,py] of [[.71,.31],[.79,.50],[.71,.69]]) art.rect(px-.024,py-.018,.048,.036,"#c3c9c5",undefined,.001);
    } else {
      art.polygon([[x,.31],[x+.035,.23],[x+.235,.23],[x+.27,.31],[x+.27,.73],[x,.73]],"#17272e","#cdd6d1");
      for(const [px,py] of [[x+.135,.37],[x+.07,.59],[x+.20,.59]]) art.rect(px-.012,py-.045,.024,.09,"#c3c9c5",undefined,.001);
    }
    if(!high) {
      art.rect(left?.055:.88,.75,.045,.15,"#53685b","#9fafaa",.01);
      art.rect(.10,.88,.77,.035,"#c6ceca","#6b7a7a",.008);
    }
    for(const x of [left?.56:.10,left?.66:.20]) art.circle(x,.09,.018,"#4c865d","#54645e");
    return true;
  }
  return false;
}

/** Trace the source honeycomb pattern with isotropic hexagons bounded inside the component. */
function honeycomb(art,component,x,y,width,height,columns) {
  const dx=width/columns,rx=dx*.44,ry=rx*component.width/component.height,dy=ry*1.8;
  for(let row=0;row<Math.floor(height/dy);row++) for(let col=0;col<columns-row%2;col++) {
    const cx=x+(col+.5+row%2*.5)*dx,cy=y+(row+.5)*dy;
    art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*.80*Math.sin(i*Math.PI/3)]),"#1d2d34","#76858a");
  }
}
