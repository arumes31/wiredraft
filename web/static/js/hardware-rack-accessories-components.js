/** Draw rack accessory assemblies and keyed power connectors with shared Canvas/SVG geometry. */
export function addRackAccessoryComponent(art, component) {
  const { kind, variant } = component;
  if (kind === "rack-schuko") {
    art.circle(.5, .5, .47, "#191e20", "#737b80");
    art.circle(.5, .5, .35, "#30383b", "#05090b");
    for (const x of [.32, .68]) art.circle(x, .5, .063, "#05090b");
    for (const y of [.12, .79]) art.rect(.43, y, .14, .09, "#b5bdc0", undefined, .01);
  } else if (["rack-c13", "rack-c19", "rack-c20"].includes(kind)) {
    art.rect(.025, .035, .95, .93, "#788185", "#172126", .05);
    const c13 = kind === "rack-c13";
    if (c13) art.polygon([[.25,.15],[.75,.15],[.87,.34],[.87,.84],[.13,.84],[.13,.34]], "#101719");
    else art.rect(.13, .16, .74, .68, "#101719", undefined, .035);
    for (const [x, y] of [[.5,.32],[.31,.64],[.69,.64]]) art.rect(x - (c13 ? .035 : .075), y - (c13 ? .10 : .035),
      c13 ? .07 : .15, c13 ? .20 : .07, kind === "rack-c20" ? "#b5bdc0" : "#020406", undefined, .004);
  } else if (kind === "rack-dc-barrel") {
    art.circle(.5, .5, .45, "#526168", "#16262e"); art.circle(.5, .5, .33, "#071116"); art.circle(.5, .5, .075, "#b7c0c3");
  } else if (variant === "rack-accessory-mount-hole") {
    art.rect(.12, .08, .76, .84, "#101719", undefined, .35);
  } else if (variant === "rack-accessory-silver") {
    art.rect(0, 0, 1, 1, "#aeb3ba");
  } else if (variant === "rack-accessory-seh-status") {
    art.rect(0, 0, 1, 1, "#d3d5d8"); art.rect(.025, .035, .95, .93, undefined, "#9aa3aa", .02);
    for (let i = 0; i < 12; i++) art.rect(.48 + i * .038, .64, .021, .045, "#384448", undefined, 0);
    art.label("SEH", .80, .39, 7);
  } else if (variant === "rack-accessory-seh-cover") {
    art.rect(.005, .01, .990, .98, "#387fa6", "#234d67", .012);
    art.circle(.51, .53, .16, "#bfc7ca", "#52646d"); art.circle(.51, .53, .105, "#aab6bb", "#59676e");
    art.rect(.50, .47, .014, .115, "#13232b", undefined, .004);
  } else if (variant === "rack-accessory-seh-rear") {
    art.rect(0, 0, 1, 1, "#c6c9cd");
    for (const x of [.05, .86]) art.circle(x, .16, .025, "#9ba8ae", "#63717a");
  } else return false;
  return true;
}
