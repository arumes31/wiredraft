/** Draw only the inspected fixed-cooling grille and22-contactRPS fitting for Meraki access switches. */
export function addMerakiAccessHardware(art,component){
  if(component.variant==="meraki-access-grille"){
    const columns=10,dx=.94/columns,rx=dx*.39,ry=rx*component.width/component.height,dy=ry*2.1;
    for(let row=0;row<Math.floor(.92/dy);row++)for(let col=0;col<columns-row%2;col++){
      const cx=.03+(col+.5+row%2*.5)*dx,cy=.04+(row+.5)*dy;
      art.polygon(Array.from({length:6},(_,i)=>[cx+rx*Math.cos(i*Math.PI/3),cy+ry*Math.sin(i*Math.PI/3)]),"#29404a","#9bb0b9");
    }return true;
  }
  if(component.variant==="meraki-access-rps"){
    art.rect(.01,.05,.98,.90,"#a9b9bf","#526a76",.02);art.rect(.13,.13,.74,.75,"#738b96","#d6e1e3",.01);
    for(let row=0;row<2;row++)for(let col=0;col<11;col++){
      const x=.155+col*.0615,y=.22+row*.30;art.rect(x,y,.051,.25,"#b8c7cb","#46616e",.005);art.rect(x+.015,y+.08,.021,.09,"#253d4a","#8ea4af",.004);
    }
    for(const x of [.08,.92])art.circle(x,.50,.038,"#778e99","#344f60");return true;
  }
  return false;
}
