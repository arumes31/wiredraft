# Automatic link endpoint status

## Goal

When a cable is successfully patched or unplugged, both physical endpoint ports must immediately and persistently reflect the connection: `up` while linked and `down` once unlinked.

## Considered approaches

1. Issue two port-update requests from the browser after creating the cable. This can expose a partial state when one request fails or another client updates the topology concurrently.
2. Append the cable and activate both ports in the link-creation store mutation. This keeps validation, persistence, the API response, and the Server-Sent Event atomic.
3. Infer `up` only while rendering a connected port. This would make the persisted status disagree with the visible topology and manual port editing.

The second approach is selected.

## Behavior

- A successful link creation sets its source and target port status to `up` in the same topology mutation that stores the cable.
- The returned topology and the `link_created` event already include both activated endpoints, so the browser needs no follow-up requests.
- If the link is invalid or either endpoint is already occupied, validation rejects the complete mutation and neither port changes.
- A successful link deletion removes the cable first, then sets each removed endpoint to `down` when no remaining link references that port. Link-group pruning, validation, persistence, the API response, and the `link_deleted` event all observe the same state.
- If the requested link does not exist or persistence fails, the cloned mutation is discarded and no port status changes.

## Verification

- A handler test creates a valid cable between two down ports and verifies both the response and a subsequent read contain `up` endpoints.
- A rollback test attempts to connect an occupied endpoint and verifies both down states remain persisted.
- A handler test deletes a valid cable and verifies both the response and a subsequent read contain `down` endpoints.
- A rollback test deletes a missing link and verifies the existing connected endpoints remain `up`.
- The full Go, browser-module, race, and vet suites remain green.
