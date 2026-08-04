# Device, port, and link hover comments

> Inspector workflow superseded by [Persistent inspector plan comments](./2026-08-04-inspector-plan-comments-design.md). The persistent anchor model and hover behavior described here remain current; comment editing no longer opens the Collaboration dialog.

## Problem

The collaboration model already persists threaded comments, but operators can only anchor them to the canvas, a device, or a link. Port selections fall back to a canvas coordinate, comment creation is only discoverable through the global collaboration dialog, and canvas hover bubbles do not expose the operational notes attached to the object under the pointer.

## Approaches considered

1. Add `comments` arrays directly to every device, port, and link. This makes hover lookup simple, but duplicates the existing threaded collaboration model and creates two lifecycles for replies, resolution, deletion, sharing, and reference cleanup.
2. Keep `CommentThread` as the single source of truth and add a validated `port` anchor. This reuses the existing API, revision checks, sharing, resolution, and deletion behavior while allowing a small client-side index/filter for hover rendering.
3. Store hover notes only in browser state. This avoids backend work, but the notes would not collaborate, export with topology data, or survive another browser session.

Approach 2 is selected.

## Interaction design

- Device, port, and link inspectors show a compact comments section with open/resolved counts, a short recent preview, and an **ADD COMMENT** action.
- The action opens the existing collaboration dialog at the selected object and focuses the comment editor. The active anchor uses a human-readable device/port/link label.
- Hovering a device, port, or cable appends up to two most-recent open thread messages to the existing pointer-following speech bubble. The link preview is part of the existing endpoint/link hover bubble, not a separate overlay.
- Hover previews are canvas-rendered and therefore cannot intercept pointer input. Resolved threads remain available in the collaboration dialog but do not clutter normal hover inspection.
- Comment bodies are flattened to one line and bounded before drawing; additional threads are summarized as `+N MORE`.

## Data and validation

- Add `CommentAnchorPort = "port"`.
- Validate port anchors against the topology's global port-ID map.
- Remove port-anchored threads when their owning device is removed, alongside the existing device/link cleanup.
- Keep the existing comment endpoints and JSON schema shape; clients only send the new anchor kind.

## Verification

- Model tests accept known port anchors and reject unknown ones.
- Handler tests create device, port, and link comments and verify reference pruning.
- Browser-independent JavaScript tests cover anchor filtering, unresolved sorting, body truncation, and selection-to-anchor mapping.
- Existing collaboration, canvas, and cross-browser workflow tests remain green; the Docker service remains healthy for interactive testing.
