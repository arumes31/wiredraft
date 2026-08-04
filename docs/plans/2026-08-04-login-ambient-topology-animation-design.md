# Ambient topology animation for secure access

## Direction

The login page keeps its industrial identity-gateway layout and gains a dedicated Canvas 2D background renderer. It does not import the editor, fetch topologies, expose real plan data, or accept pointer input. Each cycle creates a synthetic rack room, assembles the rack frames, installs a varied set of miniature switches, firewalls, patch panels, and servers, then draws individual orthogonal links into their port sockets.

The scene is intentionally architectural rather than decorative noise: equipment appears at valid rack positions, high-density devices expose two port rows, link LEDs become steadily green after connection, and cables use separate gutter lanes. Randomized rack counts, device combinations, colors, and paths make successive cycles distinct while the login console remains the visual foreground.

## Motion and performance

One canvas covers the viewport behind both login columns. The identity panel uses translucent gradients while the credential console remains strongly opaque for legibility. A cycle lasts roughly sixteen seconds: rack construction, device installation, cable connection, a short completed hold, and a soft scene replacement.

Rendering is capped at 24 frames per second and device pixel ratio is capped at 1.5. The loop stops while the page is hidden. Resize events rebuild the synthetic scene at the new dimensions. `prefers-reduced-motion` renders one completed static rack room and schedules no animation frames. The canvas is `aria-hidden`, cannot receive focus, and uses `pointer-events: none` so it never blocks login controls.

## Verification

Pure scene-generation tests assert that racks and devices remain inside their bounds, every cable contains only horizontal and vertical segments, and partial cable drawing preserves Manhattan geometry. UI contracts assert the non-interactive canvas and reduced-motion behavior. Playwright verifies that the animation renders without affecting accessibility or Guest login.

## Procedural variation

Every page load and sixteen-second rebuild uses fresh browser entropy. The bounded generator varies rack count, width, height, capacity, color family, equipment inventory, labels, port density, empty space, endpoint selection, link direction, link role, and cross-rack density. Each rack still contains core switch and patching roles, all devices stay within their rack, connected ports alone receive steady green LEDs, and generated cables remain strictly orthogonal. Reduced-motion mode receives one equally randomized but static completed scene.
