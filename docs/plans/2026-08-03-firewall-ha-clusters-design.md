# Firewall HA clusters

Firewall high availability is stored as a `FirewallCluster` inside the topology aggregate. A cluster contains two or more physical firewall device IDs, a name, an active/active or active/passive mode, optional notes, and—only for active/passive mode—the preferred active device ID. Physical appliances, rack positions, interfaces, and cables remain independent. The cluster contributes one logical unit to inventory totals.

Validation accepts only firewall-category members, prevents a firewall from belonging to multiple clusters, and requires the active device to be a cluster member. Active/active clusters cannot carry a single preferred-active ID. Vendor and model compatibility remains advisory so mixed or migration topologies can still be documented.

Deleting a member prunes it from the cluster. When the deleted member was active and at least two peers remain, the first remaining member becomes active. A cluster that falls below two members dissolves automatically without removing surviving hardware or cables.

The device inspector creates, edits, and dissolves clusters. It lists every physical peer with ACTIVE or PASSIVE status and permits navigation between members. Canvas faceplates receive compact `A/A` or `A/P` role badges; selecting one firewall outlines its cluster peers. Backend handler tests cover three-member creation, mode updates, active-role reassignment, dissolution, and logical counting. Browser-module tests cover membership candidates, role labeling, mode transitions, and client validation.
