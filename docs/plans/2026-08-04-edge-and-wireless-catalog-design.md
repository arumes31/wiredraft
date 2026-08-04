# Edge and wireless hardware catalog design

## Intent

The general hardware installer already persists `AccessPoint`, `Modem`, and `Router` devices, but its provider-first browsing makes those roles difficult to discover and the built-in catalog contains no useful endpoint profiles for them. Add a device-family selector and a sourced offline profile set for access points, carrier handoffs, broadband modems/ONTs, and LTE/5G routers.

## Chosen architecture

Keep the persisted device-category contract unchanged. A catalog-only `family` property classifies profiles for browsing, while installed devices continue to use the stable topology categories that validation and analysis already understand. Profiles without explicit family metadata derive one from their existing category, so the complete existing catalog remains browsable and imported profiles remain backward compatible.

The installer filters in the order **family → provider → model/SKU**. Selecting **All devices** preserves the current workflow. Changing family rebuilds only the compatible provider/model choices and updates the physical-interface summary. Dedicated patch panels remain in the Panel workflow.

## Profiles and physical fidelity

Add representative sourced profiles plus generic archetypes:

- ceiling and dual-uplink access points, with Cisco, Aruba, Fortinet, and Ubiquiti models;
- copper, 1G optical, and 10G optical carrier demarcations, plus an ADTRAN NID;
- DOCSIS, VDSL2, GPON, and XGS-PON endpoints;
- generic LTE/5G routers plus FortiExtender, Teltonika, and Cisco industrial models.

Exact known interface legends are stored in each connector group. Non-rack devices remain free-floating topology devices but can still be placed in a rack when documenting a shelf installation. Dedicated wireless, carrier-edge, and cellular-edge chassis treatments distinguish these devices from switches and firewalls without using vendor artwork.

DOCSIS profiles introduce `COAX_F` as a real connector rather than pretending the service input is Ethernet. It receives its own validation, geometry, cable-media default, import support, and server-card option.

## Compatibility, errors, and tests

Existing catalog functions retain their no-argument behavior. Imported profiles may omit `family`; invalid explicit family values are rejected with the existing invalid-profile error. Empty family/provider searches disable model selection and present the current no-match summary.

Unit coverage verifies family filtering, representative exact labels, coax connector rendering and import validation. Go validation accepts coax ports. A browser workflow selects Access Points, installs a profile, and verifies the persisted device category and interface labels. Full Go, JavaScript, coverage, browser, and Docker health checks remain the release gate.
