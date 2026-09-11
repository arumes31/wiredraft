import { addPA3410Hardware } from "./hardware-pa3410-components.js";
import { addPA5220Hardware } from "./hardware-pa5220-components.js";

/** Render only the selected PA-5410's source-specific hardware or shared identical details. */
export function addPA5410Hardware(art,component) {
  switch(component.variant) {
    case "pa5410-mesh": return addPA3410Hardware(art,{...component,variant:"pa3410-mesh"});
    case "pa5410-drive-cover": return addPA3410Hardware(art,{...component,variant:"pa3410-drive-cover"});
    case "pa5410-ground": return addPA5220Hardware(art,{...component,variant:"pa5220-ground"});
    case "pa5410-ac": supply(art); break;
    case "pa5410-fan": fan(art,component); break;
    default:return false;
  }
  return true;
}

/** Trace the upright C14 inlet, vertical handle and blue release latch of the1200W supply. */
function supply(art) {
  art.rect(.022,.025,.956,.95,"#b3b9bc","#5a686e",.04);
  art.rect(.10,.265,.59,.49,"#556268","#65747b",.10);
  art.polygon([[.13,.375],[.24,.305],[.54,.305],[.65,.375],[.65,.695],[.13,.695]],"#09151d","#687e88");
  for(const [x,y]of [[.369,.385],[.232,.497],[.506,.497]])art.rect(x,y,.033,.095,"#d0d6d8");
  art.rect(.730,.10,.15,.82,"#687982","#3e525e",.04);
  art.circle(.914,.23,.029,"#71868a","#4c626b");art.circle(.914,.35,.029,"#71868a","#4c626b");
  art.rect(.888,.68,.082,.245,"#347391",undefined,.025);
  for(let i=0;i<4;i++)art.line(.910,.727+i*.048,.971,.727+i*.048,"#183f56",.6);
}

/** Keep each visible fan grille circular and its diagonal pull handle inside the assembly. */
function fan(art,component) {
  art.rect(.018,.008,.964,.984,"#70787d","#52626a",.025);
  const radius=Math.min(component.width*.47,component.height*.445),cx=component.width/2,cy=component.height*.49;
  const circle=Array.from({length:32},(_,i)=>[(cx+radius*Math.cos(i*Math.PI/16))/component.width,(cy+radius*Math.sin(i*Math.PI/16))/component.height]);
  art.polygon(circle,"#31434d","#aab5b9");
  const cell=Math.min(2.1,radius/9);
  for(let y=-radius+cell;y<radius-cell;y+=cell*1.8)for(let x=-radius+cell;x<radius-cell;x+=cell*1.8) {
    if(Math.hypot(x,y)+cell>=radius)continue;
    art.polygon(Array.from({length:6},(_,i)=>[(cx+x+cell*.85*Math.cos(i*Math.PI/3))/component.width,(cy+y+cell*.85*Math.sin(i*Math.PI/3))/component.height]),"#13232d");
  }
  const angle=Math.PI/7,dx=Math.cos(angle),dy=Math.sin(angle),half=radius*.89,thickness=radius*.115;
  art.polygon([[-half,-thickness],[half,-thickness],[half,thickness],[-half,thickness]].map(([along,across])=>[(cx+along*dx-across*dy)/component.width,(cy+along*dy+across*dx)/component.height]),"#b2bec3","#425966");
  art.circle(.090,.083,.034,"#abb8be","#465d68");
  art.rect(.46,.954,.08,.018,"#aab8bd",undefined,.008);
}
