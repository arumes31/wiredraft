/** Render the documented modular Catalyst panels through the common Canvas/SVG primitive builder. */
export function addCatalystChassisHardware(art,component) {
  const variant=component.variant;
  if(!variant?.startsWith("cat-"))return false;
  if(variant==="cat-chassis-strip") {
    art.rect(0,0,1,1,"#414c50","#9ca8ab",.001);if(component.label)art.label(component.label,.55,.50,6);return true;
  }
  if(variant==="cat-chassis-edge") {
    art.rect(.04,.01,.92,.98,"#a6b2b7","#62767d",.01);art.circle(.5,.33,.22,"#bbc5c7","#506870");return true;
  }
  if(variant==="cat-chassis-ejector") {
    art.polygon([[.01,.05],[.22,.05],[.30,.34],[.90,.34],[.98,.08],[.99,.58],[.91,.96],[.14,.96],[.01,.60]],"#aebcc0","#637c83");return true;
  }
  if(variant==="cat-chassis-blank") {
    art.rect(.004,.015,.992,.97,"#7e9099","#b2c0c4",.006);
    for(const x of [.05,.95])art.circle(x,.50,.055,"#c3cbd0","#4d646c");
    art.rect(.05,.84,.90,.025,"#647b83",undefined,.001);
    if(component.label)art.label(component.label,.50,.44,7);return true;
  }
  if(variant==="cat-chassis-power-switch") {
    art.rect(.05,.03,.90,.94,"#b4c1c5","#4d636b",.06);art.rect(.19,.12,.62,.76,"#253b46","#8199a3",.04);art.line(.50,.27,.50,.42,"#e2e8e5");return true;
  }
  if(variant==="cat-chassis-fan-front") {
    art.rect(.03,.01,.94,.98,"#a0b1bb","#667b83",.025);
    for(const y of [.05,.94])art.circle(.5,y,.105,"#bdc9ca","#516972");
    handle(art,.23,.34,.51,.43);
    for(const [x,y]of [[.34,.14],[.64,.14],[.34,.19]])art.circle(x,y,.035,"#4d8fa0","#657b81");
    if(component.label)art.label(component.label,.50,.26,5);return true;
  }
  if(variant==="cat-9400-3200ac") {
    art.rect(.012,.02,.976,.96,"#958e61","#34464d",.008);mesh(art,component,.025,.055,.94,.87,19);
    art.rect(.055,.10,.39,.17,"#29353b","#88918a",.015);art.rect(.070,.13,.10,.10,"#4d5d5e",undefined,.005);
    for(let i=0;i<4;i++)art.circle(.22+i*.055,.185,.019,"#879c7b","#313d3e");
    // The3200W supply uses a rectangular C20 inlet with horizontal blades, not a beveled C14.
    art.rect(.62,.15,.31,.61,"#16272f","#748181",.022);
    for(const [x,y]of [[.777,.34],[.71,.59],[.84,.59]])art.rect(x-.025,y-.014,.05,.028,"#bbc6c2",undefined,.002);
    art.polygon([[.08,.89],[.17,.73],[.59,.73],[.70,.87],[.95,.87],[.96,.96],[.12,.96]],"#596a6a","#afbab5");return true;
  }
  if(variant==="cat-9600-2kwac") {
    art.rect(.015,.02,.97,.96,"#aebbc1","#556a74",.014);
    const minimum=Math.min(component.width,component.height),radius=Math.min(.40,.27*component.width/minimum);
    art.circle(.29,.48,radius,"#304852","#c1d0d1");
    for(const fraction of [.40,.675,.90])art.circle(.29,.48,radius*fraction,"rgba(0,0,0,0)","#afbec1");
    for(let i=0;i<8;i++){const a=i*Math.PI/4;art.line(.29,.48,.29+.9*radius*minimum/component.width*Math.cos(a),.48+.9*radius*minimum/component.height*Math.sin(a),"#afbec1");}
    art.polygon([[.65,.12],[.82,.12],[.91,.25],[.91,.69],[.82,.82],[.65,.82]],"#152d38","#879ba3");
    for(const [x,y]of [[.72,.27],[.81,.46],[.72,.65]])art.rect(x-.022,y-.017,.044,.034,"#c4ced0",undefined,.001);
    art.polygon([[.03,.85],[.10,.92],[.50,.25],[.48,.16],[.43,.14],[.38,.22]],"#c3cece","#617d89");
    art.rect(.56,.80,.24,.12,"#aabec3","#66818d",.018);art.circle(.95,.88,.022,"#4c956f","#58716d");return true;
  }
  if(variant==="cat-9404-rear"||variant==="cat-9606-rear") {
    const small=variant==="cat-9404-rear";
    art.rect(.005,.005,.99,.99,small?"#597d8d":"#84939b","#425c69",.005);
    // Cooling impellers are internal and side-facing; the rear is a service plate with a narrow tray handle.
    art.rect(.878,small?.20:.017,.105,small?.783:.966,"#a4bbc5","#456675",.008);
    handle(art,.901,.34,.054,.36);
    for(const y of [small?.215:.045,.95])art.circle(.931,y,.014,"#c2cfd3","#375766");
    art.circle(.910,small?.76:.285,.006,"#48a8c3","#4a6977");
    if(small) {
      art.rect(.025,.045,.844,.290,"#678b9d","#3e6172",.005);
      for(let i=0;i<4;i++){
        const x=.037+i*.207;
        art.rect(x,.10,.182,.083,"#4b7189","#91adbd",.008);
        for(let j=0;j<4;j++)art.rect(x+.012+j*.041,.116,.031,.05,"#3f627c","#7296ac",.002);
        mesh(art,component,x+.017,.195,.145,.033,15);
      }
      for(const x of [.40,.51,.59])art.circle(x,.277,.019,"#7496a5","#4b7185");
    } else mesh(art,component,.035,.815,.815,.125,58);
    for(const [x,y]of [[.03,.025],[.31,.025],[.59,.025],[.87,.025],[.03,.97],[.31,.97],[.59,.97],[.87,.97],
      [.04,.38],[.40,.38],[.73,.38],[.04,.70],[.40,.70],[.73,.70]])art.circle(x,y,.005,"#afc1c8","#3c5c6c");
    return true;
  }
  return false;
}

/** Trace the curved vertical front/rear fan-tray service handle without exposing internal impellers. */
function handle(art,x,y,width,height) {
  art.polygon([[x,y],[x+width*.75,y],[x+width,y+height*.15],[x+width,y+height*.85],[x+width*.75,y+height],[x,y+height],
    [x+width*.23,y+height*.88],[x+width*.46,y+height*.82],[x+width*.46,y+height*.18],[x+width*.23,y+height*.12]],"#b9c8ce","#415c6a");
  art.rect(x+width*.48,y+height*.22,width*.47,height*.56,"#334e5c","#6b8795",.015);
}

/** Keep source hexagonal vent perforations isotropic and inside the measured bounds. */
function mesh(art,component,x,y,width,height,columns) {
  const dx=width/columns,rx=dx*.44,ry=rx*component.width/component.height,dy=ry*1.8;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns-row%2;col++){
    const cx=x+(col+.5+row%2*.5)*dx,cy=y+(row+.5)*dy;
    art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*.8*Math.sin(i*Math.PI/3)]),"#233f4b","#6f8993");
  }
}
