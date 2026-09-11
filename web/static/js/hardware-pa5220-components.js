import { addPA3410Hardware } from "./hardware-pa3410-components.js";

/** Render the selected PA-5220's trays, grilles, drive carriers, ground lug and AC supplies. */
export function addPA5220Hardware(art, component) {
  switch (component.variant) {
    case "pa5220-mesh": return addPA3410Hardware(art, { ...component, variant: "pa3410-mesh" });
    case "pa5220-ac": supply(art); break;
    case "pa5220-drive": drive(art, component); break;
    case "pa5220-fan": fan(art, component); break;
    case "pa5220-tray": art.rect(.015,.008,.970,.984,"#c2c7c8","#647177",.025); break;
    case "pa5220-handle": art.rect(.015,.11,.970,.78,"#d3d7d7","#47585f",.32); break;
    case "pa5220-ground": ground(art); break;
    default: return false;
  }
  return true;
}

/** Draw only the inlet and handle revision depicted in the manufacturer's AC back view. */
function supply(art) {
  art.rect(.02,.02,.96,.96,"#8f989c","#4e5c63",.02);
  for (const y of [.08,.84]) for(let i=0;i<5;i++) art.rect(.075+i*.124,y,.100,.060,"#142027");
  art.rect(.10,.24,.57,.51,"#142027","#57646a",.10);
  art.rect(.14,.285,.49,.41,"#071219","#748086",.10);
  for(const [x,y] of [[.369,.365],[.249,.495],[.489,.495]]) art.rect(x,y,.035,.10,"#d0d6d8");
  art.rect(.72,.15,.10,.79,"#49585f","#273d48",.03);
  for(const y of [.11,.22])art.circle(.863,y,.035,"#63787c","#34474f");
  for(let i=0;i<4;i++)art.line(.855,.66+i*.059,.94,.66+i*.059,"#3e535c",.5);
}

/** Trace the four stacked carriers, retaining distinct system and log label strips. */
function drive(art, component) {
  art.rect(.012,.04,.976,.92,"#5d666b","#303f46",.04);
  for(const x of [.075,.245,.415])for(const y of [.21,.59])art.rect(x,y,.12,.18,"#132028",undefined,.06);
  art.rect(.600,.18,.13,.66,"#90999d","#35444d",.01);
  for(let i=0;i<4;i++)art.line(.621+i*.029,.21,.621+i*.029,.80,"#40525a",.5);
  art.rect(.802,.06,.18,.88,component.label.startsWith("SYS")?"#658978":"#567f98");
  art.label(component.label,.892,.51,Math.min(5.5,component.width*.165/(component.label.length*.62)));
  art.parts.at(-1).fill="#edf1f2";
}

/** Keep the grille circular in physical pixels and hide unsupported rotor details. */
function fan(art, component) {
  const radius = Math.min(component.width, component.height) * .47;
  const rx=radius/component.width,ry=radius/component.height;
  art.polygon(Array.from({length:24},(_,i)=>[.5+rx*Math.cos(i*Math.PI/12),.5+ry*Math.sin(i*Math.PI/12)]),"#536068");
  const cell=Math.min(2.1,radius/8);
  for(let y=-radius+cell;y<radius-cell;y+=cell*1.8)for(let x=-radius+cell;x<radius-cell;x+=cell*1.8) {
    if(Math.hypot(x,y)+cell>=radius)continue;
    art.polygon(Array.from({length:6},(_,i)=>[.5+(x+cell*.85*Math.cos(i*Math.PI/3))/component.width,.5+(y+cell*.85*Math.sin(i*Math.PI/3))/component.height]),"#14242c");
  }
}

/** Draw the two exposed ground studs and supplied lug without an invented attached cable. */
function ground(art) {
  art.rect(.035,.08,.93,.84,"#bcc4c5","#58686e",.09);
  for(const x of [.29,.70]){art.circle(x,.5,.18,"#78888f","#41565f");art.circle(x,.5,.10,"#b8c2c5");}
}
