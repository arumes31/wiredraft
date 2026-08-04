# Link direction in the Inspector

## Goal

Allow operators to reverse the saved Source/Target ordering of any front or rear physical link from its Link Inspector. The changed ordering must be reflected consistently in the inspector, exports, tooltips, and routing without changing link identity or logical-group membership.

## Design

The existing endpoint ordering remains the source of truth; no separate direction enum is introduced. Both Link Inspector variants expose a **Reverse link direction** action that swaps source and target. The client sends the current target port as the desired source to a dedicated `PUT .../direction` endpoint.

The endpoint is idempotent: requesting the existing source is a no-op, requesting the existing target atomically swaps the device ID, port ID, and endpoint side, and any other port is rejected. The normal topology mutation pipeline validates and persists the result. Link IDs, VLAN configuration, cable metadata, group membership, and failover roles remain unchanged.

## Verification

Backend tests cover complete endpoint swaps, endpoint-side preservation, retry idempotence, and rejection of non-endpoint source IDs. Frontend contract coverage verifies that both front and rear inspectors expose the action and call the dedicated API.
