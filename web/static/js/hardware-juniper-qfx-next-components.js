import {addJuniperQFXAccessComponent} from "./hardware-juniper-qfx-access-components.js";

const shared={"juniper-qfx-next-mesh":"juniper-qfx-access-mesh","juniper-qfx-next-status4":"juniper-qfx-access-status4","juniper-qfx-next-status3":"juniper-qfx-access-status3",
  "juniper-qfx-next-smb":"juniper-qfx-access-smb","juniper-qfx-next-ear":"juniper-qfx-access-ear5110","juniper-qfx-next-latch":"juniper-qfx-access-latch","juniper-qfx-next-psu-grille":"juniper-qfx-access-psu-grille"};

/** Dispatch only the two selected QFX models' source-traced parts; reuse common mesh/status/SMB and inspected rack thumbscrew primitives. */
export function addJuniperQFXNextComponent(art,c) {
  const v=c.variant||c.kind;if(shared[v])return addJuniperQFXAccessComponent(art,{...c,kind:shared[v],variant:undefined});
  if(v==="juniper-qfx-next-c14-portrait")inlet(art,false);
  else if(v==="juniper-qfx-next-c16-portrait")inlet(art,true);
  else if(v==="juniper-qfx-next-fan5120"||v==="juniper-qfx-next-fan5130")fan(art,c);
  else if(v==="juniper-qfx-next-ejector") {art.rect(.02,.02,.96,.96,"#67706b","#2f3832",.04);art.line(.25,.12,.25,.88,"#98a098");}
  else if(v==="juniper-qfx-next-pullout") {art.rect(.02,.02,.96,.96,"#86b8be","#647d7e",.025);art.line(.14,.48,.86,.48,"#c1d2d0");}
  else return false;return true;
}

/** Draw5120's left-keyed AO650W inlet and5130's right-keyed1600W inlet with opposite-earth hot key and the fig44 retaining ring. */
function inlet(art,hot) {
  art.rect(.01,.01,.98,.98,"#616d67","#27372d",.025);
  const outline=hot?[[.13,.10],[.64,.10],[.87,.25],[.87,.75],[.64,.90],[.13,.90],[.13,.58],[.31,.58],[.31,.42],[.13,.42]]:[[.13,.25],[.35,.10],[.88,.10],[.88,.90],[.35,.90],[.13,.75]];
  art.polygon(outline,"#16201a","#a5b3ab");for(const [x,y] of hot?[[.43,.27],[.66,.50],[.43,.73]]:[[.65,.27],[.40,.50],[.65,.73]])art.rect(x-.09,y-.025,.18,.05,"#c5ced1",undefined,.003);
  if(hot) {
    const outer=[],inner=[];for(let n=0;n<=20;n++){const a=-Math.PI*.15+n*Math.PI*1.7/20;outer.push([.49+Math.cos(a)*.36,.58+Math.sin(a)*.29]);inner.unshift([.49+Math.cos(a)*.29,.58+Math.sin(a)*.23]);}
    art.polygon([...outer,...inner],"#a0aaa4","#56675b");art.rect(.18,.80,.23,.07,"#b0b9b3","#647167",.01);
  }
}

/** Trace the inspected orange honeycomb fan carriers, opposing extraction tabs, AIR OUT panel and upper fastener shown on both selected fan SKUs. */
function fan(art,c) {
  art.rect(.01,.01,.98,.98,"#be713c","#604b36",.035);
  addJuniperQFXAccessComponent(art,{...c,kind:"juniper-qfx-access-mesh",variant:undefined});
  art.polygon([[.03,.08],[.18,.08],[.94,.85],[.93,.94],[.79,.91],[.04,.23]],"#d08a51","#80552f");
  art.polygon([[.97,.08],[.82,.08],[.06,.85],[.07,.94],[.21,.91],[.96,.23]],"#d08a51","#80552f");
  for(const x of [.035,.845])art.rect(x,.39,.12,.27,"#bc7d45","#745332",.02);
  art.rect(.28,.41,.44,.23,"#a8b1a4","#56654c",.015);art.label("AIR OUT",.5,.525,Math.min(5,c.height*.1));
  art.circle(.14,.13,.055,"#484d42","#b8b8a8");art.line(.11,.13,.17,.13,"#929688");
}
