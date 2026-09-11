import { resolvePA7050Faceplate } from "./faceplate-pa7050-models.js";
import { resolveExtremeFinalFaceplate } from "./faceplate-extreme-final-models.js";
import { resolveJuniperSRX5KFaceplate } from "./faceplate-juniper-srx5k-models.js";
import { resolveExtremeNextFaceplate } from "./faceplate-extreme-next-models.js";
import { resolveExtremeG2Faceplate } from "./faceplate-extreme-g2-models.js";
import { resolveJuniperModularFaceplate } from "./faceplate-juniper-modular-models.js";
import { resolveJuniperQFXSpineFaceplate } from "./faceplate-juniper-qfx-spine-models.js";
import { resolveFirepower9300Faceplate } from "./faceplate-firepower9300-model.js";
import { resolveMerakiAggregationFaceplate } from "./faceplate-meraki-aggregation-models.js";
import { resolveMerakiAdvancedFaceplate } from "./faceplate-meraki-advanced-models.js";
import { resolveJuniperQFXNextFaceplate } from "./faceplate-juniper-qfx-next-models.js";
import { resolveRuckusFinalFaceplate } from "./faceplate-ruckus-final-models.js";
import { resolveMerakiAccessFaceplate } from "./faceplate-meraki-access-models.js";
import { resolveJuniperQFXAccessFaceplate } from "./faceplate-juniper-qfx-access-models.js";
import { resolvePA5410Faceplate } from "./faceplate-pa5410-models.js";
import { resolveJuniperEXCoreFaceplate } from "./faceplate-juniper-ex-core-models.js";
import { resolveRuckusNextFaceplate } from "./faceplate-ruckus-next-models.js";
import { resolveCiscoNexusFinalFaceplate } from "./faceplate-cisco-nexus-final-models.js";
import { resolvePA5220Faceplate } from "./faceplate-pa5220-models.js";
import { resolveJuniperEXNextFaceplate } from "./faceplate-juniper-ex-next-models.js";
import { canonicalFaceplateDevice, layoutPanelPorts } from "./faceplate-profile.js";
import { buildSophosModelFaceplate } from "./faceplate-sophos-models.js";
import { buildPaloAltoModelFaceplate } from "./faceplate-paloalto-models.js";
import { buildCiscoASAModelFaceplate } from "./faceplate-cisco-asa-models.js";
import { buildCiscoFirepowerModelFaceplate } from "./faceplate-cisco-firepower-models.js";
import { buildCiscoCatalystModelFaceplate } from "./faceplate-cisco-catalyst-models.js";
import { resolveCatalystFamilyFaceplate } from "./faceplate-catalyst-family-models.js";
import { resolveCatalystChassisFaceplate } from "./faceplate-catalyst-chassis-models.js";
import { resolveCiscoEdgeFaceplate } from "./faceplate-cisco-edge-models.js";
import { resolveCiscoISRFaceplate } from "./faceplate-cisco-isr-models.js";
import { resolvePA3410Faceplate } from "./faceplate-pa3410-models.js";
import { resolveJuniperEXFamilyFaceplate } from "./faceplate-juniper-ex-family-models.js";
import { resolveRuckusFamilyFaceplate } from "./faceplate-ruckus-family-models.js";
import { resolveCiscoNexusFamilyFaceplate } from "./faceplate-cisco-nexus-family-models.js";
import { buildCiscoNexusModelFaceplate } from "./faceplate-cisco-nexus-models.js";
import { buildCiscoMerakiModelFaceplate } from "./faceplate-cisco-meraki-models.js";
import { buildCiscoIndustrialModelFaceplate } from "./faceplate-cisco-industrial-models.js";
import { buildJuniperSRXModelFaceplate } from "./faceplate-juniper-srx-models.js";
import { buildJuniperEXModelFaceplate } from "./faceplate-juniper-ex-models.js";
import { buildCheckPointModelFaceplate } from "./faceplate-checkpoint-models.js";
import { resolveAristaFaceplate } from "./faceplate-arista-models.js";
import { buildDellModelFaceplate } from "./faceplate-dell-models.js";
import { buildRuckusModelFaceplate } from "./faceplate-ruckus-models.js";
import { resolveExtremeFaceplate } from "./faceplate-extreme-models.js";

// Individual vendor drawings take precedence over intermediate family layouts.
// Remaining fitted compositions retain family fidelity until their SKU panels
// are traced. Exact catalog names prevent nearby or future models from matching.
const definitions = new Map();
const layouts = new Map();
const CISCO = "https://www.cisco.com/c/en/us/td/docs/";
const JUNIPER = "https://www.juniper.net/documentation/us/en/hardware/";
const ARUBA = "https://arubanetworking.hpe.com/techdocs/hardware/DocumentationPortal/Content/ArubaTopics/Switches/";
const ARISTA = "https://www.arista.com/en/";
const SOPHOS = "https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-";
const PALO = "https://docs.paloaltonetworks.com/hardware/";

const sources = {
  c9200: `${CISCO}switches/lan/catalyst9200/hardware/install/b-c9200-hig/product_overview.html`,
  c9300: `${CISCO}switches/lan/catalyst9300/hardware/install/b_c9300_hig/Product-overview.html`,
  c9400: `${CISCO}switches/lan/catalyst9400/hardware/install/b_c9400_hig/b_c9400_hig_chapter_00.html`,
  c9500: `${CISCO}switches/lan/catalyst9500/hardware/install/b_catalyst_9500_hig/9500_product-overview.html`,
  c9600: `${CISCO}switches/lan/catalyst9600/hardware/install/b_9600_hig/b_9600_hig_chapter_01.html`,
  nexus3000: `${CISCO}switches/datacenter/nexus3000/hw/installation/guide/b_n3000_hardware_install_guide.html`,
  nexus5000: `${CISCO}switches/datacenter/nexus5000/hw/installation/guide/nexus_5000_hig.pdf`,
  nexus7000: `${CISCO}switches/datacenter/hw/nexus7000/installation/guide/n7k_hig_book/n7k_overview.html`,
  nexus9000: `${CISCO}dcn/hw/nx-os/nexus9000/93180yc-fx3/cisco-nexus-93180yc-fx3-nx-os-mode-switch-hardware-installation-guide.pdf`,
  asa5506: `${CISCO}security/asa/hw/maintenance/5506xguide/b_Install_Guide_5506/b_Install_Guide_5506_chapter_01.html`,
  asa5508: `${CISCO}security/asa/hw/maintenance/5508xguide/b_install_guide_5508/b_install_guide_5508_chapter_0100.html`,
  asa5500: `${CISCO}security/asa/hw/maintenance/5500xguide/5500xhw/asa_overview.html`,
  f1010: `${CISCO}security/firepower/1010/hw/guide/hw-install-1010.pdf`,
  f1100: `${CISCO}security/firepower/1100/hw/guide/hw-install-1100/overview.html`,
  f2100: `${CISCO}security/firepower/2100/hw/guide/b_install_guide_2100/overview.html`,
  f4100: `${CISCO}security/firepower/4100/hw/guide/b_install_guide_4100/overview.html`,
  f9300: `${CISCO}security/firepower/9300/hw/guide/b_install_guide_9300/b_install_guide_9300_chapter_01.html`,
  isr1100: `${CISCO}routers/access/1100/hardware/installation/guide/b-cisco-1100-series-hig/c1100_overview.html`,
  isr4000: `${CISCO}routers/access/4400/hardware/installation/guide4400-4300/C4400_isr/Overview.html`,
  ir1101: `${CISCO}IIOT/routers/ir1101/hw-install-guide/b-ir1101-hig.pdf`,
  wlc9800: `${CISCO}wireless/controller/9800/9800-L/installation-guide/b-wlc-ig-9800-L.pdf`,
  aruba6300: "https://arubanetworking.hpe.com/techdocs/hardware/switches/6300/IGSG/igsg_6300.pdf",
  aruba7200: "https://support.hpe.com/hpesc/public/api/document/c05315623",
  dell: "https://www.dell.com/support/kbdoc/en-us/000131385/dell-emc-networking-hardware-platforms-os9-info-hub",
  dell5200: "https://www.dell.com/support/manuals/en-us/networking-s5248f-on/s5200-on_install_pub/components?guid=guid-b47e4690-f443-43ea-a77a-99d8e2484239&lang=en-us",
  extreme: "https://documentation.extremenetworks.com/extremeswitching/downloads/EXOS30_HWInstall.pdf",
  extreme440: "https://documentation.extremenetworks.com/HW_QRG/120998-00_x440-g2_qrg.pdf",
  extreme460: "https://documentation.extremenetworks.com/HW_QRG/120947-00_x460-g2_qrg.pdf",
  cp1500: "https://www.checkpoint.com/downloads/products/1500-security-gateway-datasheet.pdf",
  cp1600: "https://sc1.checkpoint.com/documents/Appliances/GSG_V2V3/EN/Content/Topics-V2-V3/Front-Panel.htm",
  cp3000: "https://sc1.checkpoint.com/documents/3000/GSG/EN/CP_3000_Appliances_GettingStartedGuide.pdf",
  cp6000: "https://sc1.checkpoint.com/documents/6000_7000/GSG/EN/Content/Topics/GSG_6000_7000/6000-Appliances-Hardware.htm",
  cp16000: "https://sc1.checkpoint.com/documents/16000_GSG/English/92775.htm",
  cp26000: "https://sc1.checkpoint.com/documents/16000_26000_28000/26000_28000_GSG/EN/Content/Topics/GSG_26000_28000/26000-Appliances-Hardware.htm",
};

const rearServices = { serviceFace: "rear", stackFace: "rear" };
const rearIO = { dataFace: "rear", serviceFace: "rear", stackFace: "rear" };
register("Cisco", "Catalyst 9200", ["Catalyst 9200 family", "Catalyst C9200L-24P-4X", "Catalyst C9200L-24T-4G",
  "Catalyst C9200L-48P-4X", "Catalyst C9200L-48T-4G"], sources.c9200, { ...rearServices, power: "dual", usbConsoleFace: "front" });
register("Cisco", "Catalyst 9300", ["Catalyst 9300 family", "Catalyst C9300L-24T-4G", "Catalyst C9300L-48P-4X",
  "Catalyst C9300X-24Y"], sources.c9300, { ...rearServices, power: "dual", usbConsoleFace: "front" });
register("Cisco", "Catalyst 9400", ["Catalyst 9400 family"], sources.c9400, { form: "modular", powerFace: "front", power: "region" });
register("Cisco", "Catalyst 9500", ["Catalyst 9500 family"], sources.c9500, { power: "dual" });
register("Cisco", "Catalyst 9600", ["Catalyst 9600 family"], sources.c9600, { form: "modular", powerFace: "front", power: "region" });
for (const series of [120, 210, 225, 250, 350, 390, 410, 425, 450]) {
  const skus = [`Meraki MS${series}`, ...({ 120: ["Meraki MS120-24P"], 225: ["Meraki MS225-48FP"] }[series] || [])];
  register("Cisco", `Meraki MS${series}`, skus,
    `https://documentation.meraki.com/Switching/MS_-_Switches/Install_and_Get_Started/Installation_Guides/MS${series}_Series_Installation_Guide`,
    { ...rearServices, power: series <= 225 ? "fixed" : "region", frontIndicators: "single",
      ...(series === 425 ? { power: "dual", fans: 3, stackFace: "front" } : {}) });
}
register("Cisco", "Nexus 3000", ["Nexus 3000 family"], sources.nexus3000, { ...rearServices, power: "region" });
register("Cisco", "Nexus 5000", ["Nexus 5000 family"], sources.nexus5000, { power: "region", expansion: "EXPANSION" });
register("Cisco", "Nexus 7000", ["Nexus 7000 family"], sources.nexus7000, { form: "modular" });
register("Cisco", "Nexus 9000", ["Nexus 9000 family", "Nexus 93180YC-FX3"], sources.nexus9000,
  { ...rearServices, power: "dual", fans: 4 });
register("Cisco", "Nexus 9336C-FX2", ["Nexus 9336C-FX2"],
  `${CISCO}switches/datacenter/nexus9000/hw/n9336cfx2_hig/guide/b_n9336cFX2_nxos_hardware_installation_guide.html`,
  { ...rearServices, power: "dual", rows: 2 });
register("Cisco", "ASA 5506-X", ["ASA 5506-X"], sources.asa5506, { ...rearIO, form: "desktop", power: "dc" });
register("Cisco", "ASA 5508-X / 5516-X", ["ASA 5508-X", "ASA 5516-X"], sources.asa5508, { ...rearIO, power: "fixed" });
register("Cisco", "ASA 5500-X", ["ASA 5525-X", "ASA 5545-X", "ASA 5555-X"], sources.asa5500, { ...rearIO, power: "region", expansion: "I/O EXPANSION" });
register("Cisco", "Firepower 1010", ["Secure Firewall 1010"], sources.f1010, { ...rearIO, form: "desktop", frontIndicators: "none", power: "dc" });
register("Cisco", "Firepower 1100", ["Secure Firewall 1120", "Secure Firewall 1140"], sources.f1100, { ...rearIO, power: "fixed" });
register("Cisco", "Firepower 2110 / 2120", ["Secure Firewall 2110", "Secure Firewall 2120"], sources.f2100, { power: "fixed" });
register("Cisco", "Firepower 2130 / 2140", ["Secure Firewall 2130", "Secure Firewall 2140"], sources.f2100, { power: "dual", expansion: "NETWORK MODULE" });
register("Cisco", "Firepower 4100", ["Secure Firewall 4110", "Secure Firewall 4120", "Secure Firewall 4140", "Secure Firewall 4150"], sources.f4100,
  { power: "dual", expansion: "NETWORK MODULES" });
register("Cisco", "Firepower 9300", ["Secure Firewall 9300"], sources.f9300, { form: "modular", power: "dual", fans: 4 });
register("Cisco", "ISR 1100", ["ISR 1100 family"], sources.isr1100, { ...rearIO, form: "desktop", power: "dc" });
register("Cisco", "ISR 4300", ["ISR 4300 family"], sources.isr4000,
  { dataFace: "rear", serviceFace: "front", powerFace: "front", power: "region", expansion: "NIM / SM-X" });
register("Cisco", "ISR 4400", ["ISR 4400 family"], sources.isr4000, { ...rearIO, powerFace: "front", power: "region", expansion: "NIM / SM-X" });
register("Cisco", "IR1101", ["Catalyst IR1101"], sources.ir1101, { form: "industrial", power: "dc", expansion: "PLUGGABLE" });
register("Cisco", "Catalyst 9800-L", ["Catalyst 9800-L WLC"], sources.wlc9800, { form: "desktop", power: "dc" });

register("HPE Aruba", "CX 6000 / 6100", ["CX 6000 family", "CX 6100 family", "CX 6100 24G 4SFP+", "CX 6100 48G 4SFP+"],
  `${ARUBA}6100.htm`, { power: "fixed" });
register("HPE Aruba", "CX 6200", ["CX 6200 family", "CX 6200F 24G 4SFP+", "CX 6200F 48G 4SFP+"],
  "https://arubanetworking.hpe.com/techdocs/Switches/Aruba_6200/5200-6885/index.html", { power: "fixed" });
register("HPE Aruba", "CX 6300", ["CX 6300 family", "CX 6300M 24-port Smart Rate", "CX 6300M 48G"], sources.aruba6300,
  { power: "region", sourcePage: "Introducing the switches; Front / Back of the switches" });
for (const series of [6400, 8400]) register("HPE Aruba", `CX ${series}`, [`CX ${series} family`], `${ARUBA}${series}.htm`, { form: "modular" });
for (const [series, guide, options] of [
  [8320, "8320/IGSG/Aruba_8320_IGSG_en_us.pdf", {}],
  [8325, "8325/IGSG/Aruba_8325_IGSG_en_us.pdf", {}],
  [8360, "8360/IGSG/Aruba_8360_IGSG.pdf", { serviceFace: "rear", usbConsoleFace: "front" }],
  [10000, "10000/igsg_10000.pdf", { usbConsoleFace: "rear" }],
]) {
  register("HPE Aruba", `CX ${series}`, [`CX ${series} family`, ...(series === 8325 ? ["CX 8325-48Y8C"] : [])],
    `https://www.arubanetworks.com/techdocs/hardware/switches/${guide}`, { power: "region", ...options });
}
register("HPE Aruba", "7200 mobility controller", ["Mobility Controller family"], sources.aruba7200,
  { power: "dual", display: true, sourcePage: "Chapter 1: Front Panel / Rear Panel" });

for (const [series, skus, options] of [
  ["ex2300", ["EX2300 family", "EX2300-24T", "EX2300-48P"], { ...rearServices, power: "fixed", usbConsoleFace: "rear" }],
  ["ex3400", ["EX3400 family", "EX3400-24P"], { ...rearServices, power: "dual", fans: 2, rearQSFP: true }],
  ["ex4100", ["EX4100 family"], { ...rearServices, power: "region" }],
  ["ex4300", ["EX4300 family"], { ...rearServices, power: "region", rearQSFP: true }],
  ["ex4400", ["EX4400 family", "EX4400-48P"], { ...rearServices, power: "dual" }],
  ["ex4600", ["EX4600 family"], { ...rearServices, expansion: "UPLINK MODULES" }],
  ["ex4650", ["EX4650-48Y"], { ...rearServices, power: "dual" }],
  ["ex9208", ["EX9200 family"], { form: "modular" }],
  ["qfx10008", ["QFX10000 family"], { form: "modular" }],
  ...[5100, 5110, 5120, 5130, 5200, 5210, 5220].map((series) =>
    [`qfx${series}`, [`QFX${series} family`], { ...rearServices, power: "region" }]),
]) register("Juniper", series.toUpperCase(), skus, `${JUNIPER}${series}/${series}.pdf`, options);
for (const series of [300, 320, 340, 345, 380, 1500, 4100, 4200, 4600, 5400, 5600, 5800]) {
  register("Juniper", `SRX${series}`, [`SRX${series}`], `${JUNIPER}srx${series}/srx${series}.pdf`, {
    form: series >= 5000 ? "modular" : series <= 320 ? "desktop" : "rack",
    power: series <= 320 ? "dc" : "region",
    ...([320, 340, 345, 380].includes(series) ? { expansion: "MINI-PIM" } : {}),
  });
}

register("Dell", "N3200-ON", ["PowerSwitch N3248TE-ON"],
  "https://www.dell.com/support/product-details/en-us/product/networking-n3200-on-series/resources/manuals",
  { ...rearServices, power: "region" });
for (const series of [3048, 4048, 4148, 5048, 5248]) {
  const skus = series === 4148 ? ["PowerSwitch S4148F-ON"] : series === 5248
    ? ["PowerSwitch S5248", "PowerSwitch S5248F-ON"] : [`PowerSwitch S${series}`];
  register("Dell", `S${series}-ON`, skus, series === 5248 ? sources.dell5200 : sources.dell,
    { ...rearServices, power: series === 5248 ? "dual" : "region", ...(series === 5248 ? { fans: 4 } : {}),
      sourcePage: series === 5248 ? "S5200-ON components; non-I/O side" : `S${series}-ON installation guide; I/O and non-I/O side` });
}
register("Dell", "Z9000-ON", ["PowerSwitch Z9264", "PowerSwitch Z9332"], sources.dell,
  { ...rearServices, power: "region", sourcePage: "Z9264F-ON / Z9332F-ON hardware installation guides" });

register("Arista", "7050", ["7050 family"], `${ARISTA}qsg-7050-series-1ru-gen3/7050-series-1ru-gen3-front-panel`, { power: "region" });
register("Arista", "7050SX3", ["7050SX3-48YC8"], `${ARISTA}qsg-7050-series-1ru-gen3/7050-series-1ru-gen3-front-panel`,
  { ...rearServices, power: "dual", sourcePage: "Front Panel Figure 15; Rear Panel" });
register("Arista", "7060", ["7060 family", "7060CX2-32S"], `${ARISTA}qsg-7060-series-1ru-gen3/7060-series-1ru-gen3-front-panel`,
  { power: "dual", sourcePage: "Front Panel Figures 1–2; Rear Panel" });
register("Arista", "7280", ["7280 family"], `${ARISTA}qsg-7280-series-1ru-gen3/7280-series-1ru-gen3-front-panel`,
  { ...rearServices, power: "region", sourcePage: "Front Panels; SR/R-series family composition" });
for (const series of [7010, 7020, 7260]) register("Arista", String(series), [`${series} family`], `${ARISTA}support/product-documentation`,
  { power: "region", sourcePage: `${series} series: hardware installation documentation, Front / Rear Panel` });
register("Arista", "720XP", ["720XP-48ZC2"], `${ARISTA}qsg-720xp-series-1ru/720xp-series-1ru-rear-panel`,
  { ...rearServices, power: "dual", fans: 3, sourcePage: "Rear Panel Figure 1; Front Panel" });
for (const series of [7300, 7500, 7800]) register("Arista", String(series), [`${series} family`], `${ARISTA}support/product-documentation`,
  { form: "modular", sourcePage: `${series} series modular switch installation: front and rear modules` });

register("Extreme", "X440-G2", ["X440-G2"], sources.extreme440, { stackFace: "rear", power: "fixed", sourcePage: "Figures 1–3" });
register("Extreme", "X450-G2", ["X450-G2"],
  "https://documentation.extremenetworks.com/summit/GUID-BBFC14F9-A729-4332-8490-A67328A7FEF2.shtml",
  { stackFace: "rear", power: "dual" });
register("Extreme", "X460-G2", ["X460-G2"], sources.extreme460, { power: "dual", expansion: "VIM", sourcePage: "Figure 1: Front / Rear Panels" });
for (const series of ["X465", "X590", "X690", "X695", "X870"]) register("Extreme", series, [series], sources.extreme,
  { power: "region", sourcePage: `${series} switch ports and slots` });
for (const model of ["5320-24P-8XE", "5520-48W", "VSP 7400-48Y-8C"]) register("Extreme", model, [model],
  "https://supportdocs.extremenetworks.com/support/documentation/product-type/hardware/",
  { power: "region", sourcePage: `${model.split("-")[0]}: hardware guide, switch ports and slots` });
for (const [series, document] of [[7150, 1397], [7250, 1223], [7450, 1224], [7550, 3484], [7650, 2147]]) {
  const skus = [`ICX ${series} family`, ...({ 7150: ["ICX 7150-24P", "ICX 7150-48P"], 7550: ["ICX 7550-48ZP"] }[series] || [])];
  register("Ruckus", `ICX ${series}`, skus,
    `https://support.ruckuswireless.com/documents/${document}-ruckus-icx-${series}-switch-hardware-installation-guide`,
    { power: series <= 7250 ? "fixed" : "region", stackFace: series === 7450 ? "rear" : "front",
      ...(series === 7450 ? { expansion: "UPLINK MODULE" } : {}), sourcePage: "Hardware features; port-side / nonport-side views" });
}
for (const series of [7850, 8200]) register("Ruckus", `ICX ${series}`, [`ICX ${series} family`],
  `https://docs-be.commscope.com/bundle/icx${series}-installguide/raw/resource/enus/icx${series}-installguide.pdf`,
  { power: "region", sourcePage: "Hardware features; port-side / nonport-side views" });

register("Palo Alto", "PA-220", ["PA-220"], `${PALO}pa-220-hardware-reference/pa-220-firewall-overview/pa-220-front-panel`,
  { form: "desktop", power: "dual-dc", cooling: false });
register("Palo Alto", "PA-400", ["PA-440", "PA-450", "PA-460", "PA-440 / PA-450"],
  `${PALO}pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel`, { form: "desktop", power: "dual-dc", cooling: false });
register("Palo Alto", "PA-800", ["PA-850"], `${PALO}pa-800-hardware-reference`, { power: "dual" });
for (const series of [1400, 3400, 5200, 5400, 7000]) register("Palo Alto", `PA-${series}`,
  [`PA-${series} family`, ...(series === 1400 ? ["PA-1410 / PA-1420"] : [])], `${PALO}pa-${series}-hardware-reference`,
  { form: series === 7000 ? "modular" : "rack", power: "region" });
register("Sophos", "XGS 87 / 107", ["XGS 87", "XGS 107"], `${SOPHOS}87-87w-107-107w.pdf`,
  { ...rearIO, usbConsoleFace: "front", form: "desktop", power: "dc", sourcePage: "Operating Elements and Connections, pp. 3–4" });
register("Sophos", "XGS 116 / 126 / 136", ["XGS 116", "XGS 126", "XGS 136", "XGS 126 / 136"], `${SOPHOS}116-116w-126-126w-136-136w.pdf`,
  { ...rearIO, usbConsoleFace: "front", form: "desktop", power: "dc", sourcePage: "Operating Elements and Connections, pp. 3–4" });
register("Sophos", "XGS 2100 / 2300 / 3100 / 3300", ["XGS 2100", "XGS 2300", "XGS 3100", "XGS 3300", "XGS 2100 / 2300"],
  `${SOPHOS}2100-2300-3100-3300.pdf`, { display: true, power: "fixed", expansion: "FLEXI PORT", sourcePage: "Operating Elements and Connections, pp. 3–4" });
register("Sophos", "XGS 4300", ["XGS 4300"], `${SOPHOS}4300-4500.pdf`, { display: true, power: "fixed", expansion: "FLEXI PORT A / B", sourcePage: "Operating Elements and Connections, pp. 3–4" });
register("Sophos", "XGS 4500", ["XGS 4500"], `${SOPHOS}4300-4500.pdf`, { display: true, power: "dual", expansion: "FLEXI PORT A / B", sourcePage: "Operating Elements and Connections, pp. 3–4" });
register("Check Point", "Quantum Spark 1500", ["Quantum 1500"], sources.cp1500, { ...rearIO, form: "desktop", power: "dc" });
register("Check Point", "Quantum Spark 1600", ["Quantum 1600"], sources.cp1600, { power: "region" });
register("Check Point", "Quantum 3000", ["Quantum 3600", "Quantum 3800"], sources.cp3000, { form: "desktop", power: "dc", fans: 1 });
register("Check Point", "Quantum 6000 / 7000", ["Quantum 6200", "Quantum 6400", "Quantum 6600", "Quantum 6700", "Quantum 6900",
  "Quantum 7000", "Quantum 6200 / 6600"], sources.cp6000, { power: "region", expansion: "INTERFACE MODULES" });
register("Check Point", "Quantum 16000", ["Quantum 16000"], sources.cp16000, { power: "region", expansion: "INTERFACE MODULES" });
register("Check Point", "Quantum Spark 1800", ["Quantum 1800"], sources.cp1600, { power: "region" });
register("Check Point", "Quantum 26000 / 28000", ["Quantum 26000", "Quantum 28000"], sources.cp26000,
  { power: "triple", expansion: "INTERFACE MODULES" });

/** Register only the explicitly reviewed catalog names in one documented family. */
function register(vendor, family, models, source, options = {}) {
  for (const model of models) definitions.set(`${vendor}\0${model}`, {
    vendor, family, source, form: "rack", dataFace: "front", serviceFace: "front", stackFace: "front",
    powerFace: "rear", power: "region", sourcePage: "Front / rear panel diagrams and hardware overview", ...options,
  });
}

/** Resolve a cached model or family drawing independently of editable port labels. */
export function resolveEnterpriseFaceplate(device) {
  const extremeFinal = resolveExtremeFinalFaceplate(device);
  if (extremeFinal) return extremeFinal;
  const juniperSRX5K = resolveJuniperSRX5KFaceplate(device);
  if (juniperSRX5K) return juniperSRX5K;
  const extremeNext = resolveExtremeNextFaceplate(device);
  if (extremeNext) return extremeNext;
  const extremeG2 = resolveExtremeG2Faceplate(device);
  if (extremeG2) return extremeG2;
  const juniperModular = resolveJuniperModularFaceplate(device);
  if (juniperModular) return juniperModular;
  const juniperQFXSpine = resolveJuniperQFXSpineFaceplate(device);
  if (juniperQFXSpine) return juniperQFXSpine;
  const firepower9300 = resolveFirepower9300Faceplate(device);
  if (firepower9300) return firepower9300;
  const merakiAggregation = resolveMerakiAggregationFaceplate(device);
  if (merakiAggregation) return merakiAggregation;
  const merakiAdvanced = resolveMerakiAdvancedFaceplate(device);
  if (merakiAdvanced) return merakiAdvanced;
  const merakiAccess = resolveMerakiAccessFaceplate(device);
  if (merakiAccess) return merakiAccess;
  const juniperQFXAccess = resolveJuniperQFXAccessFaceplate(device);
  if (juniperQFXAccess) return juniperQFXAccess;
  const pa7050 = resolvePA7050Faceplate(device);
  if (pa7050) return pa7050;
  const pa5410 = resolvePA5410Faceplate(device);
  if (pa5410) return pa5410;
  const juniperEXCore = resolveJuniperEXCoreFaceplate(device);
  if (juniperEXCore) return juniperEXCore;
  const nexusFinal = resolveCiscoNexusFinalFaceplate(device);
  if (nexusFinal) return nexusFinal;
  const juniperQFXNext = resolveJuniperQFXNextFaceplate(device);
  if (juniperQFXNext) return juniperQFXNext;
  const ruckusFinal = resolveRuckusFinalFaceplate(device);
  if (ruckusFinal) return ruckusFinal;
  const ruckusNext = resolveRuckusNextFaceplate(device);
  if (ruckusNext) return ruckusNext;
  const pa5220 = resolvePA5220Faceplate(device);
  if (pa5220) return pa5220;
  const juniperEXNext = resolveJuniperEXNextFaceplate(device);
  if (juniperEXNext) return juniperEXNext;
  const nexusFamily = resolveCiscoNexusFamilyFaceplate(device);
  if (nexusFamily) return nexusFamily;
  const ruckusFamily = resolveRuckusFamilyFaceplate(device);
  if (ruckusFamily) return ruckusFamily;
  const juniperEX = resolveJuniperEXFamilyFaceplate(device);
  if (juniperEX) return juniperEX;
  const pa3410 = resolvePA3410Faceplate(device);
  if (pa3410) return pa3410;
  const ciscoISR = resolveCiscoISRFaceplate(device);
  if (ciscoISR) return ciscoISR;
  const ciscoEdge = resolveCiscoEdgeFaceplate(device);
  if (ciscoEdge) return ciscoEdge;
  const catalystChassis = resolveCatalystChassisFaceplate(device);
  if (catalystChassis) return catalystChassis;
  const arista = resolveAristaFaceplate(device);
  if (arista) return arista;
  const key = `${device?.faceplate?.vendor}\0${device?.model}`;
  const definition = definitions.get(key);
  if (!definition) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!layouts.has(key)) layouts.set(key, buildSophosModelFaceplate(canonical.device)
    || buildPaloAltoModelFaceplate(canonical.device) || buildCiscoASAModelFaceplate(canonical.device)
    || buildCiscoFirepowerModelFaceplate(canonical.device)
    || resolveCatalystFamilyFaceplate(canonical.device)
    || buildCiscoCatalystModelFaceplate(canonical.device)
    || buildCiscoNexusModelFaceplate(canonical.device)
    || buildCiscoMerakiModelFaceplate(canonical.device)
    || buildCiscoIndustrialModelFaceplate(canonical.device)
    || buildJuniperSRXModelFaceplate(canonical.device)
    || buildJuniperEXModelFaceplate(canonical.device)
    || buildCheckPointModelFaceplate(canonical.device)
    || buildDellModelFaceplate(canonical.device)
    || buildRuckusModelFaceplate(canonical.device)
    || resolveExtremeFaceplate(canonical.device)
    || buildProfile(canonical.device, definition));
  return layouts.get(key);
}

/** Make a reusable normalized component with restrained physical labeling. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Identify console and management sockets using immutable catalog roles. */
function isService(port) {
  return /console/i.test(port.type) || /^(MGMT|MGT|COM|CONSOLE|LOM|AUX)$/i.test(port.group);
}

/** Route each canonical socket to its documented family panel. */
function portFace(port, definition) {
  if (definition.rearQSFP && /^QSFP/.test(port.type)) return "rear";
  if (port.type === "Stack") return definition.stackFace;
  if (definition.usbConsoleFace && /^USB_.*CONSOLE$/.test(port.type)) return definition.usbConsoleFace;
  return isService(port) ? definition.serviceFace : definition.dataFace;
}

/** Assemble front and rear faces while preserving every typed inventory index. */
function buildProfile(device, definition) {
  const { form, family, source, sourcePage } = definition;
  const desktop = form === "desktop" || form === "industrial";
  const faces = { front: buildPanel(device, definition, "front"), rear: buildPanel(device, definition, "rear") };
  if (faces.front.ports.length && faces.rear.ports.length) {
    const units = Math.max(1, device.faceplate.unitsU);
    for (const panel of Object.values(faces)) panel.connectionMarker = { x: .025, y: 1 - .15 / units, width: .245, height: .13 / units };
  }
  const inventoryNotes = ["Family composition fitted to the catalog inventory; optional modules and connector counts depend on the actual SKU."];
  if (family.startsWith("Catalyst 92") || family.startsWith("Catalyst 93")) {
    inventoryNotes.push("Catalog USB-C console types are retained; 9200/9300 guide illustrations use Mini-B and RJ45 console connectors.");
  }
  if (device.model === "EX3400-24P") inventoryNotes.push("The catalog encodes the rear 40G QSFP+ uplinks as QSFP28_100G; the existing connector type and speed are preserved.");
  if (family === "Firepower 4100") inventoryNotes.push("The hardware guide specifies a 1U chassis; this diagram retains the catalog's 3U rack allocation and existing port inventory.");
  if (device.model === "QFX10000 family") inventoryNotes.push("The catalog's 2U family allocation also covers larger modular QFX10008/10016 chassis; the illustrated modular composition preserves the catalog allocation.");
  if (form === "modular") inventoryNotes.push("Line-card regions represent the catalog port groups; they do not assert a chassis slot count or installed module inventory.");
  return {
    id: `enterprise-${definition.vendor}-${device.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    family, fidelity: "family", source, sourcePage, inventoryNotes, catalogDiscrepancies: inventoryNotes.slice(1),
    defaultFace: definition.dataFace,
    chassis: desktop ? { x: form === "industrial" ? .26 : .15, y: .05, width: form === "industrial" ? .48 : .7, height: .9 }
      : { x: 0, y: .04, width: 1, height: .92 },
    faces,
  };
}

/** Fit one physical panel around separate service, data and cooling regions. */
function buildPanel(device, definition, face) {
  const units = Math.max(1, device.faceplate.unitsU);
  const components = [part("text", .035, .05 / units, .64, .12 / units, device.model)];
  const inventory = device.ports.filter((port) => portFace(port, definition) === face);
  const service = inventory.filter(isService);
  const data = inventory.filter((port) => !isService(port));
  const dataPanel = face === definition.dataFace;
  const powerHere = face === definition.powerFace;
  const compact = definition.form === "desktop" || definition.form === "industrial";
  const modular = definition.form === "modular";
  let dataRect = { x: .24, y: .28, width: .72, height: .49 };
  let serviceRect = { x: .035, y: .37, width: .15, height: .37 / units };
  if (dataPanel && powerHere) {
    dataRect = { x: .32, y: .28, width: .64, height: .49 };
    serviceRect = { x: .13, y: .37, width: .14, height: .37 / units };
    components.push(definition.power === "region"
      ? part("module-bay", .025, .34, .075, .4 / units, "POWER", "blank")
      : part("power", .035, .39, .045, .28 / units, "PWR", definition.power.includes("dc") ? "dc-keyed2" : "ac"));
  } else if (!dataPanel) {
    dataRect = { x: .235, y: .34, width: .17, height: .38 / units };
    if (powerHere) addPower(components, definition, units);
    if (definition.cooling !== false && definition.frontIndicators !== "none") {
      addCooling(components, definition, .435, .28, .25, Math.min(.46, .65 / units));
    }
  }
  if (modular && dataPanel) {
    // An unnumbered card field avoids inventing installed cards or slot counts.
    const left = powerHere ? .30 : .22;
    components.push(part("module-bay", left, .23, .98 - left, .57, undefined, "populated"),
      part("handle", left - .012, .29, .009, .43), part("handle", .979, .29, .009, .43));
    dataRect = { x: left + .03, y: .30, width: .92 - left, height: .46 };
  } else if (dataPanel) {
    dataRect.height /= units;
  }
  if (definition.expansion && dataPanel) {
    components.push(part("text", .68, .17, .27, .10 / units, definition.expansion));
  }
  if (face === "front" && definition.frontIndicators !== "none") {
    components.push(part("led", .044, .22, .009, .055 / units));
    if (definition.frontIndicators !== "single") components.push(part("led", .067, .22, .009, .055 / units), part("led", .09, .22, .009, .055 / units));
  }
  if (definition.display && face === "front") {
    components.push(part("module-bay", .11, .18, .105, .115 / units, "STATUS", "blank"));
  }
  if (!dataPanel && !powerHere && !inventory.length && definition.frontIndicators !== "none") {
    components.push(part("text", .28, .43, .48, .17, definition.vendor.toUpperCase()));
  }
  if (definition.form === "industrial" && face === "rear") {
    components.push(part("handle", .12, .28, .022, .47), part("handle", .17, .28, .022, .47));
  }
  const ports = [
    ...layoutPanelPorts(service, serviceRect, { rows: 2, portWidth: compact ? .065 : .035, portHeight: .15 / units }),
    ...layoutPanelPorts(data, dataRect, { rows: definition.rows || (modular ? Math.min(8, Math.max(2, Math.ceil(data.length / 16))) : data.length > 16 ? 2 : 1),
      portWidth: compact ? .062 : .034, portHeight: .23 / units }),
  ];
  return { components, ports };
}

/** Draw known inlet counts; unspecified configurations remain one labeled region. */
function addPower(components, definition, units) {
  const { power } = definition;
  if (power === "dual" || power === "triple") {
    const count = power === "triple" ? 3 : 2;
    const step = .27 / count;
    for (let index = 0; index < count; index++) {
      components.push(part("psu", .705 + index * step, .27, step - .015, .47 / units, `BAY ${index + 1}`, "ac"));
    }
  } else if (power === "dual-dc") {
    components.push(part("power", .78, .36, .04, .30 / units, "DC1", "dc-keyed2"), part("power", .87, .36, .04, .30 / units, "DC2", "dc-keyed2"));
  } else if (power === "fixed" || power === "dc") {
    components.push(part("power", .835, .34, .065, .35 / units, "PWR", power === "dc" ? "dc-keyed2" : "ac"));
  } else {
    components.push(part("module-bay", .72, .27, .24, .47 / units, "POWER", "blank"));
  }
}

/** Show only sourced fan counts; a vent denotes an unspecified cooling area. */
function addCooling(components, definition, x, y, width, height) {
  if (definition.fans) {
    const step = width / definition.fans;
    for (let index = 0; index < definition.fans; index++) {
      components.push(part("fan", x + index * step, y, step * .83, height));
    }
  } else components.push(part("vent", x, y, width, height, undefined, "slots"));
}
