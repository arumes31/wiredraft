# Link-group VLAN synchronization

## Goal

Treat the END-TO-END VLAN profile as a shared configuration when the selected cable belongs to a persistent link group. One apply action must update every group cable and every unique physical endpoint port.

## Behavior

- An ungrouped cable keeps the existing two-port configuration behavior.
- A grouped cable resolves its Trunk, LACP, MC-LAG, or Failover group from the selected link ID.
- The inspector lists every physical source-to-target member beneath the shared VLAN profile and evaluates synchronization across the entire group.
- The existing link-configuration endpoint remains compatible; the server expands the selected link to its group before applying the request.
- The server resolves every member link and endpoint before mutation. Missing members or ports reject the complete operation.
- Every scoped link receives the same primary/native VLAN and carried VLAN list. Every unique endpoint receives the same switchport mode, native VLAN, and allowed VLAN list.

## Verification

- Go handler tests cover grouped propagation, unchanged ungrouped links, and the existing rejected-VLAN transaction behavior.
- Browser-module tests cover group scope ordering and group-wide synchronized/mismatch states.
