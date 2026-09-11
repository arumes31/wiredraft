import {addMerakiAdvancedHardware} from "./hardware-meraki-advanced-components.js";

/** Reuse only source-matching modular hardware and add observed MS425 angular handles and inverted optical cages. */
export function addMerakiAggregationHardware(art,component){
  const variant=component.variant||component.kind;if(typeof variant!=="string"||!variant.startsWith("meraki-aggregation-"))return false;
  const reuse={"meraki-aggregation-250w":"meraki-advanced-715w","meraki-aggregation-cover":"meraki-advanced-psu-cover","meraki-aggregation-fan":"meraki-advanced-fan"}[variant];
  if(reuse)return addMerakiAdvancedHardware(art,{...component,variant:reuse});
  if(variant==="meraki-aggregation-sfp-up"||variant==="meraki-aggregation-qsfp-up"){
    art.rect(.025,.035,.95,.93,"#41575d","#9baaaa",.055);art.rect(.1,.26,.8,.56,"#192b32","#a7b2b5",.02);art.line(.15,.72,.85,.72,"#74878d",.7);art.rect(.27,.13,.46,.13,"#52666a","#a7b2b5",.02);
    const count=variant.includes("qsfp")?4:2;for(let i=0;i<count;i++)art.rect(.18+i*.58/Math.max(1,count-1),.52,.045,.12,"#899b96",undefined,.006);return true;
  }
  if(variant==="meraki-aggregation-425-fan"){
    art.rect(.02,.025,.96,.95,"#788788","#253d46",.02);art.circle(.5,.45,.40,"#253940","#c5d0cc");
    for(let row=0;row<5;row++)for(let col=0;col<5-row%2;col++){
      const x=.10+col*.16+row%2*.08,y=.08+row*.145;art.polygon([[x+.07,y],[x+.14,y+.04],[x+.14,y+.12],[x+.07,y+.16],[x,y+.12],[x,y+.04]],"#1f3037","#9cadad");
    }
    art.polygon([[.05,.34],[.20,.44],[.46,.80],[.42,.95],[.19,.84],[.09,.58]],"#547b83","#304952");art.polygon([[.95,.34],[.80,.44],[.54,.80],[.58,.95],[.81,.84],[.91,.58]],"#547b83","#304952");art.rect(.35,.76,.30,.20,"#536d73","#30434b",.05);return true;
  }
  return false;
}
