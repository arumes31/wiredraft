# Hardware catalog profiles

The built-in catalog contains offline schematic profiles for common Fortinet, Cisco, HPE Aruba, Juniper, Ubiquiti, MikroTik, Dell, NETGEAR, TP-Link Omada, Arista, Extreme, Ruckus, Palo Alto, Sophos, and Check Point families. A profile records the front-facing connector groups used to generate persistent ports and normalized faceplate positions.

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
      { "zone": "access", "count": 48, "type": "RJ45_1G", "speed": 1000, "poe": true, "prefix": "" },
      { "zone": "uplink", "count": 4, "type": "SFP_PLUS_10G", "speed": 10000, "poe": false, "prefix": "SFP+" },
      { "zone": "management", "count": 1, "type": "Console", "speed": 0, "poe": false, "prefix": "MGMT" }
    ]
  }
]
```

Supported connector types are `RJ45_1G`, `RJ45_10G`, `SFP_1G`, `SFP_PLUS_10G`, `SFP28_25G`, `SFP56_50G`, `QSFP28_100G`, `Console`, and `Power`.

Profiles are schematic front-panel representations rather than vendor artwork. Product names identify compatibility targets; trademarks remain the property of their owners.

## Specification sources

Built-in profiles are maintained against public vendor hardware matrices and data sheets, including:

- Fortinet product matrix: <https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/Fortinet_Product_Matrix.pdf>
- Cisco Catalyst 9200 data sheet: <https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html>
- Cisco Catalyst 9300 data sheet: <https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html>
- Juniper EX port reference: <https://www.juniper.net/documentation/us/en/software/junos/interfaces-ethernet-switches/topics/topic-map/port-speed-ex-switches.html>
- Ubiquiti switching catalog: <https://ui.com/us/en/switching>

Because vendors revise SKUs and shared-port behavior, verify a profile against the hardware installation guide before using the diagram as a physical patch-work order.
