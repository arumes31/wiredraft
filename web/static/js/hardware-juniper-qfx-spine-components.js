import {addJuniperQFXNextComponent} from "./hardware-juniper-qfx-next-components.js";
import {addJuniperEXCoreComponent} from "./hardware-juniper-ex-core-components.js";

const sharedNext={"juniper-qfx-spine-mesh":"juniper-qfx-next-mesh","juniper-qfx-spine-status4":"juniper-qfx-next-status4","juniper-qfx-spine-status3":"juniper-qfx-next-status3",
  "juniper-qfx-spine-smb":"juniper-qfx-next-smb","juniper-qfx-spine-ear":"juniper-qfx-next-ear","juniper-qfx-spine-latch":"juniper-qfx-next-latch","juniper-qfx-spine-grille":"juniper-qfx-next-psu-grille",
  "juniper-qfx-spine-ejector":"juniper-qfx-next-ejector","juniper-qfx-spine-pullout":"juniper-qfx-next-pullout","juniper-qfx-spine-fan5200":"juniper-qfx-next-fan5120",
  "juniper-qfx-spine-fan5220":"juniper-qfx-next-fan5130","juniper-qfx-spine-c16-1600":"juniper-qfx-next-c16-portrait"};

/** Dispatch only independently inspected QFX5200/5210/5220 source artwork;5220 shares exact fan/PSU parts with5130. */
export function addJuniperQFXSpineComponent(art,c) {
  const v=c.variant||c.kind;if(sharedNext[v])return addJuniperQFXNextComponent(art,{...c,kind:sharedNext[v],variant:undefined});
  if(v==="juniper-qfx-spine-c14-850")return addJuniperEXCoreComponent(art,{...c,kind:"juniper-ex-core-c14-portrait",variant:undefined});
  if(v==="juniper-qfx-spine-c16-1100")return addJuniperEXCoreComponent(art,{...c,kind:"juniper-ex-core-c16-portrait",variant:undefined});
  if(v==="juniper-qfx-spine-status1")return addJuniperEXCoreComponent(art,{...c,kind:"juniper-ex-core-status1",variant:undefined});
  if(v==="juniper-qfx-spine-fan5210")fan5210(art,c);
  else if(v==="juniper-qfx-spine-ear5210")ear5210(art,c);
  else if(v==="juniper-qfx-spine-pullout5210") {art.rect(.02,.02,.96,.96,"#e3b42d","#a78b35",.025);art.line(.14,.48,.86,.48,"#f4d876");}
  else return false;return true;
}

/** Draw5210's tall honeycomb fan module with a horizontal gold extraction handle and right-side fastener, without invented crossed braces. */
function fan5210(art,c) {
  art.rect(.01,.01,.98,.98,"#8c9690","#4e5e52",.02);addJuniperQFXNextComponent(art,{...c,kind:"juniper-qfx-next-mesh",variant:undefined});
  art.rect(.02,.33,.96,.065,"#bc8149","#77542f",.025);art.circle(.92,.365,.055,"#a6b1a6","#4b594e");art.line(.89,.365,.95,.365,"#4b594e");
  art.rect(.83,.21,.15,.07,"#b98a50","#6a5635",.01);art.label("OUT",.90,.245,Math.min(4,c.height*.05));
}

/** Draw the supplied5210 two-unit bracket's five round holes from the rack installation drawing. */
function ear5210(art,c) {
  const radius=Math.min(c.width*.21,c.height*.065)/Math.min(c.width,c.height);
  art.rect(.01,.01,.98,.98,"#87948c","#4a5d4e",.02);for(const y of [.08,.26,.50,.74,.92])art.circle(.50,y,radius,"#263c2d","#a4b3a9");
}
