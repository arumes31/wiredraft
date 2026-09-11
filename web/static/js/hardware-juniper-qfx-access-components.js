import {addJuniperEXCoreComponent} from "./hardware-juniper-ex-core-components.js";

const shared={"juniper-qfx-access-c14-portrait":"juniper-ex-core-c14-portrait","juniper-qfx-access-psu-grille":"juniper-ex-core-psu4600-grille",
  "juniper-qfx-access-fan5100":"juniper-ex-core-fan4600","juniper-qfx-access-fan5110":"juniper-ex-core-fan4600","juniper-qfx-access-mesh":"juniper-ex-core-mesh",
  "juniper-qfx-access-status4":"juniper-ex-core-status4","juniper-qfx-access-status3":"juniper-ex-core-status3","juniper-qfx-access-latch":"juniper-ex-core-latch","juniper-qfx-access-ear":"juniper-ex-core-ear"};

/** Reuse personally inspected identical650W PSU/guard art; keep QFX5110's distinct fan SKU in model metadata. */
export function addJuniperQFXAccessComponent(art,c) {
  const v=c.variant||c.kind;if(shared[v])return addJuniperEXCoreComponent(art,{...c,kind:shared[v],variant:undefined});
  if(v==="juniper-qfx-access-ear5110") {art.rect(.01,.01,.98,.98,"#6b7970","#344b3c",.025);art.circle(.5,.5,.30,"#a8b4ad","#52695a");art.circle(.5,.5,.21,"#7e9284","#c6d0c9");art.line(.35,.5,.65,.5,"#304b38");art.line(.5,.44,.5,.56,"#304b38");return true;}
  if(v!=="juniper-qfx-access-smb")return false;
  // The source timing output is a small circular SMB jack, not a video BNC bayonet or Ethernet port.
  art.circle(.5,.5,.47,"#ba994c","#715b2f");art.circle(.5,.5,.34,"#cbb46f","#f0dba3");art.circle(.5,.5,.23,"#473b20","#a89350");art.circle(.5,.5,.065,"#e2ca83","#756331");
  return true;
}
