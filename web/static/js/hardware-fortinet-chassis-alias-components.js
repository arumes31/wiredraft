/** Render only the selected6301F generation2 PSU, including its keyed C16 and gray toothed latch. */
export function addFortinetChassisAliasComponent(a,c){
 if(c.variant!=="fortinet-chassis-alias-c16-gen2")return false;
 a.rect(.01,.01,.94,.98,"#9ba2a3","#4f595c",.02);
 for(let y=0;y<7;y++)for(let x=0;x<6;x++)a.rect(.04+x*.14,.04+y*.13,.12,.10,"#495458",undefined,.01);
 a.rect(.06,.13,.57,.65,"#737b7e","#333c40",.06);
 a.polygon([[.12,.29],[.22,.20],[.49,.20],[.58,.29],[.58,.69],[.12,.69]],"#10191e","#929b9e");
 for(const [x,y] of [[.35,.34],[.21,.49],[.49,.49]])a.rect(x-.024,y-.07,.048,.14,"#bac2c5",undefined,.005);
 a.circle(.35,.63,.047,"#78858b","#3d494e");a.rect(.68,.05,.085,.89,"#455358","#a5b0b3",.04);
 a.circle(.83,.87,.032,"#59666b","#3e4b50");a.rect(.90,.72,.07,.26,"#8e9395","#596267",.01);
 for(let n=0;n<5;n++)a.line(.94,.75+n*.047,.99,.75+n*.047,"#475155");return true;
}
