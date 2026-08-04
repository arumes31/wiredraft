# Link-group hover highlighting

## Goal

Hovering any member of a Trunk, LACP, MC-LAG, or Failover group highlights every live member path. Ungrouped cables keep their existing single-link hover behavior, and hover never changes the persistent selection.

## Design

Canvas layout builds one shared `Set` of live link IDs for each logical group and indexes that set by every member ID. The hover hot path therefore resolves group focus with a constant-time lookup and reuses the existing full-path highlight and unrelated-cable dimming pipeline.

Stale group IDs are excluded from the index. A topology-scan fallback preserves behavior for lightweight tests and callers that invoke hover focus before a full scene layout.

## Verification

Regression coverage checks group expansion, cached-set reuse, and unchanged single-link focus for ungrouped cables.
