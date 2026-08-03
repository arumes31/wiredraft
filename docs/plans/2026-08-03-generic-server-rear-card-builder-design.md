# Generic server rear card builder

## Goal

Allow a generic 1U, 2U, 3U, or 4U server rear to be assembled from mixed physical expansion cards. Every connector on every installed card becomes an independent persisted port that can be cabled to a different device.

## Chassis and card model

The builder exposes four rear card bays per rack unit, producing capacities from four cards in 1U through sixteen cards in 4U. Cards install in deterministic left-to-right, top-to-bottom slot order. A card records its family, user-facing label, and supported port count while the generated device remains compatible with the existing `Device` and `Port` persistence contract. Card membership is retained through the physical port group and exact faceplate coordinates, so no topology migration is required.

The built-in card library covers every connector type accepted by topology validation: BMC and BASE-T NICs, RJ11 WAN/DSL, SFP/SFP+/SFP28/SFP56 NICs and HBAs, QSFP+/QSFP28/QSFP56/QSFP-DD NICs, serial console cards, and power modules. Per-family port-count choices prevent physically implausible high-density QSFP cards while allowing one-, two-, or four-port copper and SFP cards.

## Interface and rendering

The server dialog is a rear-elevation workbench rather than a uniform NIC-count wizard. Users can add, remove, label, and mix cards, change rack height, and inspect a live chassis preview with empty bays and connector shapes. Capacity errors disable installation without silently deleting cards.

Installed server faceplates use a rear-service aesthetic with fan/PSU modules, framed expansion-card groups, real connector geometry, exact hit targets, and normal cable termination behavior. PNG export inherits the canvas rendering; SVG export includes explicit server-card frames and labels.

## Verification

Module tests confirm that the card library covers every supported backend port type, validates rack-unit capacity and card-specific port counts, generates stable slot groups, and keeps every connector within faceplate bounds. The existing faceplate, rack, cabling, topology-analysis, and persistence suites provide regression coverage.
