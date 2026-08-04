# Front/rear cable channel segregation

## Outcome

Front patch cords and rear structured cabling are separate routing planes, not
two paint styles sharing the same geometry. Front cables retain the primary
gutter nearest each rack. Rear mappings leave patch panels toward the outer
rack edge and occupy a reserved backend lane bank beyond every possible front
lane in that gutter.

## Routing model

- Every link receives a `front` or `rear` routing-plane value. Any endpoint on
  the rear side makes the complete physical run a rear/backend link.
- Device-pair bundles include the routing plane in their bundle key, preventing
  front and rear runs from being merged into one trunk lane sequence.
- The batch planner counts the maximum front-link occupancy per rack and free
  device before assigning tracks. Rear gutter ordinals start after that entire
  reserved front range plus a channel gap. This mathematically prevents a front
  and rear vertical route from receiving the same X coordinate.
- Rear links between racks use outer rack gutters and a perimeter bridge rather
  than an inter-rack primary channel. Their endpoint side is the outer-facing
  edge of the rack set, so the first on-faceplate turn heads directly toward the
  rear/structured-wiring channel.

## Visual hierarchy and interaction

- Rear links are ordered and painted before all front links in both Canvas and
  SVG export paths.
- Rear runs use a thin amber `6 4` dash at 75% opacity. Front runs retain their
  speed, role, VLAN, and outline styling.
- Jumper bows are only assigned to horizontal front paths. A front horizontal
  path receives the bow when crossing a rear vertical path; a front vertical
  path simply paints later and remains visually above a rear horizontal path.
- Hovering a rear link, patch-panel port, or patch-panel device activates rear
  isolation: all front cables render at 10% of their normal opacity while rear
  runs remain readable. Rear hover emphasis is painted before the front layer,
  preserving the layer contract even during interaction.

## Verification

- Routing tests assert separate bundle keys, distinct X tracks, outer-facing
  rear exits, and rear gutters beyond the complete front bank.
- Crossing tests assert rear routes never own bows and front routes retain bow
  ownership over backend crossings.
- Interaction and export tests assert the 10% isolation rule, rear-first layer
  order, and shared dash/opacity styling.
