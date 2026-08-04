# Modern modal and popup system

## Goal

Modernize every transient surface without changing topology workflows or JavaScript contracts. The eight native dialogs, export popover, and toast should feel like one responsive control-room interface and remain keyboard accessible.

## Considered directions

1. **Minimal polish** — retain the square panels and only tune color, shadow, and spacing. This is low-risk but leaves weak hierarchy and cramped long dialogs.
2. **Recessed control panel** — retain the industrial visual language while introducing layered surfaces, rounded precision corners, sticky headers and actions, modern controls, responsive layouts, and restrained motion.
3. **Full glass overlay** — use highly translucent floating cards and stronger blur throughout. This is visually dramatic but reduces legibility over a dense network map and feels less like physical infrastructure tooling.

The recessed control panel direction is selected because it improves hierarchy and usability while remaining recognizably WireDraft.

## Structure and behavior

- Native `dialog` remains the modal primitive, preserving Escape handling, focus containment, and all existing element IDs.
- Every dialog has an explicit accessible title relationship and a labelled close action.
- Headers and action bars stay visible while long dialog content scrolls inside the panel.
- Narrow dialogs, wide management dialogs, and the server builder share the same surface, control, focus, and motion tokens.
- Below 640 px, multi-column forms collapse to one column, member grids collapse, action buttons wrap, and the primary action receives a full row.
- Reduced-motion preferences disable modal and popup entrance animations.

## Visual system

- Layered charcoal/teal surfaces echo rack metal and control panels.
- Cyan is reserved for focus, selected state, and primary actions; amber remains advisory.
- Inputs use 42 px targets, visible hover/focus states, softened 10 px corners, and consistent label rhythm.
- Notes and advisories become structured inset callouts instead of loose paragraphs.
- The export menu becomes a real anchored popover, while the toast becomes a compact non-interactive status capsule.
- The export popover always expands below its toolbar trigger. A completed export closes it and restores focus to the trigger; failed asynchronous exports leave it open so the action can be retried.

## Verification

- A static UI contract test checks that all dialogs use the shared class, title linkage, and labelled close control.
- The contract also covers the export popover, toast semantics, responsive rule, backdrop, and reduced-motion handling.
- Browser screenshots cover a standard form dialog, the VLAN manager, the server builder, and the export popover at desktop and narrow viewport sizes.
