# Annotation selection and deletion

## Problem

Canvas annotations were rendered and persisted but did not participate in hit testing or application selection. The drawing toolbar also treated every annotation button as a permanently active mode; `Escape` cancelled only the current pointer operation.

## Design

- In Select mode, hit-test annotations from front to back. Text uses its rendered label bounds, arrows use point-to-segment distance, and rectangles use only their visible edges. A small zoom-adjusted tolerance keeps narrow strokes usable without blocking unrelated objects inside a rectangle.
- Store annotation selection in the existing `AppState.selection` union as `{ type: "annotation", id }`.
- Render selected annotations with the existing industrial cyan selection language, a restrained glow, a dashed outline, and endpoint handles. Selection decoration is excluded from exports.
- Show an annotation inspector for text/color editing and deletion. `Delete`/`Backspace` removes the selected annotation through `AppState.commit`, preserving Undo and marking autosave dirty.
- Clicking the already active drawing tool toggles back to Select. `Escape` calls the same tool transition, keeping canvas cursor and toolbar `aria-pressed` state synchronized.

## Verification

Interaction tests cover tool toggling and annotation priority over objects behind its visible stroke. Existing canvas, export, autosave, model, and browser workflows remain regression gates.
