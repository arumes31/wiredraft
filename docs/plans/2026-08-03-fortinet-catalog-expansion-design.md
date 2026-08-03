# Fortinet catalog expansion design

## Goal

Replace the small representative Fortinet subset with an offline catalog that exposes every physical FortiGate and FortiSwitch SKU in the current Fortinet support matrices. A user must be able to find a model by either marketing name or part-number shorthand and install a persistent connector-level schematic without a network request.

## Architecture

Fortinet data lives in `web/static/js/catalog-fortinet.js` rather than enlarging the multi-vendor catalog table. Repeated storage, DC-power, PoE, and chassis variants are generated from shared faceplate families. Each generated profile remains an ordinary catalog profile, so persistence, canvas rendering, export, and custom profile import continue through the existing data path.

Profiles carry `lifecycle`, `fidelity`, `source`, and `note` metadata. `verified` means the connector groups are backed by a current Fortinet matrix, product specification, or model data sheet. `family` identifies older supported hardware for which a family-equivalent panel is used. `modular` prevents a chassis shell from pretending it has the ports of an unknown line-card configuration.

The installer filters the selected provider's models by marketing name or SKU. It reports lifecycle and faceplate fidelity before installation. New connector enums cover multi-gig copper, DSL, 40G QSFP+, 200G QSFP56, and 400G QSFP-DD while retaining the existing persistence contract.

## Validation

Automated checks cover the expanded backend connector enum, catalog module loading, duplicate model rejection, counts by product family, and the full Go test/race/vet suites. Browser verification searches for and installs representative FortiGate, FortiSwitch, and modular chassis profiles, then confirms persisted model and port counts after an API round trip.
