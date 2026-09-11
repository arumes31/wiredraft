/** Draw only the inspected UPS bezel, control panel, fan guard and power/monitoring socket variants. */
export function addAPCComponent(art, component) {
  const variant = component.variant;
  if (component.kind === "apc-c14" || variant === "apc-c13") {
    const outlet = variant === "apc-c13";
    art.rect(.03, .025, .94, .95, "#525d61", "#0b1519", .04);
    art.polygon([[.23,.12],[.77,.12],[.89,.29],[.89,.82],[.11,.82],[.11,.29]], "#10181c", "#a5b1b3");
    for (const [x,y] of [[.5,.31],[.3,.64],[.7,.64]]) art.rect(x-.044,y-.07,.088,.14,outlet?"#010608":"#aeb9bb",undefined,.003);
  } else if (variant === "apc-usb-b") {
    art.rect(.03,.03,.94,.94,"#aeb9bb","#172126",.02);
    art.polygon([[.27,.16],[.73,.16],[.87,.34],[.87,.84],[.13,.84],[.13,.34]],"#0c151a","#63757d");
    art.rect(.34,.45,.32,.20,"#97a5a9");
  } else if (variant === "apc-breaker") {
    art.circle(.5,.5,.46,"#768185","#273236");
    art.circle(.5,.5,.30,"#1c2529","#a5afb2");
  } else if (variant === "apc-smt-fan") {
    const r = Math.min(component.width, component.height) * .45;
    const rx = r / component.width, ry = r / component.height;
    art.circle(.5,.5,.47,"#111a1d");
    for (const scale of [.38,.60,.81,1]) art.circle(.5,.5,.45*scale,undefined,"#8b989c");
    for (const [x1,y1,x2,y2] of [[.5-rx,.5,.5+rx,.5],[.5,.5-ry,.5,.5+ry]]) art.line(x1,y1,x2,y2,"#8b989c");
  } else if (variant === "apc-smt-bezel") {
    art.rect(.005,.015,.99,.97,"#1d2428","#465359",.025);
    for (let row=0;row<10;row++) art.rect(.035,.08+row*.08,.705,.035,"#080f12",undefined,.008);
    art.label("APC",.10,.40,9);
  } else if (variant === "apc-smt-display") {
    art.rect(.025,.025,.95,.95,"#172125","#576267",.035);
    art.rect(.09,.38,.82,.23,"#273736","#687872",.015);
    for (let i=0;i<4;i++) art.rect(.16+i*.20,.24,.06,.035,"#4f5e53");
    art.circle(.5,.12,.048,"#2e3a3d","#6b787c");
    for (const x of [.1,.53]) for (const y of [.70,.84]) art.rect(x,y,.35,.08,"#303c40","#526066",.012);
  } else return false;
  return true;
}
