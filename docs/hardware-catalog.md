# Hardware catalog profiles

The built-in catalog contains more than 500 offline schematic profiles across network, compute, storage, facilities, console/OOB, and passive-cabling families. A profile records the front-facing connector groups, ordered printed labels, evidence fidelity, and normalized faceplate positions used to generate persistent ports.

Fortinet accounts for 222 profiles: 169 physical FortiGate/FortiGate Rugged firewalls and 53 FortiSwitch/FortiSwitch Rugged models. The scope combines FortiManager 7.6.4's supported physical FortiGate list, the July 2026 Fortinet product matrix, FortiSwitchOS 8.0's supported list, and the current FortiSwitch model specifications. Virtual appliances and FortiWiFi access products are intentionally excluded because they do not have a FortiGate or FortiSwitch faceplate.

Use **Filter models / SKU** in the installer to search values such as `FG-200G`, `FS-124F`, or `FortiSwitch Rugged`. The summary distinguishes verified panels, family-equivalent legacy panels, and modular chassis whose interfaces depend on installed modules.

It is intentionally extensible: vendor portfolios and regional SKUs change more quickly than the application release cycle. Use **Install Device → Import Profile** to load additional profiles from JSON. Imported profiles remain available for the browser session; installed devices are persisted in the topology itself.

```json
[
  {
    "vendor": "Example Networks",
    "model": "EX-48P-4X",
    "category": "Switch",
    "units": 1,
    "color": "#263b4b",
    "layout": "example-networks",
    "groups": [
      { "zone": "access", "count": 4, "type": "RJ45_1G", "speed": 1000, "poe": true, "prefix": "", "labels": ["WAN", "A", "1", "2"] },
      { "zone": "uplink", "count": 4, "type": "SFP_PLUS_10G", "speed": 10000, "poe": false, "prefix": "SFP+" },
      { "zone": "management", "count": 1, "type": "Console", "speed": 0, "poe": false, "prefix": "MGMT" }
    ]
  }
]
```

Supported connector types are `RJ45_1G`, `RJ45_MGIG`, `RJ45_10G`, `DSL_RJ11`, `SFP_1G`, `SFP_PLUS_10G`, `SFP28_25G`, `SFP56_50G`, `QSFP_PLUS_40G`, `QSFP28_100G`, `QSFP56_200G`, `QSFP_DD_400G`, `CFP_100G`, `CFP2_100G`, `CFP4_100G`, `OSFP_800G`, `FIBER_LC`, `FIBER_SC`, `FIBER_MPO`, `USB_MICRO_CONSOLE`, `USB_C_CONSOLE`, `Stack`, `Console`, and `Power`. Connector-specific faceplate geometry distinguishes optical cages, fiber couplers, USB console sockets, management ports, and stack/VSF connectors.

Profiles are schematic front-panel representations rather than vendor artwork. Product names identify compatibility targets; trademarks remain the property of their owners.

`labels` is optional for imported profiles, but when present it must contain exactly `count` non-empty strings. Built-in exact layouts carry printed interface legends from vendor front-panel or architecture documentation. Family-equivalent profiles use the vendor's physical numbering convention and are marked as such in the installer rather than being presented as exact research.

The vector faceplate renderer is informed by official front-panel imagery and hardware guides while remaining fully offline. All 280 built-in profiles resolve to a sourced chassis family, and their exact connector populations and normalized positions remain profile-specific. See [Faceplate visual research](faceplate-research.md) for coverage, physical observations, and primary sources.

## Static servers

Static servers use the separate **+ Server** builder because their NIC layout is installation-specific rather than tied to a network-hardware SKU. Choose a 1U–4U chassis, 1–16 identical data NICs, copper or fiber media, and an optional 1G BMC management interface. The resulting server is persisted as an ordinary device and participates in export, import, inspection, and cabling.

Every server interface represents one physical NIC and accepts one cable. A multi-homed server connects to several switches or firewalls by using a different NIC for each cable. Servers are endpoints in switching-loop and path analysis; their interfaces are not interpreted as an internal bridge.

## Specification sources

Built-in profiles are maintained against public vendor hardware matrices and data sheets, including:

- Fortinet product matrix: <https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/Fortinet_Product_Matrix.pdf>
- FortiGate supported models: <https://docs.fortinet.com/document/fortimanager/7.6.4/release-notes/191178/fortigate-models>
- FortiSwitchOS supported models: <https://docs.fortinet.com/document/fortiswitch/8.0.0/fortiswitchos-release-notes/784383/introduction>
- FortiSwitch models and specifications: <https://www.fortinet.com/products/ethernet-switches>
- Cisco Catalyst 9200 data sheet: <https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html>
- Cisco Catalyst 9300 data sheet: <https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html>
- Juniper EX port reference: <https://www.juniper.net/documentation/us/en/software/junos/interfaces-ethernet-switches/topics/topic-map/port-speed-ex-switches.html>
- Ubiquiti switching catalog: <https://ui.com/us/en/switching>

Because vendors revise SKUs and shared-port behavior, verify a family-equivalent or modular profile against the exact hardware installation guide before using the diagram as a physical patch-work order.
