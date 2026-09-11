/** TraceP38995-B21 from HPE's s00004154 product photograph: black handle, pink upper latch, silver lever and visible keyed C14 contacts. */
export function addHPEGen11PlatinumSupply(art, component, colors) {
  const radius=Math.min(component.width*.26,component.height*.38);
  const rx=radius/component.width; const ry=radius/component.height;
  art.circle(.34,.46,radius/Math.min(component.width,component.height),"#122327","#a7b2b5");
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    art.line(.34+Math.cos(angle)*rx*.3,.46+Math.sin(angle)*ry*.3,
      .34+Math.cos(angle+.28)*rx*.96,.46+Math.sin(angle+.28)*ry*.96,"#708389");
  }
  art.circle(.34,.46,.16,"#826975","#a7b2b5");
  for(const x of [.075,.605]) for(const y of [.12,.81]) {
    art.circle(x,y,.04,"#c3cacc",colors.ink);
    art.line(x-.02,y,x+.02,y,"#465a62");
  }
  art.rect(.675,.285,.28,.63,"#26343a","#a7b2b5",.04);
  art.polygon([[.71,.33],[.9,.33],[.935,.41],[.935,.81],[.89,.86],[.71,.86],[.69,.80],[.69,.41]],"#07151a","#65767d");
  for(const [x,y] of [[.755,.43],[.755,.76],[.875,.60]]) art.rect(x-.025,y-.018,.05,.036,"#d0d6d8",undefined,.004);
  art.polygon([[.05,.48],[.10,.48],[.10,.69],[.58,.69],[.58,.48],[.63,.48],[.63,.79],[.58,.82],[.10,.82],[.05,.77]],"#172125","#515e62");
  art.circle(.705,.15,.03,component.active===false?"#315246":"#42d98b",colors.ink);
  art.polygon([[.81,.08],[.96,.08],[.96,.30],[.915,.34],[.915,.65],[.88,.70],[.88,.36],[.80,.36]],"#b9c3c4","#65767d");
  art.rect(.63,.20,.16,.13,"#b36582","#965368",.02);
  art.polygon([[.68,.235],[.745,.235],[.72,.29]],"#814159","#814159");
}
