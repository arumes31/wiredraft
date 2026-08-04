# Persistent inspector plan comments

## Problem

Device, port, and link comments are already stored inside the topology aggregate, but the inspector only exposes a short preview. Creating, resolving, or deleting a comment requires opening the global Collaboration dialog, which makes a persistent plan property look like a separate collaboration product.

## Selected design

Keep `Topology.commentThreads` and the existing comment API as the single persistent source of truth. This preserves every existing comment, reply, anchor, timestamp, and resolved state without a schema migration. Move the complete workflow into the selected device, port, or link inspector:

- show all active and resolved threads for the selected object;
- show every stored message rather than truncating the inspector to a preview;
- add a comment inline with author and body fields;
- resolve, reopen, or delete a thread without leaving the inspector;
- explain that comments are saved with the map and included in JSON backups.

The canvas hover preview remains lightweight and read-only. Its helpers move from `collaboration.js` to `plan-comments.js` so code ownership matches the product model.

## Resource panel

The former `COLLAB` entry becomes `RESOURCES`. Its dialog contains only attached documentation and read-only share links. Live revision events remain an application synchronization mechanism, including comment changes, but they no longer determine where comments are presented or stored.

## Verification

- Unit tests cover plan anchor selection, ordering/filtering, compact hover previews, resources-dialog ownership, and persistent API wiring.
- The browser workflow creates a device comment directly in the inspector, reloads it from the topology API, then verifies documentation and read-only sharing in the separate Resources dialog.
- Go validation and handler tests continue proving that comment threads are part of the saved topology and are pruned when their selected object is removed.
