# Pointer hover speech bubbles

Hover details for physical ports and cables are rendered as canvas speech bubbles anchored to the current pointer position. The panel stays sixteen screen pixels away from the pointer, flips left or above near viewport edges, and uses a small triangular tail to retain the association with the hovered target.

The bubble is drawn in screen space after the world-space topology has rendered. This keeps its text and offset stable at every zoom level. It is not a DOM element and therefore cannot receive pointer events or interfere with the existing port, cable, rack, or empty-canvas hit testing. Selected-link and exported labels retain their existing route-based placement; only transient hover details follow the pointer.

Placement is implemented as a pure helper and tested at central and bottom-right pointer positions. Canvas behavior is verified through JavaScript syntax checks, the browser-module test suite, and the existing Go tests before rebuilding the long-running Docker service.
