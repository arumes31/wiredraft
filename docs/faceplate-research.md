# Faceplate visual research

The built-in catalog contains 541 models. Every profile resolves to a sourced vector faceplate family; connector count, type, labels, PoE status, row arrangement, and normalized physical position remain model-specific. Power, storage, regional, and lifecycle variants share a family only when their documented front connector panel is equivalent.

The renderer deliberately does not ship vendor photographs. Official front-panel images, diagrams, hardware guides, and product specifications were analyzed for chassis finish, port-bank surrounds, management and status areas, displays, vent patterns, module covers, drive bays, and rack hardware. Those observations are encoded in 28 scalable template IDs:

| Vector family | Catalog profiles | Distinguishing front-panel features |
| --- | ---: | --- |
| Fortinet desktop | 27 | Light appliance shell, horizontal slot vents, left reset/USB/console area, red-labeled RJ45 bank |
| Fortinet rack | 37 | Light 1U shell, status block, separated management/data banks |
| Fortinet datacenter | 73 | Dense perforation, grouped high-speed cages, darker module surrounds |
| Fortinet modular | 25 | Multi-unit shell, repeated module boundaries, dense SFP/QSFP banks |
| Fortinet switch | 49 | Light access-switch shell, paired RJ45 rows, right-side uplink cages |
| Fortinet rugged | 11 | Dark sealed industrial shell and louvered ventilation |
| Cisco campus / datacenter | 51 | Dark graphite chassis, status/USB cluster, fixed or dense high-speed uplink banks |
| HPE Aruba campus / datacenter | 18 | Charcoal chassis, orange identification accent, grouped port fields |
| Juniper EX | 32 | Dark chassis, dedicated management/status block and extension/uplink areas |
| Ubiquiti UniFi | 13 | Minimal light shell and left LCM status display |
| MikroTik CRS | 22 | Light metal shell, compact status cluster and separated SFP/QSFP banks |
| Dell PowerSwitch | 9 | Dark data-center shell, dense optical cages and mesh fields |
| NETGEAR managed | 13 | Dark front, status/stack block and mixed copper/optical banks |
| TP-Link Omada | 9 | Dark access chassis, LED/mode block, paired copper rows and right uplinks |
| Arista datacenter | 12 | Dense optical front, environmental status block and high-speed breakout cages |
| Extreme switch | 11 | Dark violet-toned shell, universal ports and covered VIM/module area |
| Ruckus ICX | 10 | Dark campus chassis, access banks with separated stacking/uplink area |
| Palo Alto PA | 12 | Minimal dark firewall shell with status/USB/console and Ethernet banks |
| Sophos XGS | 13 | Blue-gray security chassis, management block and modular network areas |
| Check Point Quantum | 15 | Dark security chassis, onboard LAN bank and expansion line-card boundary |
| Wireless AP | 6 | Light ceiling/wall enclosure treatment with a compact status field and one or two PoE uplinks |
| Carrier edge | 9 | Dark NID/modem shell with separated service-provider and customer interface groups |
| Cellular edge | 5 | Rugged louvered CPE treatment for LTE/5G and industrial routers |
| Static server / generic / patch | 58 | Rear card bays, category fallbacks, facilities equipment, and passive connector fields |

Static servers use a separate local template with drive bays, BMC/status controls, mesh ventilation, and independently positioned NICs. Imported vendors fall back to category-specific industrial templates.

## Primary visual sources

- Fortinet hardware guides and front-panel diagrams: <https://docs.fortinet.com/product/fortigate/hardware>
- Cisco Catalyst 9200 hardware overview: <https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/hardware/install/b-c9200-hig/product_overview.html>
- HPE Aruba 6000/6100 installation guide: <https://www.arubanetworks.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf>
- Juniper EX4400 models and front-panel components: <https://www.juniper.net/documentation/us/en/hardware/ex4400/topics/concept/ex4400-models.html>
- Ubiquiti UniFi Pro Max technical images and port layout: <https://techspecs.ui.com/unifi/switching/usw-pro-max-24-poe>
- MikroTik CRS hardware documentation: <https://help.mikrotik.com/docs/spaces/UM/pages/17956957/CRS326-24S%202Q%20RM>
- Dell PowerSwitch S5200F documentation: <https://www.dell.com/support/product-details/en-us/product/networking-s5248f-on/resources/manuals>
- NETGEAR M4300 hardware installation guide: <https://www.downloads.netgear.com/files/GDC/M4300/M4300_HIG_EN.pdf>
- TP-Link Omada multi-model installation guide: <https://static.tp-link.com/upload/manual/2025/202512/20251211/7100002449_Omada%20Access%20Plus%26Pro%20Switch%20Multi-model_IG.pdf>
- Arista 7050 Series front-panel guide: <https://www.arista.com/jp/qsg-7050-series-1ru-gen3/7050-series-1ru-gen3-front-panel>
- Extreme 5520 installation guide: <https://documentation.extremenetworks.com/5520%20Series%20Installation%20Guide/Universal_Hardware/5520_Series_Installation_Guide/topics/5520_48w_switch_features.shtml>
- Ruckus ICX 7150 hardware installation guide: <https://support.ruckuswireless.com/documents/1397-ruckus-icx-7150-switch-hardware-installation-guide>
- Palo Alto PA-400 front panel: <https://docs.paloaltonetworks.com/hardware/pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel>
- Sophos XGS operating instructions: <https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-2100-2300-3100-3300.pdf>
- Check Point 6000/7000 appliance front panels: <https://sc1.checkpoint.com/documents/6000_7000/GSG/EN/Content/Topics/GSG_6000_7000/6000-Appliances-Hardware.htm>
- Cisco Catalyst 9166 access point interfaces: <https://www.cisco.com/c/en/us/products/collateral/wireless/catalyst-9166-series-access-points/catalyst-9166-series-access-points-ds.html>
- HPE Aruba AP-635 interface specification: <https://www.hpe.com/us/en/collaterals/collateral.a50002582enw.html>
- Fortinet FortiAP Wi-Fi 6 physical interfaces: <https://docs.fortinet.com/document/fortiap/7.0.0/secure-wireless-concept-guide/538598/fortiap-wi-fi-6-standard-and-utp-access-points>
- Ubiquiti U7 Pro technical specification: <https://techspecs.ui.com/unifi/wifi/u7-pro>
- Fortinet FortiExtender interface management: <https://docs.fortinet.com/document/fortiextender/7.2.2/admin-guide-standalone/705422/interface-management>
- Teltonika RUTX50 interfaces: <https://wiki.teltonika-networks.com/view/RUTX50_Interfaces>
- Cisco Catalyst IR1101 interface specification: <https://www.cisco.com/c/en/us/products/collateral/routers/1101-industrial-integrated-services-router/datasheet-c78-741709.html>

Automated coverage fails if a built-in profile lacks a sourced template, so future catalog additions cannot silently fall back without being noticed.
