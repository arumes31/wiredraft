# Adaptive graphics and cable rendering performance

## Goal

Reduce Canvas/GPU use substantially—especially for dense cabling—without removing the topology's physical detail or forcing one visual compromise on every workstation.

## Observed bottlenecks

- The complete canvas redraws at unrestricted display refresh rate even when nothing changes.
- Layout boxes, port maps, obstacle signatures, crossing bridges, labels, shadows, LEDs, VLAN bands, and cable pulses are processed during every frame.
- High-DPI backing buffers are always allowed up to 2.5× device pixels.
- Rendering continues when the canvas is outside the visible page area.

## Selected design

All modes share event-driven invalidation and scene/route caching. A persistent graphics selector controls only genuinely expensive visual effects:

- **Auto:** selects a profile from topology size, port/link counts, device memory, CPU concurrency, and display pixel ratio.
- **Performance:** static idle canvas, 1× pixels, no pulses/blinking/glows/shadows, coarse device texture, and major grid only.
- **Balanced:** static while idle; focused cables animate at 24 FPS, 1.5× pixels, reduced faceplate texture, and no device shadows.
- **Quality:** all cable/LED animation at a capped 45 FPS, 2.25× pixels, full faceplate detail and shadows.

Reduced-motion preference always resolves to Performance. Rendering also suspends when the document or canvas is not visible.

## Cache and scheduling contract

- Topology mutations invalidate layout and route geometry; selection and analysis changes only request a repaint.
- Route cache entries retain both the obstacle-aware base route and crossing-bridge curve for the current scene revision.
- Camera movement repaints but does not rebuild physical layout or cable routing.
- Idle Performance and Balanced views perform no canvas drawing until state, pointer, camera, resize, or visibility changes.
- PNG/PDF export always uses the full-quality renderer independently of the interactive preference.

## Verification

- Pure browser-module tests cover mode normalization, automatic thresholds, reduced-motion behavior, animation activation, effect scope, persistent UI wiring, and summaries.
- Existing routing, hover, VLAN color, faceplate, export, and interaction tests protect visual behavior.
- Full Go/browser/race/vet verification and a rebuilt healthy Docker service complete the rollout.
