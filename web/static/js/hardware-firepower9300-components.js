/** Draw source-specific Firepower9300 field-replaceable hardware identically for Canvas and SVG. */
export function addFirepower9300Hardware(art,component){
  const variant=component.variant||component.kind;if(typeof variant!=="string"||!variant.startsWith("firepower9300-"))return false;
  if(variant==="firepower9300-sfp"||variant==="firepower9300-qsfp"){
    art.rect(.015,.035,.97,.93,"#596568","#b4aa55",.025);art.rect(.07,.13,.86,.72,"#162b32","#bec8c5",.01);art.rect(.28,.78,.44,.09,"#7e9090","#a1afad",.01);art.line(.12,.65,.88,.65,"#51696b",.7);return true;
  }
  if(variant==="firepower9300-grille"){grille(art,component,.01,.02,.98,.96);return true;}
  if(variant==="firepower9300-screw"){
    const scale=component.screwEnvelopeScale||1;screw(art,.5,.5,.38*scale);
    if(scale!==1)for(const primitive of art.parts.slice(-3))primitive.strokeWidth*=scale;
    return true;
  }
  art.rect(.01,.015,.98,.97,"#aeb8b9","#465961",.025);
  if(variant==="firepower9300-sm40"){
    grille(art,component,.025,.045,.95,.91);
    for(const x of [.035,.595]){art.rect(x,.045,.365,.35,"#bac2c1","#455a61",.02);art.rect(x+.016,.075,.220,.265,"#d8ddda","#647a7d",.012);art.rect(x+.248,.075,.043,.265,"#6e8487","#455b63",.014);for(let i=0;i<3;i++)art.rect(x+.308,.10+i*.08,.024,.045,"#334b55",undefined,.005);}
    art.rect(.19,.595,.795,.310,"#bac5c2","#455e63",.02);art.rect(.19,.595,.345,.310,"#24313a","#53686e",.02);art.rect(.23,.640,.105,.215,"#526266","#7a8c8d",.02);screw(art,.484,.746,.085);
    for(const x of [.58,.65,.70,.92])art.circle(x,.75,.014,"#355659","#9fafad");return true;
  }
  if(variant==="firepower9300-psu"){
    grille(art,component,.04,.055,.92,.88);art.rect(.045,.49,.26,.43,"#23323a","#3b5360",.025);art.rect(.066,.51,.13,.07,"#617c78","#455d62",.01);art.rect(.05,.06,.06,.33,"#9caba9","#536a70",.02);screw(art,.90,.87,.055);return true;
  }
  if(variant==="firepower9300-fan"){
    grille(art,component,.04,.20,.92,.76);art.rect(.03,.025,.94,.145,"#c1c8c4","#566b6f",.02);art.rect(.43,.185,.13,.78,"#bbc5bf","#465d63",.015);art.rect(.47,.005,.12,.09,"#93a9a5","#415c62",.02);screw(art,.16,.10,.024);return true;
  }
  if(variant==="firepower9300-ac-feed"){
    art.rect(.09,.08,.82,.84,"#1e3038","#6f8789",.06);art.polygon([[.18,.17],[.82,.17],[.82,.69],[.70,.82],[.30,.82],[.18,.69]],"#122631","#91a19d");
    for(const [x,y]of [[.32,.38],[.68,.38],[.50,.66]])art.rect(x-.034,y-.10,.068,.20,"#c6d1c5",undefined,.008);return true;
  }
  if(variant==="firepower9300-switch"){art.rect(.11,.17,.78,.66,"#253b46","#73868a",.02);art.line(.35,.28,.35,.60,"#d9e3dc",.7);art.circle(.65,.45,.16,"#253b46","#d9e3dc");return true;}
  if(variant==="firepower9300-ground"){for(const y of [.22,.78])screw(art,.5,y,.20);return true;}
  return false;
}

/** Keep the source square perforations isotropic at every component aspect and display scale. */
function grille(art,component,x,y,width,height){
  const columns=Math.max(2,Math.ceil(width*component.width/5)),dx=width/columns,dy=dx*component.width/component.height;
  for(let row=0;row<Math.floor(height/dy);row++)for(let col=0;col<columns;col++)art.rect(x+col*dx+dx*.13,y+row*dy+dy*.13,dx*.72,dy*.72,"#273e47","#8da0a1",.003);
}

/** Render bounded captive crosshead fasteners without claiming screw thread detail. */
function screw(art,x,y,radius){art.circle(x,y,radius,"#aebfba","#465e68");art.line(x-radius*.6,y,x+radius*.6,y,"#415760",.7);art.line(x,y-radius*.6,x,y+radius*.6,"#415760",.7);}
