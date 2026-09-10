import { canonicalFaceplateDevice, layoutPanelPorts } from "./faceplate-profile.js";

const profiles = new Map();
const GUIDES = {
  gate: "https://docs.fortinet.com/product/fortigate/hardware",
  switch: "https://docs.fortinet.com/product/fortiswitch/hardware",
  "90G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/4ff042da-3220-11ee-8e6d-fa163e15d75b/FG-90G-SERIES-QSG.pdf",
  "120G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f9fb064a-a672-11ee-8673-fa163e15d75b/FG-120G-QSG.pdf",
  "148F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3f38a8b3-0a5f-11eb-96b9-00505692583a/FortiSwitch-148F-Series-QSG.pdf",
  "448E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/9f94e4e9-920c-11ea-aafb-00505692583a/FortiSwitch-448E-Series-QSG.pdf",
  "624F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/073bc97f-589d-11ee-8e6d-fa163e15d75b/FS-624F-648F-Series-QSG.pdf",
  "231F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c03ec18a-01b9-11eb-96b9-00505692583a/FortiAP-231F-QSG.pdf",
  "511F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1268d682-14fb-11ec-a4c4-00505692583a/FortiExtender-511F-QuickStart_Online.pdf",
  "224E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e80c525a-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224E-Series-QSG.pdf",
  "248E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e6a256ac-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248E-Series-QSG.pdf",
  "424E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3c36fae6-fe82-11ea-96b9-00505692583a/FortiSwitch-424E-Series-QSG.pdf",
  "124G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1c64a2db-dd9e-11ef-8766-ca4255feedd9/FortiSwitch-124G-Series-QSG.pdf",
  "1048E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e5a90707-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-1048E-Series-QuickStart.pdf",
  "1048G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dfeede22-9992-11f0-855d-6af4c3636dc7/FortiSwitch-1048G-QSG.pdf",
  "2048F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/38b7ea4d-92f3-11ee-a142-fa163e15d75b/FS-2048F-QSG.pdf",
  "3032E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3215b9f7-50b3-11e9-94bf-00505692583a/FortiSwitch-3032E-QSG.pdf",
  "3032G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8f69aa17-aba7-11f0-a43a-72af6d868cc2/FortiSwitch-3032G-QSG.pdf",
  "524D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7da2e4b-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-524D-Series-QuickStart.pdf",
  "548D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e79f907f-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-548D-Series-QuickStart.pdf",
  "124E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e391baaa-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-124E-QSG.pdf",
  "148E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/4d0f9a01-6df1-11e9-81a4-00505692583a/FortiSwitch-148E-Series-QSG.pdf",
  "1024E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/002ca2c6-586f-11ec-bdf2-fa163e15d75b/FortiSwitch-1024E-QSG.pdf",
  "T1024F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3cd09f8b-2f5a-11ef-8c42-fa163e15d75b/FortiSwitch-T1024F-FPOE-QSG.pdf",
  "110G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e9bb65da-5e6b-11ef-bfe5-fa163e15d75b/FortiSwitch-110G-FPOE-QSG.pdf",
  "348G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ce3d8422-6a71-11f1-a33a-02356ffb40d9/FortiSwitch-348G-Series-QSG.pdf",
  "M426E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff713891-de2a-11e9-8977-00505692583a/FortiSwitch-M426E-FPOE-QSG.pdf",
  "248D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dcbce1f9-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248D-Series-QSG.pdf",
  "108F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/db0e275b-d07d-11eb-97f7-00505692583a/FortiSwitch-108F-Series-QSG.pdf",
  "224D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dd96f287-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224D-FPOE-QSG.pdf",
  "R108F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/76b61865-375d-11f0-a9d0-d2b0d2e22f7d/FSR-108F-QSG.pdf",
  "R112F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ee25faa8-375c-11f0-a9d0-d2b0d2e22f7d/FSR-112F-POE-QSG.pdf",
  "R216F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/0b499254-cf8a-11ef-8766-ca4255feedd9/FSR-216F-POE-QSG.pdf",
  "R424F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ea180604-eae6-11ed-8e6d-fa163e15d75b/FSR-424F-POE-QSG.pdf",
  "30G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b0f32597-a216-11ef-a705-1222899fa4e9/FG-30G-31G-QSG.pdf",
  "50G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/6a8514a8-4c87-11f0-a9d0-d2b0d2e22f7d/FG-50G-51G-QSG.pdf",
  "200G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff9309bd-92ed-11ef-a705-1222899fa4e9/FG-200G-Series-QSG.pdf",
  "400G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b659f32f-2d3f-11f1-b31d-02356ffb40d9/FG-400G-Series-QSG.pdf",
  "700G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/60b7c7f8-4173-11f0-a9d0-d2b0d2e22f7d/FG-700G-Series-QSG.pdf",
  "900G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fac0bc53-8f12-11ee-a142-fa163e15d75b/FG-900G-Series-QSG.pdf",
  "50G-SFP": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8c48dcc6-50de-11ef-bfe5-fa163e15d75b/FG-50G-SFP-QSG.pdf",
  "50G-DSL": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f6be9fcf-50dd-11ef-bfe5-fa163e15d75b/FG-50G-DSL-QSG.pdf",
  "50G-POE": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fc370037-50de-11ef-bfe5-fa163e15d75b/FG-50G-51G-SFP-POE-QSG.pdf",
  "80F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/13f24f18-1d87-11ec-8c53-00505692583a/FG-80F-Series-QSG.pdf",
  "40F-cell": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fd70142f-ff2f-11e9-8977-00505692583a/FG-FWF-40F-60F-Series-QSG.pdf",
  "400F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-400f-series.pdf",
  "1000F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1000f-series.pdf",
  "1100E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1100e-series.pdf",
  "1800F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1800f-series.pdf",
  "2600F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-2600f-series.pdf",
  "3000F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3000f-series.pdf",
  "3200F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3200f-series.pdf",
  "3500F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3500f-series.pdf",
  "3700F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3700f-series.pdf",
  "3000G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3000g-series.pdf",
  "3500G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3500g-series.pdf",
  "3800G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3800g-series.pdf",
  "4200F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cd72e3b6-d679-11ea-96b9-00505692583a/FortiGate-4200F-Series-QSG-Supplement.pdf",
  "4400F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5f9f3bd6-13c6-11eb-96b9-00505692583a/FortiGate-4400F-Series-Supplement.pdf",
  "4800F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5fa8d4ee-9cd4-11ed-8e6d-fa163e15d75b/FG-4800F-Series-QSG.pdf",
  "1100E-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8505790d-a81f-11e9-81a4-00505692583a/FortiGate-1100E-ACDC-Series-Supplement-QSG.pdf",
  "1800F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1891095c-72e5-11ea-9384-00505692583a/FortiGate-1800F-Series-Supplement.pdf",
  "2600F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c1ff9041-55c1-11eb-b9ad-00505692583a/FortiGate-2600F-Series-QSG.pdf",
  "3000F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/db9d59f7-e1f0-11ec-bb32-fa163e15d75b/FG-3000F-QSG.pdf",
  "200E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/da490160-1a0a-11e9-9685-f8bc1258b856/FortiGate-200E-201E-QSG.pdf",
  "300E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ef689af9-1a12-11e9-9685-f8bc1258b856/FortiGate_300E-301E_Supplement.pdf",
  "400E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8a2023c9-299c-11e9-94bf-00505692583a/FortiGate_400_401E_ACDC_Supplement_QSG.pdf",
  "500E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f10f67a8-1a12-11e9-9685-f8bc1258b856/FortiGate_500E-501E_Supplement.pdf",
  "600E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/186de9b7-1a21-11e9-9685-f8bc1258b856/FG-600E-Series-QSG.pdf",
  "50G-5G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3a955901-cdf9-11ef-91d4-7a9b9721b752/FG-50G-5G-Series-QSG.pdf",
  "2201E-ACDC": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f20a50ba-df0d-11e9-8977-00505692583a/FG-2201E-ACDC-QSG.pdf",
  "3300E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/6816e10f-df0f-11e9-8977-00505692583a/FortiGate-3300E-QSG.pdf",
  "3400E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f1bcf8ed-299c-11e9-94bf-00505692583a/FortiGate-340xE-Series-QSG-ACDC.pdf",
  "3600E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/91f40509-299d-11e9-94bf-00505692583a/FortiGate-3600E-Series-ACDC-Supplement.pdf",
  "3960E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7c49731-1a12-11e9-9685-f8bc1258b856/FortiGate-3960E-3980E-ACDC-QSG-Supplement.pdf",
  "2200E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-2200e-series.pdf",
  "2500E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_2500E.pdf",
  "2000E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/30f0af8a-91f2-11f1-8c5a-8e4c95ff11ac/FortiGate-2000E-2500E-QSG.pdf",
  "400E-Bypass": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/92ffc448-af44-11eb-b70b-00505692583a/FortiGate-400E-BYPASS-QSG-Supplement.pdf",
  "800D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/90a1371d-1a0b-11e9-9685-f8bc1258b856/FortiGate-800D-Supplement.pdf",
  "900D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cb4ad175-1a0b-11e9-9685-f8bc1258b856/FortiGate-900D-Supplement.pdf",
  "1000D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ae004e1f-1a0a-11e9-9685-f8bc1258b856/FortiGate-1000D-Supplement.pdf",
  "3000D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c0a5598b-1a0a-11e9-9685-f8bc1258b856/FortiGate-3000D-QSG-Supplement.pdf",
  "3100D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c33905b5-1a0a-11e9-9685-f8bc1258b856/FortiGate-3100D-QSG-Supplement.pdf",
  "3200D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b2956e69-1a0a-11e9-9685-f8bc1258b856/FortiGate-3200D-Supplement.pdf",
  "3700D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/a8cceba0-1a0a-11e9-9685-f8bc1258b856/FG-3700D-Supplement.pdf",
  "6000F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ffef9904-1a11-11e9-9685-f8bc1258b856/fortigate-6000F-system-guide.pdf",
  "R60F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/7ce61dd2-c2a7-11ea-8b7d-00505692583a/FGR-60F-3G4G-QSG.pdf",
  "R70F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8b28e316-a37b-11ed-8e6d-fa163e15d75b/FGR-70F-Series-QSG.pdf",
  "R70G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5351b79e-423d-11f0-a9d0-d2b0d2e22f7d/FGR-70G-QSG.pdf",
  "R50G-cell": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/2418bdeb-8b25-11ef-989d-ae5dfae880d6/FGR-50G-5G-QSG.pdf",
  "R70G-dual": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/a1edabaa-6ec8-11ef-8355-fa163e15d75b/FGR-70G-5G-DUAL-QSG.pdf",
  "7030E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/496f257b-1a0a-11e9-9685-f8bc1258b856/fortigate-7030E-system-guide.pdf",
  "7040E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/18bec63c-1a0a-11e9-9685-f8bc1258b856/fortigate-7040E-system-guide.pdf",
  "FIM7901E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/279bdb1a-1a0a-11e9-9685-f8bc1258b856/fim-7901E-guide.pdf",
  "7081F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/17ef7271-b6d2-11ed-8e6d-fa163e15d75b/fortigate-7081F-system-guide.pdf",
  "7121F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c7e69026-9283-11eb-b70b-00505692583a/fortigate-7121F-system-guide.pdf",
  "7000F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-7121f.pdf",
  "FPM7620F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cc4d4625-9284-11eb-b70b-00505692583a/fpm-7620F-guide.pdf",
};

/** Resolve Fortinet catalog panels without treating unverified variants as exact hardware. */
export function resolveFortinetFaceplate(device) {
  if (device?.faceplate?.vendor !== "Fortinet") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!profiles.has(device.model)) profiles.set(device.model, buildFortinetProfile(canonical));
  return profiles.get(device.model);
}

/** Create a normalized decorative component; coordinates follow illustrations, not measured dimensions. */
function element(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Keep canonical identity on a socket while assigning its documented panel position. */
function slot(port, x, y, width = .027, height = .22) {
  return { label: port.label, type: port.type, portIndex: port.portIndex, x, y, width, height };
}

/** Reuse sourced catalog connector centers and shrink crowded socket envelopes to preserve clearance. */
function catalogSlots(ports, portWidth = .032) {
  return ports.map((port) => {
    const horizontal = ports.filter((other) => other !== port && Math.abs(other.faceplateY - port.faceplateY) < .22)
      .map((other) => Math.abs(other.faceplateX - port.faceplateX)).filter((distance) => distance > .001);
    const vertical = ports.filter((other) => other !== port && Math.abs(other.faceplateX - port.faceplateX) < .032)
      .map((other) => Math.abs(other.faceplateY - port.faceplateY)).filter((distance) => distance > .001);
    return slot(port, port.faceplateX, port.faceplateY, Math.min(portWidth, ...horizontal.map((distance) => distance * .75)),
      Math.min(.22, ...vertical.map((distance) => distance * .7)));
  });
}

/** Establish honest family coverage before applying narrower, inspected model overrides. */
function buildFortinetProfile({ catalog, device }) {
  const model = catalog.model;
  const rugged = model.includes("Rugged");
  const compact = /^(?:FortiGate [3456789]\d[FG]|FortiSwitch (?:108F|110G))/.test(model) ||
    catalog.category === "AccessPoint" || model.startsWith("FortiExtender");
  const documented = catalog.portLayout.positionFidelity === "exact";
  const source = /^https:\/\//.test(catalog.portLayout.source) ? catalog.portLayout.source : GUIDES.gate;
  const management = device.ports.filter((port) => /CONSOLE|MGMT/.test(port.group || "") || /CONSOLE|MGMT/i.test(port.label));
  const data = device.ports.filter((port) => !management.includes(port));
  const front = documented ? catalogSlots(device.ports, compact ? .052 : .032) : [
    ...layoutPanelPorts(management, { x: .045, y: .45, width: .15, height: .36 }, { rows: 2, portWidth: .035 }),
    ...layoutPanelPorts(data, { x: .25, y: .29, width: .70, height: .47 }, { rows: 2, portWidth: .037 }),
  ];
  const profile = {
    id: `fortinet-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, defaultFace: "front",
    fidelity: "family", source, sourcePage: documented ? "Front-panel connector diagram (catalog reference)" : "Family hardware reference; schematic connector placement",
    connectorFidelity: documented ? "model" : "family", rearHardwareVerified: false,
    geometry: documented ? "catalog" : "schematic",
    chassis: { x: compact || rugged ? .175 : 0, y: .04, width: compact || rugged ? .65 : 1, height: .92 },
    faces: { front: { ports: front, components: [] }, rear: { ports: [], components: [
      element("text", .23, .40, .54, .16, "Rear hardware not verified"),
    ] } },
    limitations: [documented ? "Connector centers follow the catalog reference; rear hardware has not been independently traced." :
      "Connector grouping follows the catalog inventory; chassis, port face and positions are schematic. Rear hardware is unverified."],
    catalogDiscrepancies: [],
    inventoryComplete: null, missingPorts: [], panelsVerified: false,
    inventoryRevision: catalog.inventoryRevision || 0,
  };
  if (!documented && model.startsWith("FortiGate") && !rugged && catalog.fidelity !== "modular") {
    profile.faces.front.components = familyIndicators(["POWER", "STATUS", "HA"], .045, .16, .065);
    profile.limitations.push("Indicator placement is a FortiGate family schematic, not an exact revision-specific drawing.");
  }
  if (model === "FortiGate 40F-3G4G") add40FCellular(profile, device);
  else if (/^FortiGate 8[01]F-(?:Bypass|POE)$/.test(model)) add80FVariant(profile, device);
  else if (/^FortiGate (?:40F|6[01]F|7[01][FG]|8[01]F)(?:-|$)/.test(model)) addDesktopFamily(profile, device);
  else if (/^FortiSwitch 148F(?:-POE|-FPOE)?$/.test(model)) add148F(profile, device);
  else if (/^FortiSwitch 448E(?:-POE|-FPOE)?$/.test(model)) add448E(profile, device);
  else if (/^FortiSwitch (?:624F|648F)(?:-FPOE)?$/.test(model)) addCampusF(profile, device);
  else if (/^FortiGate 12[01]G$/.test(model)) add120G(profile, device);
  else if (/^FortiGate 9[01]G$/.test(model)) add90G(profile, device);
  else if (model === "FortiAP 231F") add231F(profile, device);
  else if (model === "FortiExtender 511F") add511F(profile, device);
  else if (/^FortiSwitch (?:224E|248E)(?:-POE|-FPOE)?$/.test(model)) addAccessE(profile, device);
  else if (/^FortiSwitch 424E(?:-Fiber|-POE|-FPOE)?$/.test(model)) add424E(profile, device);
  else if (/^FortiSwitch 124G(?:-FPOE)?$/.test(model)) add124G(profile, device);
  else if (/^FortiSwitch 1048[EG]$/.test(model)) add1048(profile, device);
  else if (model === "FortiSwitch 2048F") add2048F(profile, device);
  else if (/^FortiSwitch 3032[EG]$/.test(model)) add3032(profile, device);
  else if (/^FortiSwitch 5(?:24|48)D(?:-FPOE)?$/.test(model)) add500D(profile, device);
  else if (/^FortiSwitch 1(?:24|48)E(?:-POE|-FPOE)?$/.test(model)) add100E(profile, device);
  else if (/^FortiSwitch (?:T?1024E|T1024F-FPOE)$/.test(model)) add1024(profile, device);
  else if (model === "FortiSwitch 110G-FPOE") add110G(profile, device);
  else if (model === "FortiSwitch M426E-FPOE") addM426E(profile, device);
  else if (model === "FortiSwitch 248D") add248D(profile, device);
  else if (/^FortiSwitch 348G(?:-FPOE)?$/.test(model)) add348G(profile, device);
  else if (/^FortiSwitch 108F(?:-POE|-FPOE)?$/.test(model)) add108F(profile, device);
  else if (model === "FortiSwitch 224D-FPOE") add224D(profile, device);
  else if (/^FortiSwitch Rugged (?:108F|112F-POE)$/.test(model)) addRugged100F(profile, device);
  else if (model === "FortiSwitch Rugged 216F-POE") addRugged216F(profile, device);
  else if (model === "FortiSwitch Rugged 424F-POE") addRugged424F(profile, device);
  else if (/^FortiGate 3[01]G$/.test(model)) add30G(profile, device);
  else if (/^FortiGate 5[01]G$/.test(model)) add50G(profile, device);
  else if (/^FortiGate 20[01]G$/.test(model)) add200G(profile, device);
  else if (/^FortiGate [47]0[01]G$/.test(model)) add400700G(profile, device);
  else if (/^FortiGate 90[01]G(?:-DC)?$/.test(model)) add900G(profile, device);
  else if (/^FortiGate (?:50G-(?:SFP|DSL)|5[01]G-SFP-POE)$/.test(model)) add50GWiredVariant(profile, device);
  else if (/^FortiGate 40[01]F-DC$/.test(model)) add400FDC(profile, device);
  else if (/^FortiGate 100[01]F$/.test(model)) add1000F(profile, device);
  else if (/^FortiGate 110[01]E$/.test(model)) add1100E(profile, device);
  else if (/^FortiGate 180[01]F$/.test(model)) add1800F(profile, device);
  else if (/^FortiGate 260[01]F$/.test(model)) add2600F(profile, device);
  else if (/^FortiGate 300[01]F$/.test(model)) add3000F(profile, device);
  else if (/^FortiGate 320[01]F$/.test(model)) add3200F(profile, device);
  else if (/^FortiGate 350[01]F$/.test(model)) add3500F(profile, device);
  else if (/^FortiGate 370[01]F$/.test(model)) add3700F(profile, device);
  else if (/^FortiGate 300[01]G$/.test(model)) add3000G(profile, device);
  else if (/^FortiGate 350[01]G$/.test(model)) add3500G(profile, device);
  else if (/^FortiGate 380[01]G$/.test(model)) add3800G(profile, device);
  else if (/^FortiGate (?:420[01]F|440[01]F)(?:-DC)?$/.test(model)) add42004400F(profile, device);
  else if (/^FortiGate 480[01]F(?:-DC)?(?:-NEBS)?$/.test(model)) add4800F(profile, device);
  else if (/^FortiGate (?:1100E|180[01]F|260[01]F|300[01]F)-DC$/.test(model)) addTerminalDC(profile, device);
  else if (/^FortiGate 20[01]E$/.test(model)) add200E(profile, device);
  else if (/^FortiGate (?:[3456]0[01]E|401E-DC)$/.test(model)) addLegacyRackE(profile, device);
  else if (/^FortiGate 5[01]G-5G$/.test(model)) add50GCellular(profile, device);
  else if (model === "FortiGate 2201E-ACDC" || /^FortiGate (?:220[01]E|330[01]E)$/.test(model)) add22013300E(profile, device);
  else if (/^FortiGate (?:340[01]E(?:-DC)?|360[01]E|3600E-DC)$/.test(model)) add34003600E(profile, device);
  else if (/^FortiGate 39[68]0E(?:-DC)?$/.test(model)) add39603980E(profile, device);
  else if (/^FortiGate (?:2000E|2500E)$/.test(model)) add20002500E(profile, device);
  else if (model === "FortiGate 400E-Bypass") add400EBypass(profile, device);
  else if (/^FortiGate 800D(?:-DC)?$/.test(model)) add800D(profile, device);
  else if (/^FortiGate (?:900D|1000D)$/.test(model)) add9001000D(profile, device);
  else if (/^FortiGate 3[012]00D(?:-DC)?$/.test(model)) add300031003200D(profile, device);
  else if (/^FortiGate 3700D(?:-DC)?$/.test(model)) add3700D(profile, device);
  else if (/^FortiGate (?:6001F|6[35]0[01]F(?:-DC)?)$/.test(model)) add6000F(profile, device);
  else if (/^FortiGate Rugged 60F(?:-3G4G)?$/.test(model)) addRugged60F(profile, device);
  else if (/^FortiGate Rugged 70F(?:-3G4G)?$/.test(model)) addRugged70F(profile, device);
  else if (model === "FortiGate Rugged 70G") addRugged70G(profile, device);
  else if (/^FortiGate Rugged (?:50G-5G|70G-5G-Dual)$/.test(model)) addRuggedGCellular(profile, device);
  else if (/^FortiGate 70[34]0E$/.test(model)) add70307040E(profile, device);
  else if (/^FortiGate (?:7081F(?:-DC|-2-DC)?|7121F(?:-2)?(?:-DC)?)$/.test(model)) add7000FChassis(profile, device);
  if (/^FortiGate (?:180[01]F(?:-DC)?|350[01]F)$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex])) }];
  if (/^FortiGate 300[01](?:G|F(?:-(?:ACDC|DC))?)$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.map((port) => [port.portIndex <= 18 ? port.portIndex : port.portIndex + 2, port.portIndex])) }];
  if (/^FortiGate 420[01]F(?:-DC)?$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.filter((port) => ![21, 22].includes(port.portIndex))
      .map((port) => [port.portIndex > 22 ? port.portIndex - 2 : port.portIndex, port.portIndex])) }];
  addLegacyEMapping(profile, device);
  addLegacyDMapping(profile, device);
  const units = Math.max(1, Number(catalog.units) || 1);
  for (const face of Object.values(profile.faces)) {
    for (const port of face.ports) port.height = Math.min(port.height, .24 / (units * profile.chassis.height));
  }
  if (catalog.fidelity === "modular" && !profile.panelsVerified) addModularRegion(profile, device, units);
  if (profile.panelsVerified) recordMissingPorts(profile, device);
  return profile;
}

/** Describe omitted sockets without silently adding endpoints or changing the persisted catalog inventory. */
function recordMissingPorts(profile, device) {
  for (const [faceName, face] of Object.entries(profile.faces)) {
    const missing = face.components.filter((component) => component.kind === "console" ||
      (/^FortiGate 9[01]G$/.test(device.model) && component.kind === "rj45"));
    for (const [index, component] of missing.entries()) profile.missingPorts.push({
      model: device.model, existingCount: device.ports.length,
      type: component.kind === "console" ? "Console" : "RJ45_10G",
      label: component.kind === "console" ? "CONSOLE" : `WAN${index + 1} / X${index + 1} (shared copper; revision-dependent label)`,
      face: faceName, slot: { x: component.x + component.width / 2, y: component.y + component.height / 2,
        width: component.width, height: component.height },
    });
  }
}

/** Represent a modular chassis region without claiming an unverified module or power-supply count. */
function addModularRegion(profile, device, units) {
  profile.faces.front.ports = layoutPanelPorts(device.ports, { x: .045, y: .07, width: .14, height: Math.min(.38, .72 / units) },
    { rows: 2, portWidth: .035, portHeight: .24 / units });
  profile.faces.front.components.push(element("module-bay", .245, .14, .67, .72, "MODULE AREA", "blank"));
  profile.limitations.push("The module area is schematic; installed cards, slot count and populated module ports require the exact chassis configuration.");
}

/** Keep family status labels separate from small indicator artwork. */
function familyIndicators(labels, x, y, step) {
  return labels.flatMap((label, index) => [element("led", x + index * step, y, .008, .045),
    element("text", x + index * step - .023, y - .105, .056, .08, label)]);
}

/** Apply the documented connector-bearing rear face across the 40/60/70/80 desktop families. */
function addDesktopFamily(profile, device) {
  profile.defaultFace = "rear";
  profile.faces.rear.ports = profile.faces.front.ports;
  profile.faces.rear.components = [];
  profile.faces.front.ports = [];
  profile.faces.front.components = familyIndicators(["POWER", "STATUS", "HA"], .29, .65, .095);
  const count = device.ports.filter((port) => port.type !== "Console").length;
  profile.faces.front.components.push(element("text", .60, .24, .32, .13, "LINK / ACT"));
  for (let index = 0; index < count; index++) {
    const x = .60 + index * .30 / Math.max(1, count - 1);
    profile.faces.front.components.push(element("led", x, .47, .007, .045), element("led", x, .65, .007, .045));
  }
  profile.limitations = ["The family has rear network connectors and front status indicators. Power, radio and revision-specific controls are omitted until the exact variant is traced."];
}

/** Mark panels inspected in a particular guide while recording catalog limitations separately. */
function inspected(profile, guide, page, discrepancies = []) {
  profile.source = GUIDES[guide];
  profile.sourcePage = `PDF ${page}`;
  profile.fidelity = discrepancies.length ? "family" : "model";
  profile.connectorFidelity = "model";
  profile.geometry = "illustration";
  profile.rearHardwareVerified = true;
  profile.limitations = [];
  profile.catalogDiscrepancies = discrepancies;
  profile.inventoryComplete = discrepancies.length === 0;
  profile.panelsVerified = true;
}

/** Draw four twelve-port banks and two optical columns shared by inspected 48-port access models. */
function access48Slots(ports) {
  return ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 48) {
      const column = Math.floor(index / 2);
      return slot(port, .112 + column * .0318 + Math.floor(column / 6) * .012, index % 2 ? .68 : .4, .024);
    }
    if (index < 52) return slot(port, index < 50 ? .936 : .969, index % 2 ? .68 : .4, .025);
    return slot(port, .035, .43, .03);
  });
}

/** Compose all three 148F variants, whose rear AC inlet position differs by PoE capability. */
function add148F(profile, device) {
  const suffix = device.model.slice("FortiSwitch 148F".length);
  inspected(profile, "148F", suffix === "-POE" ? "6–7" : suffix === "-FPOE" ? "8–9" : "4–5");
  profile.faces.front.ports = access48Slots(device.ports);
  profile.faces.front.components = [element("usb", .02, .69, .03, .14, undefined, "a"),
    element("led", .076, .42, .005, .045), element("led", .076, .61, .005, .045)];
  profile.faces.rear.components = [element("power", suffix ? .30 : .79, .26, suffix ? .075 : .11, .54, "AC", "ac")];
}

/** Preserve the 448E inventory while showing its documented rear console as an ancillary connector. */
function add448E(profile, device) {
  const suffix = device.model.slice("FortiSwitch 448E".length);
  inspected(profile, "448E", suffix === "-POE" ? "5–6" : suffix === "-FPOE" ? "7–8" : "3–4",
    ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = access48Slots(device.ports);
  profile.faces.front.components = [element("usb", .02, .69, .03, .14, undefined, "a"),
    element("led", .076, .42, .005, .045), element("led", .076, .61, .005, .045)];
  profile.faces.rear.components = [element("console", .175, .43, .034, .30, "CONSOLE"),
    element("fan", .277, .13, .09, .73, undefined, "fixed"), element("fan", .39, .13, .09, .73, undefined, "fixed"),
    element("power", .565, .28, .105, .52, "PSU1", "ac"), element("power", .75, .28, .105, .52, "PSU2", "ac")];
  profile.fidelity = "model";
}

/** Compose the inspected 624F and 648F front banks and their distinct three/four-fan rear panels. */
function addCampusF(profile, device) {
  const large = device.model.startsWith("FortiSwitch 648F");
  const count = large ? 48 : 24;
  inspected(profile, "624F", large ? "8–9" : "6–7");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      const x = large ? .03 + column * .032 + Math.floor(column / 8) * .012 :
        .415 + column * .032 + (column >= 4 ? .019 : 0);
      return slot(port, x, index % 2 ? .69 : .4, .025);
    }
    if (index < count + (large ? 8 : 4)) {
      return slot(port, (large ? .824 : .836) + Math.floor((index - count) / 2) * .032,
        index % 2 ? .69 : .4, .025);
    }
    return slot(port, .961, port.type === "Console" ? .76 : .30, .03, .20);
  });
  profile.faces.front.components = [element("usb", .946, .48, .03, .12, undefined, "a")];
  profile.faces.rear.components = [
    element("coax", .047, .67, .017, .14, "1PPS IN"), element("coax", .074, .67, .017, .14, "1PPS OUT"),
    ...Array.from({ length: large ? 4 : 3 }, (_, index) => element("fan", .146 + index * .11, .12, .087, .74, undefined, "fixed")),
    element("psu", .62, .05, .167, .90, "PSU1", "ac"), element("psu", .812, .05, .167, .90, "PSU2", "ac"),
  ];
}

/** Locate the 120G family's ports independently of its catalog's older sequential naming. */
function add120G(profile, device) {
  inspected(profile, "120G", "4–6", ["Catalog sequential labels do not match HA/MGMT, ports 1–24 and X1–X4; existing labels are preserved."]);
  profile.fidelity = "model";
  profile.inventoryComplete = true;
  profile.hardwareRevision = "Pxxxxx-2x-01 and above";
  profile.limitations.push("The signed-firmware switch cover follows Pxxxxx-2x-01 and above; earlier revisions omit that covered control.");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 2) return slot(port, .321, index % 2 ? .70 : .40);
    if (index < 18) {
      const column = Math.floor((index - 2) / 2);
      return slot(port, .372 + column * .0335 + (column >= 4 ? .030 : 0), index % 2 ? .70 : .40);
    }
    if (index < 26) return slot(port, .762 + Math.floor((index - 18) / 2) * .0335, index % 2 ? .70 : .40);
    if (index < 30) return slot(port, .686 + Math.floor((index - 26) / 2) * .034, index % 2 ? .70 : .40);
    return slot(port, .27, .65);
  }).map((port, index) => ({ ...port, physicalLabel: index < 2 ? ["HA", "MGMT"][index] : index < 18 ? String(index - 1) :
    index < 26 ? String(index - 1) : index < 30 ? `X${index - 25}` : "CONSOLE" }));
  profile.faces.front.components = [element("usb", .23, .50, .014, .29, undefined, "a"),
    element("module-bay", .105, .51, .018, .40, "", "blank"),
    element("led", .141, .72, .005, .04), element("button", .175, .70, .006, .04, undefined, "reset"),
    element("vent", .497, .22, .020, .62, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .199, .48 + index * .10, .005, .04),
      element("text", .13, .45 + index * .10, .058, .10, label),
    ])];
  profile.faces.rear.components = [element("power", .095, .31, .074, .50, "PSU1", "ac"),
    element("power", .835, .31, .074, .50, "PSU2", "ac"), element("vent", .393, .14, .185, .73, undefined, "perforated")];
}

/** Draw 90G connector positions while exposing its missing shared-media catalog sockets. */
function add90G(profile, device) {
  inspected(profile, "90G", "4–6", ["The catalog omits two shared 10G RJ45 sockets and labels A/B as 7/8. Ancillary shared sockets have no connection endpoints."]);
  profile.fidelity = "model";
  profile.hardwareRevision = "Pxxxxx-11-01 and above";
  profile.limitations.push("The signed-firmware cover and X1/X2 labels follow Pxxxxx-11-01 and above; earlier revisions use WAN1/WAN2 and omit that control.");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 8) return slot(port, .565 + Math.floor(index / 2) * .065, index % 2 ? .68 : .34, .052, .25);
    if (index < 10) return slot(port, .32, index % 2 ? .68 : .34, .055, .25);
    return slot(port, .222, .44, .055, .25);
  }).map((port, index) => ({ ...port, physicalLabel: index < 6 ? String(index + 1) : index < 8 ? ["A", "B"][index - 6] :
    index < 10 ? `SFP+${index - 7}` : "CONSOLE" }));
  profile.faces.front.components = [element("usb", .194, .71, .055, .16, undefined, "a"),
    element("rj45", .409, .215, .055, .25, "X1"), element("rj45", .409, .555, .055, .25, "X2"),
    element("module-bay", .91, .215, .043, .22, "", "blank"),
    element("led", .878, .84, .012, .05), element("button", .065, .74, .011, .05, undefined, "reset"),
    element("text", .393, .855, .088, .11, "SHARED"),
    element("led", .13, .70, .012, .07), element("led", .154, .70, .012, .07), element("led", .13, .56, .012, .07)];
  profile.faces.rear.components = [element("vent", .075, .17, .65, .16, undefined, "slots"),
    element("vent", .075, .47, .65, .30, undefined, "slots"),
    element("power", .835, .38, .032, .45, "DC1", "dc-keyed2"), element("power", .897, .38, .032, .45, "DC2", "dc-keyed2")];
}

/** Project the 231F underside connector edge and front indicator strip without inventing a console endpoint. */
function add231F(profile, device) {
  inspected(profile, "231F", "3–4", ["Catalog ETH0/ETH1 correspond to LAN1/PoE and LAN2. The separate RJ45 console is absent from inventory."]);
  profile.defaultFace = "rear";
  profile.limitations.push("The mounting underside and its connector edge are projected into one rear diagram; dimensions are schematic.");
  profile.chassis = { x: .30, y: .04, width: .40, height: .92 };
  profile.faces.front = { ports: [], components: [element("text", .2, .30, .6, .15, "FortiAP 231F"),
    ...familyIndicators(["PWR", "LAN1", "LAN2", "WIFI", "BLE"], .28, .68, .105)] };
  profile.faces.rear = { ports: device.ports.map((port, index) => slot(port, index ? .55 : .71, .73, .075, .21)),
    components: [element("vent", .07, .23, .14, .61, undefined, "slots"),
      element("vent", .82, .23, .11, .61, undefined, "slots"),
      element("module-bay", .28, .23, .45, .30, "MOUNT", "blank"),
      element("console", .352, .625, .075, .21), element("power", .245, .68, .047, .13, undefined, "dc-barrel"),
      element("usb", .44, .04, .12, .11, undefined, "a")] };
}

/** Draw the 511F Ethernet edge and opposite SIM/Bluetooth panel from its illustrated QSG. */
function add511F(profile, device) {
  inspected(profile, "511F", "4–5", ["The catalog omits the separate RJ45 console; it is shown as an ancillary connector."]);
  profile.fidelity = "model";
  profile.limitations.push("The two opposite connector/control edges are the front and rear views. Antenna connectors on a third edge and the top-face cellular indicators are outside these two side-panel projections.");
  profile.faces.front.ports = device.ports.map((port, index) => slot(port,
    index < 4 ? .526 + index * .078 : index === 4 ? .446 : .337, .56, .066, .24));
  profile.faces.front.components = [element("console", .135, .44, .075, .24),
    element("usb", .240, .35, .028, .36, undefined, "a"),
    element("power", .834, .39, .05, .32, "12V", "dc-barrel"),
    element("led", .329, .34, .012, .045)];
  profile.faces.rear.components = [element("module-bay", .453, .39, .313, .50, "SIM", "blank"),
    element("button", .263, .43, .126, .43, "BLUETOOTH"),
    element("led", .304, .41, .035, .045),
    element("button", .825, .54, .012, .075, undefined, "reset"),
    element("text", .79, .75, .10, .10, "RESET"),
    element("module-bay", .156, .54, .039, .075, "", "blank")];
}

/** Trace 224E/248E access panels, including their omitted rear console and variant-specific power connections. */
function addAccessE(profile, device) {
  const large = device.model.startsWith("FortiSwitch 248E");
  const poe = device.model.includes("POE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "248E" : "224E", device.model.endsWith("FPOE") || (!large && poe) ? "8" : "7",
    ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      return slot(port, large ? .123 + column * .033 + Math.floor(column / 12) * .012 :
        .23 + column * .0485 + (column >= 6 ? .025 : 0), index % 2 ? .70 : .43, large ? .025 : .040);
    }
    if (index < count + 4) return slot(port, (large ? .937 : .86) + Math.floor((index - count) / 2) * (large ? .032 : .083),
      index % 2 ? .70 : .43, large ? .025 : .040);
    return slot(port, large ? .04 : .05, .63, .034);
  });
  profile.faces.front.components = [element("led", large ? .075 : .125, .27, .005, .04),
    element("led", large ? .075 : .125, .38, .005, .04), element("led", large ? .075 : .125, .63, .005, .04)];
  profile.faces.rear.components = [element("console", large ? .88 : .065, .50, .04, .30, "CONSOLE"),
    element("power", large ? .16 : .83, .28, .10, .53, "AC", "ac")];
  if (poe) {
    profile.faces.rear.components.push(element("module-bay", large ? .70 : .15, .46, large ? .16 : .21, .36, "RPS", "blank"));
    profile.limitations.push("The remote-power connector is shown as a labeled region; its multipin contact pattern is not modeled.");
  } else profile.faces.rear.components.push(element("power", .615, .28, .10, .53, "AC", "ac"));
  profile.fidelity = "model";
}

/** Trace the 424E family's rear console and the distinct zero/one/two rear fan arrangements. */
function add424E(profile, device) {
  const fiber = device.model.endsWith("Fiber");
  const poe = device.model.includes("POE");
  inspected(profile, "424E", "3–4", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 24) {
      const column = Math.floor(index / 2);
      return slot(port, (fiber ? .438 : .427) + column * .0325 + Math.floor(column / (fiber ? 4 : 6)) * .010,
        index % 2 ? .68 : .38, .027);
    }
    if (index < 28) return slot(port, .855 + (index - 24) * .0325, .70, .027);
    return slot(port, .031, .43, .033);
  });
  profile.faces.front.components = [element("usb", .015, .69, .033, .14, undefined, "a"),
    ...[0, 1, 2, 3].map((index) => element("led", .085, .32 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", poe ? .067 : fiber ? .167 : .136, .47, .035, .32, "CONSOLE"),
    element("power", poe ? .34 : fiber ? .66 : .615, .24, .105, .54, "PSU1", "ac"),
    element("power", poe ? .852 : .80, .24, .105, .54, "PSU2", "ac")];
  if (poe) profile.faces.rear.components.push(element("fan", .55, .08, .09, .82, undefined, "fixed"),
    element("fan", .743, .08, .09, .82, undefined, "fixed"));
  else if (!fiber) profile.faces.rear.components.push(element("fan", .232, .08, .09, .82, undefined, "fixed"));
  profile.fidelity = "model";
}

/** Trace the 124G and 124G-FPOE's three copper banks, six uplinks and fanless rear panels. */
function add124G(profile, device) {
  const poe = device.model.endsWith("FPOE");
  inspected(profile, "124G", poe ? "7–8" : "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = Number(port.label) - 1;
    if (port.type === "Console") return slot(port, .213, .65, .033);
    if (index < 24) return slot(port, .318 + Math.floor(index / 2) * .036 + Math.floor(index / 8) * .010,
      index % 2 ? .68 : .34, .030);
    return slot(port, .877 + Math.floor((index - 24) / 2) * .043, index % 2 ? .68 : .34, .033);
  });
  profile.faces.front.components = [element("usb", .774, .49, .015, .30, undefined, "a"),
    element("led", .282, .75, .005, .05),
    ...["PWR", "ALARM", "BT/BLE", ...(poe ? ["POE MAX"] : [])].flatMap((label, index) => [
      element("led", .242, .39 + index * .12, .005, .04),
      element("text", .251, .35 + index * .12, .052, .09, label),
    ])];
  profile.faces.rear.components = [element("power", .85, .26, .11, .54, "AC", "ac")];
}

/** Compose the independently traced 1048E and 1048G layouts with their different management sides and fan counts. */
function add1048(profile, device) {
  const generationG = device.model.endsWith("G");
  inspected(profile, generationG ? "1048G" : "1048E", generationG ? "6–7" : "8");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, generationG ? .029 : .971,
      generationG ? (port.type === "Console" ? .24 : .74) : (port.type === "Console" ? .72 : .35), .030);
    const index = Number(port.label) - 1;
    if (index < 48) {
      const column = Math.floor(index / 2);
      return slot(port, generationG ? .074 + column * .0327 + Math.floor(column / 8) * .006 :
        .025 + column * .0324 + Math.floor(column / 6) * .004, index % 2 ? .68 : .36, .026);
    }
    return slot(port, (generationG ? .876 : .839) + Math.floor((index - 48) / 2) * (generationG ? .043 : .044),
      index % 2 ? .68 : .36, .035);
  });
  profile.faces.front.components = generationG ? [element("usb", .014, .45, .032, .12, undefined, "a"),
    element("vent", .14, .025, .714, .14, undefined, "mesh"),
    ...[0, 1, 2, 3].map((index) => element("led", .064 + index * .013, .12, .004, .04))] :
    [element("vent", .07, .035, .70, .07, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .045, .03, .168, .94, "PSU2", "ac"),
    element("psu", generationG ? .783 : .787, .03, .168, .94, "PSU1", "ac"),
    ...Array.from({ length: generationG ? 5 : 4 }, (_, index) => element("fan", .225 + index * .11, .035, .102, .93, undefined, "removable"))];
  if (!generationG) profile.faces.rear.components.push(element("usb", .695, .55, .026, .13, undefined, "a"));
}

/** Trace the 2048F's three-row SFP28 groups, lower QSFP rows and six removable fan modules. */
function add2048F(profile, device) {
  inspected(profile, "2048F", "6–7");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .953, port.type === "Console" ? .52 : .18, .034, .22);
    const index = Number(port.label) - 1;
    if (index < 48) {
      const column = Math.floor(index / 3);
      return slot(port, .055 + column * .0335 + Math.floor(column / 2) * .0096,
        [.18, .52, .83][index % 3], .030, .19);
    }
    if (index < 56) return slot(port, .718 + Math.floor((index - 48) / 2) * .045 + Math.floor((index - 48) / 4) * .010,
      index % 2 ? .83 : .52, .040, .19);
    return slot(port, .908, index % 2 ? .52 : .18, .032, .20);
  });
  profile.faces.front.components = [element("usb", .892, .76, .032, .12, undefined, "a"),
    ...[0, 1, 2].map((index) => element("led", .026, .36 + index * .075, .004, .04)),
    element("vent", .002, .20, .018, .68, undefined, "mesh"),
    element("vent", .978, .20, .018, .68, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .035, .02, .125, .96, "PSU2", "ac"),
    element("psu", .84, .02, .125, .96, "PSU1", "ac"),
    ...Array.from({ length: 6 }, (_, index) => element("fan", .176 + index * .111, .025, .098, .95, undefined, "removable"))];
}

/** Trace both 3032 generations without copying the G model's extra SFP+ pair onto the E model. */
function add3032(profile, device) {
  const generationG = device.model.endsWith("G");
  inspected(profile, generationG ? "3032G" : "3032E", generationG ? "6–7" : "7–8");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, generationG ? .886 : .876,
      port.type === "Console" ? .68 : .30, .033);
    const index = Number(port.label) - 1;
    if (index >= 32) return slot(port, .075, index % 2 ? .64 : .34, .033);
    const column = Math.floor(index / 2);
    return slot(port, (generationG ? .123 : .122) + column * .043 + Math.floor(column / 4) * .015,
      index % 2 ? .64 : .34, .038);
  });
  profile.faces.front.components = [element("usb", generationG ? .942 : .935, .42, .016, .32, undefined, "a"),
    element("vent", .10, .02, .76, .11, undefined, "mesh"),
    element("vent", .025, .59, .025, .30, undefined, "mesh"),
    ...[0, 1, 2, 3].map((index) => element("led", generationG ? .911 : .902, .15 + index * .22, .005, .05))];
  profile.faces.rear.components = [element("psu", .045, .025, .17, .95, "PSU2", "ac"),
    element("psu", .785, .025, .17, .95, "PSU1", "ac"),
    ...Array.from({ length: 5 }, (_, index) => element("fan", .225 + index * .111, .025, .101, .95, undefined, "removable"))];
}

/** Trace the 524D and 548D's copper groups and standard one-PSU configuration with optional second bay. */
function add500D(profile, device) {
  const large = device.model.startsWith("FortiSwitch 548D");
  const poe = device.model.endsWith("FPOE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "548D" : "524D", poe ? "8" : "9");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .69, .033);
    if (port.type === "USB_MICRO_CONSOLE") return slot(port, .038, .91, .027, .065);
    const index = Number(port.label) - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      return slot(port, .081 + column * .0334 + Math.floor(column / 6) * .004, index % 2 ? .73 : .44, .026);
    }
    if (index < count + 4) return slot(port, .889 + Math.floor((index - count) / 2) * .032, index % 2 ? .73 : .44, .027);
    return slot(port, .968, index % 2 ? .73 : .44, .033);
  });
  profile.faces.front.components = [element("module-bay", .02, .12, .033, .16, "ID", "blank"),
    element("vent", .21, .025, .73, .13, undefined, "perforated"),
    ...[0, 1, 2, 3].map((index) => element("led", .119 + index * .017, .13, .005, .045))];
  profile.faces.rear.components = [element("fan", .223, .06, .09, .83, undefined, "fixed"),
    element("module-bay", .59, .025, .205, .95, "PSU2 OPTIONAL", "blank"),
    element("psu", .806, .025, .168, .95, "PSU1", "ac")];
  profile.limitations.push("The guide's standard configuration is shown: one installed PSU and the optional second PSU bay blank.");
}

/** Trace the 100E access variants, including the 124E base model's distinct console position and rear power side. */
function add100E(profile, device) {
  const large = device.model.startsWith("FortiSwitch 148E");
  const poe = device.model.includes("POE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "148E" : "124E", device.model.endsWith("FPOE") ? "9" : poe ? "8" : "7");
  if (!large && !poe) profile.chassis = { x: .125, y: .04, width: .75, height: .92 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, large ? .035 : poe ? .055 : .233, .66, large ? .033 : .040);
    const index = Number(port.label) - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      const x = large ? .115 + column * .0333 + Math.floor(column / 12) * .011 :
        poe ? .445 + column * .0333 + (column >= 6 ? .025 : 0) : .300 + column * .043 + (column >= 6 ? .010 : 0);
      return slot(port, x, index % 2 ? .66 : .35, large || poe ? .027 : .035);
    }
    return slot(port, (large ? .932 : poe ? .90 : .864) + Math.floor((index - count) / 2) * (large ? .035 : poe ? .060 : .080),
      index % 2 ? .66 : .35, large || poe ? .027 : .035);
  });
  profile.faces.front.components = [element("led", large ? .069 : poe ? .112 : .072, .44, .005, .04),
    element("led", large ? .069 : poe ? .112 : .072, .57, .005, .04)];
  if (poe) profile.faces.front.components.push(element("led", large ? .069 : .112, .70, .005, .04));
  profile.faces.rear.components = [element("power", !large && !poe ? .762 : .047, .30, .105, .55, "AC", "ac")];
}

/** Trace the 1024E, T1024E and T1024F-FPOE guides, preserving each model's connector media and PSU size. */
function add1024(profile, device) {
  const generationF = device.model.includes("1024F");
  const copper = device.model.includes("T1024");
  inspected(profile, generationF ? "T1024F" : "1024E", generationF ? "5–6" : copper ? "7" : "6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .897, port.type === "Console" ? .67 : .32, .032);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .424 + Math.floor(index / 2) * .032 + (index >= 12 ? .018 : 0),
      index % 2 ? .67 : .32, .028);
    return slot(port, .845, index % 2 ? .67 : .32, .040);
  });
  profile.faces.front.components = [element("usb", .923, .48, .014, .28, undefined, "a"),
    element("vent", .40, .02, .52, .12, undefined, "mesh"), element("vent", .40, .87, .52, .10, undefined, "mesh"),
    ...Array.from({ length: generationF ? 5 : 4 }, (_, index) => element("led", .947, .34 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("fan", .198, .025, .108, .95, undefined, "removable"),
    element("fan", .314, .025, .108, .95, undefined, "removable"),
    element("psu", generationF ? .62 : .715, .025, generationF ? .17 : .125, .95, "PSU2", "ac"),
    element("psu", generationF ? .800 : .855, .025, generationF ? .17 : .125, .95, "PSU1", "ac")];
}

/** Trace the 110G-FPOE's separate 5G pair and keyed four-contact power inlet. */
function add110G(profile, device) {
  inspected(profile, "110G", "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, .353, .65, .056);
    const index = Number(port.label) - 1;
    if (index < 8) return slot(port, .486 + Math.floor(index / 2) * .059, index % 2 ? .67 : .34, .050);
    if (index < 10) return slot(port, .748, index % 2 ? .67 : .34, .050);
    return slot(port, .866 + Math.floor((index - 10) / 2) * .074, index % 2 ? .67 : .34, .055);
  });
  profile.faces.front.components = [element("usb", .41, .50, .023, .30, undefined, "a"),
    element("led", .207, .71, .009, .05),
    ...["PWR", "ALARM", "BT/BLE", "POE MAX"].flatMap((label, index) => [element("led", .245, .39 + index * .12, .008, .04),
      element("text", .258, .35 + index * .12, .061, .095, label)])];
  profile.faces.rear.components = [element("vent", .05, .15, .70, .64, undefined, "perforated"),
    element("power", .853, .46, .038, .35, "54V", "dc-keyed4")];
}

/** Trace the M426E-FPOE's mixed copper banks and its three-fan rear panel with omitted console endpoint. */
function addM426E(profile, device) {
  inspected(profile, "M426E", "3", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .42, .034);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .352 + Math.floor(index / 2) * .0365 + Math.floor(index / 8) * .008,
      index % 2 ? .68 : .36, .029);
    if (index < 26) return slot(port, .812, index % 2 ? .68 : .36, .029);
    return slot(port, .856 + (index - 26) * .032, .69, .027);
  });
  profile.faces.front.components = [element("usb", .021, .66, .034, .14, undefined, "a"),
    ...[0, 1, 2, 3].map((index) => element("led", .085, .35 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", .068, .50, .035, .30, "CONSOLE"),
    ...[.188, .553, .747].map((x) => element("fan", x, .06, .09, .83, undefined, "fixed")),
    element("power", .343, .24, .105, .55, "PSU1", "ac"), element("power", .854, .24, .105, .55, "PSU2", "ac")];
}

/** Trace the 248D's two copper banks, rear console and single fixed AC inlet. */
function add248D(profile, device) {
  inspected(profile, "248D", "7", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .63, .034);
    const index = Number(port.label) - 1;
    if (index < 48) return slot(port, .12 + Math.floor(index / 2) * .033 + (index >= 24 ? .014 : 0),
      index % 2 ? .68 : .40, .026);
    return slot(port, .932 + Math.floor((index - 48) / 2) * .035, index % 2 ? .68 : .40, .027);
  });
  profile.faces.front.components = [element("led", .072, .20, .005, .04), element("led", .072, .30, .005, .04),
    element("led", .072, .61, .005, .04)];
  profile.faces.rear.components = [element("console", .136, .47, .037, .31, "CONSOLE"),
    element("power", .60, .24, .115, .55, "AC", "ac")];
}

/** Trace the 348G variants' mixed copper banks, signed-firmware slider and distinct rear cooling arrangements. */
function add348G(profile, device) {
  const poe = device.model.endsWith("FPOE");
  inspected(profile, "348G", poe ? "7–8" : "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .963, port.type === "Console" ? .76 : .25, .033, .22);
    const index = Number(port.label) - 1;
    if (index < 48) return slot(port, .034 + Math.floor(index / 2) * .0325 + Math.floor(index / 12) * .010,
      index % 2 ? .68 : .35, .027);
    return slot(port, .846 + Math.floor((index - 48) / 2) * .034, index % 2 ? .68 : .35, .029);
  });
  profile.faces.front.components = [element("usb", .947, .465, .030, .10, undefined, "a"),
    element("button", .907, .48, .011, .09, undefined, "reset"),
    element("switch", .927, .46, .016, .06, undefined, "firmware-slider"),
    element("vent", .374, .015, .521, .065, undefined, "slots"),
    ...Array.from({ length: poe ? 4 : 3 }, (_, index) => element("led", .928, .13 + index * .075, .004, .03))];
  profile.faces.rear.components = [
    ...(poe ? [.185, .552, .651, .750] : [.278, .377]).map((x) => element("fan", x, .07, .09, .83, undefined, "fixed")),
    element("power", poe ? .358 : .568, .26, .115, .54, "PSU1", "ac"),
    element("power", poe ? .868 : .752, .26, .115, .54, "PSU2", "ac")];
}

/** Trace each 108F variant, including the base model's rear console and single-row network sockets. */
function add108F(profile, device) {
  const poe = device.model.includes("POE");
  inspected(profile, "108F", device.model.endsWith("FPOE") ? "7–8" : poe ? "5–6" : "3–4");
  profile.faces.front.ports = device.ports.filter((port) => poe || port.type !== "Console").map((port) => {
    if (port.type === "Console") return slot(port, .181, .60, .060);
    const index = Number(port.label) - 1;
    if (index < 8) return slot(port, (poe ? .266 : .162) + index * (poe ? .064 : .079) +
      (index >= 4 ? .020 : 0), poe ? .60 : .52, poe ? .053 : .065);
    return slot(port, (poe ? .84 : .843) + (index - 8) * (poe ? .062 : .082), poe ? .60 : .52, poe ? .055 : .070);
  });
  profile.faces.front.components = [element("button", poe ? .055 : .048, .72, .014, .08, undefined, "reset"),
    ...Array.from({ length: poe ? 3 : 2 }, (_, index) => element("led", .087, (poe ? .47 : .41) + index * (poe ? .12 : .21), .008, .05))];
  profile.faces.rear.components = [poe ? element("power", .658, .27, .20, .52, "AC", "ac") :
    element("power", .151, .20, .032, .57, "12V", "dc-keyed2")];
  profile.faces.rear.ports = poe ? [] : device.ports.filter((port) => port.type === "Console")
    .map((port) => slot(port, .836, .51, .08, .24));
  if (!poe) {
    if (!profile.faces.rear.ports.length) {
      profile.faces.rear.components.push(element("console", .796, .39, .08, .24, "CONSOLE"));
      profile.inventoryComplete = false;
      profile.catalogDiscrepancies.push("The catalog omits the base model's rear RJ45 console; it is drawn without a connection endpoint.");
    }
    profile.faces.front.connectionMarker = { x: .33, y: .83, width: .30, height: .12 };
    profile.faces.rear.connectionMarker = { x: .33, y: .78, width: .30, height: .12 };
  }
}

/** Trace the 224D-FPOE's two copper banks, RPS socket region and two fixed rear fans. */
function add224D(profile, device) {
  inspected(profile, "224D", "8–9", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .036, .67, .034);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .423 + Math.floor(index / 2) * .0357 + (index >= 12 ? .012 : 0),
      index % 2 ? .69 : .40, .029);
    return slot(port, .894 + Math.floor((index - 24) / 2) * .062, index % 2 ? .69 : .40, .031);
  });
  profile.faces.front.components = [element("led", .126, .52, .005, .04),
    ...[0, 1, 2, 3].map((index) => element("led", .088, .40 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", .14, .44, .037, .34, "CONSOLE"),
    element("module-bay", .36, .40, .165, .40, "RPS", "blank"),
    element("power", .616, .24, .10, .53, "AC", "ac"),
    element("fan", .762, .20, .075, .72, undefined, "fixed"),
    element("fan", .865, .20, .075, .72, undefined, "fixed")];
  profile.limitations.push("The RPS connector envelope is shown; its proprietary multi-pin contacts are not modeled.");
}

/** Create the numbered contacts of a documented power or digital-I/O terminal block. */
function terminal(x, y, width, height, pins, label) {
  return { ...element("terminal", x, y, width, height, label), pins };
}

/** Retain an explicit rear evidence gap when a rugged guide only illustrates the front and mounting sides. */
function ruggedFrontOnly(profile, guide) {
  inspected(profile, guide, "5–7");
  profile.fidelity = "family";
  profile.panelsVerified = false;
  profile.rearHardwareVerified = false;
  profile.verifiedFaces = ["front"];
  profile.limitations = ["The front is individually traced from this model's photograph. The guide shows mounting sides but no clear opposing rear panel; rear hardware remains unverified."];
}

/** Trace the distinct 108F and 112F rugged fronts, including covered USB, firmware control and terminal blocks. */
function addRugged100F(profile, device) {
  const large = device.model.includes("112F");
  ruggedFrontOnly(profile, large ? "R112F" : "R108F");
  const count = large ? 8 : 6;
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, large ? .840 : .390, large ? .258 : .435, .105, .12);
    if (port.label === "MGMT") return slot(port, large ? .322 : .377, large ? .828 : .797, .115, .12);
    const index = Number(port.label) - 1;
    if (index < count) return slot(port, large ? .350 + Math.floor(index / 2) * .111 :
      [.565, .688, .877][Math.floor(index / 2)], index % 2 ? large ? .403 : .50 : large ? .195 : .265, .095, .12);
    return slot(port, (large ? .475 : .638) + (index - count) * (large ? .142 : .157), large ? .828 : .797, .108, .12);
  });
  profile.faces.front.components = large ? [terminal(.041, .387, .224, .107, 5, "DIGITAL I/O"),
    terminal(.041, .775, .201, .111, 4, "DC1 / DC2"), element("coax", .183, .17, .071, .15, "BLE"),
    element("module-bay", .77, .36, .127, .23, "USB COVER", "blank"),
    element("module-bay", .606, .510, .155, .095, "SIGNED FW", "blank"),
    element("button", .933, .407, .030, .05, undefined, "reset"),
    ...[.36, .42, .47, .55].map((x) => element("led", x, .515, .010, .025))] :
    [terminal(.05, .15, .245, .115, 5, "DIGITAL I/O"), terminal(.049, .724, .211, .117, 4, "DC1 / DC2"),
      element("module-bay", .31, .034, .164, .281, "USB COVER", "blank"),
      element("module-bay", .586, .030, .175, .11, "SIGNED FW", "blank"),
      element("coax", .89, .683, .075, .145, "BLE"),
      element("button", .496, .75, .030, .05, undefined, "reset"),
      ...[.52, .85, .90].map((x) => element("led", x, .09, .011, .03))];
}

/** Trace the 216F's portrait copper banks and four optical rows without stretching them into a rack switch layout. */
function addRugged216F(profile, device) {
  ruggedFrontOnly(profile, "R216F");
  profile.chassis = { x: .425, y: .04, width: .15, height: .92 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, .817, .19, .135, .070);
    if (port.label === "MGMT") return slot(port, .817, .302, .135, .070);
    const index = Number(port.label) - 1;
    if (index < 16) return slot(port, index % 2 ? .425 : .565,
      .837 - Math.floor(index / 2) * .082 - (index >= 8 ? .102 : 0), .13, .065);
    return slot(port, .143, .765 - (index - 16) * .18, .12, .07);
  });
  profile.faces.front.components = [element("usb", .76, .047, .065, .080, undefined, "a"),
    element("coax", .145, .075, .090, .05, "BLE"),
    terminal(.745, .817, .075, .12, 4, "DC"), terminal(.745, .66, .075, .15, 5, "I/O"),
    element("button", .770, .378, .040, .027, undefined, "reset"),
    ...Array.from({ length: 18 }, (_, index) => element("led", .765 + index % 3 * .05,
      .432 + Math.floor(index / 3) * .030, .020, .012))];
  profile.limitations.push("The upright DIN-rail face is fitted within the catalog's two-unit allocation; this is not a scale drawing of its 180 mm height.");
}

/** Trace the 424F's full-width one-unit chassis and the documented P26913-05-or-later rear panel. */
function addRugged424F(profile, device) {
  inspected(profile, "R424F", "6, 8–9", [
    "The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint.",
    "The catalog allocates 2U, while the guide specifies a 44 mm chassis. The physical panel occupies one unit inside that allocation.",
  ]);
  profile.fidelity = "model";
  profile.hardwareRevision = "P26913-05 and above";
  profile.chassis = { x: 0, y: .04, width: 1, height: .46 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .049, .46, .040, .12);
    const index = Number(port.label) - 1;
    if (index < 12) return slot(port, .163 + Math.floor(index / 2) * .0444, index % 2 ? .68 : .36, .038, .12);
    if (index < 28) return slot(port, .444 + Math.floor((index - 12) / 2) * .058, index % 2 ? .68 : .36, .044, .12);
    return slot(port, .916, index % 2 ? .68 : .36, .055, .12);
  });
  profile.faces.front.components = [element("usb", .025, .65, .048, .11, undefined, "a"),
    element("button", .112, .67, .008, .05, undefined, "reset"),
    ...[0, 1, 2, 3].map((index) => element("led", .092, .32 + index * .12, .004, .028))];
  profile.faces.rear.components = [element("console", .040, .48, .049, .34, "CONSOLE"),
    terminal(.096, .66, .040, .18, 3, "FAULT"), terminal(.146, .62, .085, .23, 5, "DC1 / DC2"),
    element("coax", .235, .40, .029, .24, "GPS")];
  profile.limitations.push("The rear shown is P26913-05 and above. Earlier revisions use a six-pin DC terminal and omit the separate three-pin fault relay.");
}

/** Record physical silk-screen labels while preserving existing catalog labels, types and endpoint indices. */
function namedSlot(port, physicalLabel, x, y, width = .027, height = .22) {
  return { ...slot(port, x, y, width, height), physicalLabel };
}

/** Record a complete socket inventory whose legacy generated labels differ from the physical panel. */
function notePhysicalLabels(profile) {
  profile.catalogDiscrepancies.push("The catalog's generated labels differ from the physical panel. Physical labels are recorded separately; stored endpoint labels are preserved.");
}

/** Trace the 30G/31G's front I/O bank and rear-only keyed power inlet. */
function add30G(profile, device) {
  inspected(profile, "30G", "4–5");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => port.type === "Console" ? namedSlot(port, "CONSOLE", .203, .64, .095, .24) :
    namedSlot(port, ["WAN", "1", "2", "A"][index], .557 + index * .094, .64, .080, .24));
  profile.faces.front.components = [element("vent", .543, .11, .334, .18, undefined, "slots"),
    element("button", .058, .68, .014, .055, undefined, "reset"),
    element("led", .337, .56, .014, .055), element("text", .284, .55, .051, .08, "STATUS"),
    element("led", .337, .67, .014, .055), element("text", .288, .66, .047, .08, "PWR"),
    element("led", .374, .67, .014, .055), element("text", .389, .66, .038, .08, "HA")];
  profile.faces.rear.components = [element("vent", .064, .16, .743, .71, undefined, "slots"),
    element("power", .84, .41, .045, .42, "12V", "dc-keyed2"),
    element("vent", .91, .17, .037, .70, undefined, "slots")];
}

/** Trace the 50G/51G's front indicator panel and rear reversed Ethernet bank with signed-firmware cover. */
function add50G(profile, device) {
  inspected(profile, "50G", "4–5");
  notePhysicalLabels(profile);
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => port.type === "Console" ? namedSlot(port, "CONSOLE", .201, .57, .070, .24) :
    namedSlot(port, ["WAN", "A", "3", "2", "1"][index], .655 + index * .065, .57, .057, .24));
  profile.faces.front.components = [element("button", .048, .66, .010, .05, undefined, "reset"),
    element("led", .092, .70, .010, .05), element("text", .077, .79, .044, .075, "BLE"),
    element("led", .204, .75, .010, .05), element("text", .16, .84, .105, .075, "SIGNED FW"),
    ...familyIndicators(["PWR", "STATUS", "HA"], .34, .73, .065),
    ...["1", "2", "3", "A", "WAN"].flatMap((label, index) => [element("text", .572 + index * .024, .45, .020, .075, label),
      element("led", .58 + index * .024, .58, .010, .05), element("led", .58 + index * .024, .73, .010, .05)]),
    element("coax", .888, .49, .039, .20, "BLE")];
  profile.faces.rear.components = [element("power", .067, .35, .031, .41, "12V", "dc-keyed2"),
    element("usb", .114, .40, .028, .33, undefined, "a"),
    element("module-bay", .258, .51, .035, .47, "", "blank"),
    element("vent", .321, .42, .146, .33, undefined, "slots"),
    element("vent", .08, .11, .39, .18, undefined, "slots"),
    element("vent", .532, .11, .39, .18, undefined, "slots")];
}

/** Trace the 200G/201G's separated 1G, 5G and optical groups with two fixed rear AC supplies. */
function add200G(profile, device) {
  inspected(profile, "200G", "5–6");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    const y = index % 2 ? .67 : .39;
    if (index < 2) return namedSlot(port, ["HA", "MGMT"][index], .203, y, .030);
    if (index < 10) return namedSlot(port, String(index - 1), .324 + Math.floor((index - 2) / 2) * .033, y, .028);
    if (index < 18) return namedSlot(port, String(index - 1), .477 + Math.floor((index - 10) / 2) * .033, y, .028);
    if (index < 22) return namedSlot(port, String(index - 1), .824 + Math.floor((index - 18) / 2) * .034, y, .030);
    if (index < 30) return namedSlot(port, `X${index - 21}`, .672 + Math.floor((index - 22) / 2) * .034, y, .030);
    return namedSlot(port, "CONSOLE", .154, .46, .030);
  });
  profile.faces.front.components = [element("usb", .140, .70, .029, .10, undefined, "a"),
    element("module-bay", .049, .57, .016, .29, "", "blank"),
    element("button", .078, .70, .011, .09, undefined, "reset"),
    element("vent", .237, .24, .049, .57, undefined, "slots"),
    element("vent", .611, .24, .032, .57, undefined, "slots"),
    ...[0, 1, 2, 3].map((index) => element("led", .099, .49 + index * .086, .005, .04))];
  profile.faces.rear.components = [element("power", .093, .33, .071, .49, "PSU2", "ac"),
    element("power", .831, .33, .071, .49, "PSU1", "ac"),
    element("vent", .224, .20, .220, .70, undefined, "perforated"),
    element("vent", .551, .20, .220, .70, undefined, "perforated")];
}

/** Trace the 400G and 700G panels from their separate guides, matching media before legacy management labels. */
function add400700G(profile, device) {
  inspected(profile, device.model.startsWith("FortiGate 4") ? "400G" : "700G", "5–6");
  notePhysicalLabels(profile);
  profile.catalogDiscrepancies.push("The catalog names the 2.5G socket MGMT. The guides identify it as HA and identify the separate 1G socket as MGMT; physical labels follow the guide without changing stored types or labels.");
  profile.faces.front.ports = device.ports.map((port, index) => {
    const y = index % 2 ? .69 : .37;
    if (index < 2) return namedSlot(port, index ? "HA" : "MGMT", .181, index ? .37 : .69, .031);
    if (index < 10) return namedSlot(port, index < 4 ? `WAN${index - 1}` : `LAN${index - 3}`,
      .229 + Math.floor((index - 2) / 2) * .034, y, .029);
    if (index < 26) return namedSlot(port, `LAN${index - 3}`, .383 + Math.floor((index - 10) / 2) * .034 +
      (index >= 18 ? .012 : 0), y, .029);
    if (index < 30) return namedSlot(port, `X${index - 25}`, .681 + Math.floor((index - 26) / 2) * .034, y, .030);
    if (index < 34) return namedSlot(port, `X${index - 25}`, .779 + Math.floor((index - 30) / 2) * .034, y, .030);
    return namedSlot(port, "CONSOLE", .131, .68, .032);
  });
  profile.faces.front.components = [element("usb", .071, .52, .012, .30, undefined, "a"),
    element("usb", .090, .52, .012, .30, undefined, "a"),
    element("button", .052, .66, .005, .035, undefined, "reset"),
    element("module-bay", .927, .74, .048, .17, "", "blank"),
    element("vent", .842, .25, .072, .57, undefined, "mesh"),
    ...[.356, .506, .655, .740].map((x) => element("vent", x, .25, .009, .57, undefined, "mesh")),
    ...[0, 1, 2, 3].map((index) => element("led", .035, .51 + index * .089, .005, .035))];
  profile.faces.rear.components = [element("power", .080, .23, .074, .52, "PWR1", "ac"),
    element("power", .887, .23, .074, .52, "PWR2", "ac"),
    element("vent", .313, .12, .485, .76, undefined, "mesh")];
  profile.limitations.push("The rear drawing shows five internal fans behind a common mesh grille; the visible grille is drawn without inventing removable fan modules.");
}

/** Trace all four 900G AC/DC variants, including their two removable supplies and covered SSD area. */
function add900G(profile, device) {
  inspected(profile, "900G", "7–8");
  notePhysicalLabels(profile);
  profile.catalogDiscrepancies.push("The catalog names the 2.5G socket MGMT; the guide identifies it as HA. The 1G management socket is separately positioned and physically labeled MGMT.");
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index === 0 || index === 17) return namedSlot(port, index ? "HA" : "MGMT", .181, index ? .37 : .68, .031);
    if (index < 17) return namedSlot(port, String(index), .227 + Math.floor((index - 1) / 2) * .035 +
      (index > 8 ? .008 : 0), index % 2 ? .37 : .68, .029);
    if (index < 26) return namedSlot(port, String(index - 1), .563 + Math.floor((index - 18) / 2) * .034, index % 2 ? .68 : .37, .029);
    if (index < 30) return namedSlot(port, `X${index - 25}`, .714 + Math.floor((index - 26) / 2) * .034, index % 2 ? .68 : .37, .030);
    if (index < 34) return namedSlot(port, `X${index - 25}`, .784 + Math.floor((index - 30) / 2) * .034, index % 2 ? .68 : .37, .030);
    return namedSlot(port, "CONSOLE", .132, .67, .032);
  });
  profile.faces.front.components = [element("usb", .071, .52, .012, .30, undefined, "a"),
    element("usb", .090, .52, .012, .30, undefined, "a"),
    element("button", .051, .74, .008, .07, undefined, "reset"),
    element("vent", .505, .24, .037, .59, undefined, "perforated"),
    element("vent", .685, .24, .009, .59, undefined, "perforated"),
    element("vent", .842, .24, .048, .59, undefined, "perforated"),
    ...[0, 1, 2, 3].map((index) => element("led", .035, .51 + index * .088, .005, .035))];
  profile.faces.rear.components = [element("module-bay", .026, .04, .182, .84, "SSD COVER", "blank"),
    element("vent", .223, .105, .440, .78, undefined, "mesh"),
    element("psu", .692, .025, .125, .95, "PWR2", device.model.endsWith("-DC") ? "dc" : "ac"),
    element("psu", .841, .025, .125, .95, "PWR1", device.model.endsWith("-DC") ? "dc" : "ac")];
  profile.limitations.push("The five internal fans are behind the common rear mesh. The guide depicts the SSD access cover closed for both storage variants.");
}

/** Trace the separately documented SFP, DSL and PoE 50G variants instead of inheriting the base rear panel. */
function add50GWiredVariant(profile, device) {
  const poe = device.model.endsWith("-POE");
  const dsl = device.model.endsWith("-DSL");
  add50G(profile, device);
  inspected(profile, poe ? "50G-POE" : dsl ? "50G-DSL" : "50G-SFP", "4–5");
  notePhysicalLabels(profile);
  profile.faces.rear.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .201, poe ? .64 : .57, .070, .24);
    if (index === 5) return namedSlot(port, dsl ? "DSL" : "SFP", poe ? .343 : .541, poe ? .70 : .64, .061, .24);
    return namedSlot(port, (poe ? ["WAN1", "WAN2", "A", "2", "1"] : ["WAN", "A", "3", "2", "1"])[index],
      (poe ? .461 : .655) + index * .065, poe ? .64 : .57, .057, .24);
  });
  if (!poe) {
    if (dsl) profile.faces.front.components.push(element("text", .505, .60, .041, .08, "DSL"),
      element("led", .52, .73, .010, .05), element("led", .52, .58, .010, .05));
    else profile.faces.front.components.push(element("text", .695, .45, .031, .075, "SFP"), element("led", .70, .58, .010, .05));
    return;
  }
  profile.faces.front.components = [element("button", .048, .66, .010, .05, undefined, "reset"),
    element("led", .092, .70, .010, .05), element("led", .204, .75, .010, .05),
    ...familyIndicators(["PWR", "STATUS", "HA"], .27, .73, .065),
    ...["MAX", "1", "2", "A", "WAN2", "WAN1", "SFP"].flatMap((label, index) => [
      element("text", .590 + index * .034, .45, .030, .075, label),
      element("led", .600 + index * .034, index ? .58 : .73, .010, .05),
      ...(index > 0 && index < 5 ? [element("led", .600 + index * .034, .73, .010, .05)] : []),
    ]), element("coax", .888, .49, .039, .20, "BLE")];
  profile.faces.rear.components = [element("power", .873, .31, .043, .53, "54V", "dc-keyed2"),
    element("usb", .114, .48, .028, .33, undefined, "a"),
    element("module-bay", .060, .52, .035, .47, "", "blank"),
    element("vent", .265, .48, .032, .30, undefined, "slots"),
    element("vent", .784, .48, .061, .30, undefined, "slots"),
    element("vent", .08, .11, .39, .18, undefined, "slots"),
    element("vent", .532, .11, .31, .18, undefined, "slots")];
}

/** Trace the 80F Bypass and 80F/81F PoE panels, including the PoE chassis's extra ventilation strip. */
function add80FVariant(profile, device) {
  const poe = device.model.endsWith("-POE");
  inspected(profile, "80F", poe ? "6" : "5");
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return slot(port, .153, poe ? .57 : .40, .062, .22);
    const y = index % 2 ? poe ? .79 : .67 : poe ? .54 : .32;
    if (index < 8) return slot(port, .546 + Math.floor(index / 2) * .065, y, .054, .22);
    return slot(port, index < 10 ? .379 : .254, y, .059, .22);
  });
  profile.faces.rear.components = [element("usb", .122, poe ? .79 : .70, .058, .11, undefined, "a"),
    element("power", .821, poe ? .60 : .38, .029, poe ? .30 : .46, poe ? "54V" : "12V", "dc-keyed2"),
    element("power", .880, poe ? .60 : .38, .029, poe ? .30 : .46, poe ? "54V" : "12V", "dc-keyed2")];
  if (poe) profile.faces.rear.components.push(element("vent", .045, .07, .91, .24, undefined, "slots"));
  profile.faces.front.components = [element("button", .925, poe ? .83 : .74, .009, .05, undefined, "reset")];
  if (poe) {
    profile.faces.front.components.push(element("vent", .045, .07, .91, .24, undefined, "slots"),
      ...familyIndicators(["PWR", "STATUS", "HA"], .38, .83, .055), element("led", .534, .83, .007, .03),
      element("text", .512, .88, .051, .08, "MAX POE"));
    for (let index = 0; index < 8; index++) profile.faces.front.components.push(element("led", .56 + index * .024, .74, .008, .03),
      element("led", .56 + index * .024, .83, .008, .03));
    for (let index = 0; index < 2; index++) profile.faces.front.components.push(element("led", .458 + index * .027, .61, .008, .03));
  } else {
    for (const [index, label] of ["BYPASS", "STATUS", "HA", "POWER"].entries()) profile.faces.front.components.push(
      element("led", .291, .42 + index * .10, .008, .045), element("text", .226, .40 + index * .10, .060, .075, label));
    for (let index = 0; index < 6; index++) profile.faces.front.components.push(element("led", .365 + index * .025, .60, .008, .045),
      element("led", .365 + index * .025, .73, .008, .045));
    profile.faces.rear.components.push(element("text", .419, .16, .084, .10, "BYPASS"));
  }
}

/** Trace the cellular 40F panels, excluding the drawing's explicitly WiFi-only rear antenna sockets. */
function add40FCellular(profile, device) {
  inspected(profile, "40F-cell", "6");
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  const positions = { WAN: .655, A: .723, "3": .789, "2": .855, "1": .923 };
  profile.faces.rear.ports = device.ports.map((port) => slot(port,
    port.type === "Console" ? .202 : positions[port.label], .55, port.type === "Console" ? .072 : .060, .24));
  profile.faces.front.components = [
    ...[.046, .507, .952].map((x, index) => element("coax", x - .014, .18, .028, .16, index === 1 ? "GPS" : "3G/4G")),
    ...familyIndicators(["PWR", "STATUS", "HA"], .37, .71, .052),
    element("led", .61, .57, .009, .045), element("text", .59, .47, .05, .08, "SVC"),
    element("led", .61, .71, .009, .045), element("text", .58, .80, .06, .08, "3G/4G"),
    ...["1", "2", "3", "A", "WAN"].flatMap((label, index) => [
      element("text", .716 + index * .025, .43, .024, .08, label),
      element("led", .722 + index * .025, .57, .009, .045),
      element("led", .722 + index * .025, .71, .009, .045),
    ]),
  ];
  profile.faces.rear.components = [element("button", .028, .49, .014, .08, undefined, "reset"),
    element("power", .068, .30, .030, .45, "12V", "dc-keyed2"),
    element("usb", .115, .36, .028, .38, undefined, "a"),
    element("vent", .118, .08, .805, .18, undefined, "slots"),
    element("vent", .268, .40, .325, .33, undefined, "slots")];
  profile.limitations.push("The two Micro SIM slots are behind a side cover; they are outside the front/rear views. The guide's rear WiFi antenna connectors and WiFi LED apply only to FortiWiFi and are omitted from this FortiGate model.");
}

/** Trace the separately illustrated 400F/401F DC rear supplies and the shared, explicitly named front panel. */
function add400FDC(profile, device) {
  inspected(profile, "400F-ds", "7");
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return slot(port, .159, .49, .034);
    const y = index % 2 ? .70 : .42;
    if (index < 2) return slot(port, .206, y, .031);
    if (index < 18) return slot(port, .276 + Math.floor((index - 2) / 2) * .0345 + (index >= 10 ? .016 : 0), y, .029);
    if (index < 26) return slot(port, .779 + Math.floor((index - 18) / 2) * .0345, y, .029);
    return slot(port, .617 + Math.floor((index - 26) / 2) * .0345 + (index >= 30 ? .013 : 0), y, .029);
  });
  profile.faces.front.components = [element("usb", .143, .73, .034, .11, undefined, "a"),
    element("vent", .237, .22, .012, .60, undefined, "slots"),
    element("vent", .563, .22, .030, .60, undefined, "slots"),
    element("vent", .909, .22, .074, .60, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .106, .49 + index * .085, .005, .035),
      element("text", .040, .47 + index * .085, .059, .060, label),
    ])];
  profile.faces.rear.components = [element("vent", .151, .18, .100, .72, undefined, "perforated"),
    element("vent", .300, .18, .338, .72, undefined, "perforated"),
    element("psu", .697, .025, .128, .95, "PWR1", "dc"),
    element("psu", .839, .025, .126, .95, "PWR2", "dc")];
}

/** Trace the 1000F/1001F two-unit chassis, including its horizontal QSFP pair and rear SSD cover. */
function add1000F(profile, device) {
  inspected(profile, "1000F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .127, .81, .032, .12);
    if (index < 2) return namedSlot(port, index ? "HA" : "MGMT", .176, index ? .665 : .83, .031, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 10) return namedSlot(port, String(index - 1), .277 + Math.floor((index - 2) / 2) * .034, y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .435 + Math.floor((index - 10) / 2) * .034 +
      (index >= 18 ? .013 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, String(index - 1), .733 + Math.floor((index - 26) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 1), .880 + (index - 34) * .047, .855, .041, .12);
  });
  profile.faces.front.components = [
    ...[.012, .342, .671].map((x) => element("vent", x, .035, .316, .44, undefined, "perforated")),
    element("vent", .204, .61, .047, .27, undefined, "perforated"),
    element("vent", .860, .57, .123, .12, undefined, "perforated"),
    element("vent", .955, .70, .028, .21, undefined, "perforated"),
    element("usb", .068, .73, .010, .16, undefined, "a"),
    element("usb", .089, .73, .010, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .050, .71 + index * .048, .004, .025),
      element("text", .012, .70 + index * .048, .033, .036, label),
    ])];
  profile.faces.rear.components = [
    ...[.08, .286, .493].map((x, index) => element("fan", x, .14, .178, .79, `FAN${index + 1}`, "fixed")),
    element("module-bay", .728, .05, .210, .40, "SSD COVER", "blank"),
    element("psu", .700, .52, .130, .46, "PWR1", "ac"),
    element("psu", .846, .52, .130, .46, "PWR2", "ac")];
}

/** Trace the AC 1100E/1101E panels with stacked QSFP ports and three fixed rear fans. */
function add1100E(profile, device) {
  inspected(profile, "1100E-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .160, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .206, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .248 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .537 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    if (index < 30) return namedSlot(port, String(index - 1), .679 + Math.floor((index - 26) / 2) * .034, y, .030, .12);
    if (index < 34) return namedSlot(port, String(index - 1), .752 + Math.floor((index - 30) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 1), .835, y, .041, .12);
  });
  profile.faces.front.components = [element("vent", .013, .045, .975, .43, undefined, "perforated"),
    element("usb", .102, .730, .030, .060, undefined, "a"),
    element("usb", .102, .842, .030, .060, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .088, .73 + index * .043, .004, .022),
      element("text", .043, .72 + index * .043, .039, .032, label),
    ])];
  profile.faces.rear.components = [
    ...[.035, .218, .401].map((x, index) => element("fan", x, .11, .178, .83, `FAN${index + 1}`, "fixed")),
    element("psu", .695, .52, .133, .46, "PWR1", "ac"),
    element("psu", .845, .52, .133, .46, "PWR2", "ac")];
  profile.limitations.push("This profile covers the explicitly listed AC models. The separately sold DC model requires its own rear connector trace.");
}

/** Trace the AC 1800F/1801F chassis with optical HA sockets and its corrected single-console inventory. */
function add1800F(profile, device) {
  inspected(profile, "1800F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .092, .71, .032, .12);
    const y = index % 2 ? .815 : .65;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .145, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .256 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .012 : 0), y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .551 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    if (index < 28) return namedSlot(port, `HA${index - 25}`, .213, y, .029, .12);
    if (index < 40) return namedSlot(port, String(index - 3), .690 + Math.floor((index - 28) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 3), .897 + Math.floor((index - 40) / 2) * .047, y, .039, .12);
  });
  profile.faces.front.components = [
    ...[.212, .409, .608, .807].map((x) => element("vent", x, .055, .180, .405, undefined, "perforated")),
    element("vent", .015, .345, .182, .105, undefined, "perforated"),
    element("vent", .174, .58, .010, .31, undefined, "slots"),
    element("vent", .973, .58, .010, .31, undefined, "slots"),
    element("usb", .075, .811, .034, .065, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .061, .66 + index * .052, .004, .024),
      element("text", .019, .65 + index * .052, .036, .034, label),
    ])];
  profile.faces.rear.components = [
    ...[.048, .249, .452].map((x, index) => element("fan", x, .10, .176, .81, `FAN${index + 1}`, "fixed")),
    element("psu", .702, .39, .123, .48, "PSU2", "ac"),
    element("psu", .827, .39, .123, .48, "PSU1", "ac")];
  profile.limitations.push("Inventory revision 1 removes the former second console entry; saved revision-0 endpoints keep their IDs and indices, with the unsupported extra endpoint shown as unmapped.");
}

/** Trace the AC 2600F panels, whose individually illustrated enclosure matches the 1800F with different socket banks. */
function add2600F(profile, device) {
  add1800F(profile, device);
  inspected(profile, "2600F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .092, .71, .032, .12);
    const y = index % 2 ? .815 : .65;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .145, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .272 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .022 : 0), y, .030, .12);
    if (index < 20) return namedSlot(port, `HA${index - 17}`, .213, y, .029, .12);
    if (index < 36) return namedSlot(port, String(index - 3), .588 + Math.floor((index - 20) / 2) * .034 +
      (index >= 28 ? .016 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .892 + Math.floor((index - 36) / 2) * .047, y, .039, .12);
  });
}

/** Compose the three separately drawn upper ventilation panels and compact control area on larger F models. */
function largeFControls(offset = 0) {
  return [...[.012, .342, .672].map((x) => element("vent", x, .035, .316, .44, undefined, "perforated")),
    element("usb", .093 + offset, .73, .012, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .057 + offset, .70 + index * .048, .004, .024),
      element("text", .018 + offset, .69 + index * .048, .033, .034, label),
    ])];
}

/** Trace the AC 3000F/3001F layout while retaining explicit mappings for the former extra copper endpoints. */
function add3000F(profile, device) {
  inspected(profile, "3000F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 18) return namedSlot(port, String(index - 1), .237 + Math.floor((index - 2) / 2) * .0344 +
      (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 1),
      .534 + Math.floor((index - 18) / 2) * .0344 + (index >= 26 ? .009 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .834 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = largeFControls();
  profile.faces.rear.components = [
    ...[.054, .279, .505].map((x, index) => element("fan", x, .15, .184, .80, `FAN${index + 1}`, "fixed")),
    element("module-bay", .712, .05, .207, .40, "SSD COVER", "blank"),
    element("psu", .704, .52, .132, .46, "PWR1", "ac"),
    element("psu", .839, .52, .132, .46, "PWR2", "ac")];
  profile.limitations.push("Revision 1 corrects management media and removes the two former extra copper entries. Revision-0 optical and console indices map explicitly; all saved endpoint IDs and configuration remain intact.");
}

/** Trace the 3200F/3201F optical banks, horizontal QSFP-DD row and four-fan rear with opposite-end supplies. */
function add3200F(profile, device) {
  inspected(profile, "3200F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 6) return namedSlot(port, String(index - 1), .366 + Math.floor((index - 2) / 2) * .0345, y, .030, .12);
    if (index < 8) return namedSlot(port, `HA${index - 5}`, .332, y, .030, .12);
    if (index < 18) return namedSlot(port, String(index - 3), .435 + Math.floor((index - 8) / 2) * .0345 +
      (index >= 10 ? .017 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .796 + (index - 18) * .050, .835, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(),
    element("vent", .224, .63, .077, .24, undefined, "mesh"),
    element("vent", .772, .63, .203, .10, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .017, .028, .096, .71, "PWR1", "ac"),
    element("psu", .885, .028, .096, .71, "PWR2", "ac"),
    ...[.128, .316, .505, .694].map((x, index) => element("fan", x, .15, .176, .80, `FAN${index + 1}`, "fixed"))];
}

/** Trace the 3500F/3501F full SFP28 front row and four-fan rear, including legacy management media compatibility. */
function add3500F(profile, device) {
  inspected(profile, "3500F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .138, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .190, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 34) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, index < 4 ? `HA${index - 1}` : String(index - 3),
        .245 + column * .034 + Math.floor(column / 4) * .010, y, .030, .12);
    }
    return namedSlot(port, String(index - 3), .846 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = largeFControls(.006);
  profile.faces.rear.components = [element("psu", .017, .065, .090, .60, "PWR1", "ac"),
    element("psu", .891, .065, .090, .60, "PWR2", "ac"),
    ...[.123, .315, .507, .699].map((x, index) => element("fan", x, .16, .185, .77, `FAN${index + 1}`, "fixed"))];
  profile.limitations.push("Inventory revision 1 identifies the management sockets as 10GE. The identity revision map also accepts the saved revision-0 1GE media type without rewriting endpoint configuration.");
}

/** Trace the 3700F/3701F extra optical bank in the separately documented four-fan enclosure. */
function add3700F(profile, device) {
  add3200F(profile, device);
  inspected(profile, "3700F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 6) return namedSlot(port, String(index - 1), .366 + Math.floor((index - 2) / 2) * .0345, y, .030, .12);
    if (index < 8) return namedSlot(port, `HA${index - 5}`, .332, y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 3), .435 + Math.floor((index - 8) / 2) * .0345 +
      (index >= 10 ? .017 : 0) + (index >= 18 ? .012 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .796 + (index - 26) * .050, .835, .041, .12);
  });
}

/** Compose the rear specifically illustrated in the 3000G and 3500G datasheets. */
function largeGRear() {
  return [...[.007, .039].map((x, index) => element("module-bay", x, .42, .030, .53, `SSD${index + 1}`, "blank")),
    ...[.143, .344, .545].map((x, index) => element("fan", x, .19, .180, .79, `FAN${index + 1}`, "fixed")),
    element("psu", .729, .49, .128, .49, "PWR1", "ac"),
    element("psu", .862, .49, .128, .49, "PWR2", "ac")];
}

/** Trace the 3000G/3001G WAN labels, signed-firmware cover and the rear storage arrangement. */
function add3000G(profile, device) {
  inspected(profile, "3000G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 18) return namedSlot(port, index < 4 ? `WAN${index - 1}` : String(index - 3),
      .240 + Math.floor((index - 2) / 2) * .0344 + (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 3),
      .536 + Math.floor((index - 18) / 2) * .0344 + (index >= 26 ? .008 : 0), y, .030, .12);
    return namedSlot(port, String(index - 5), .841 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(.020),
    element("module-bay", .015, .80, .034, .17, "", "blank"),
    element("text", .005, .68, .050, .09, "SIGNED FW"),
    element("button", .977, .83, .006, .035, undefined, "reset")];
  profile.faces.front.components.find((component) => component.kind === "usb").x = .093;
  profile.faces.rear.components = largeGRear();
  profile.limitations.push("Rear storage sled covers are shown closed; installed capacity differs between storage variants. Revision-0 extra copper endpoints remain unmapped and optical indices use an explicit revision map.");
}

/** Trace the 3500G/3501G mixed QSFP/QSFP-DD bank and two optical WAN sockets. */
function add3500G(profile, device) {
  inspected(profile, "3500G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 4) return namedSlot(port, `HA${index - 1}`, .240, y, .030, .12);
    if (index < 32) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, index < 6 ? `WAN${index - 3}` : String(index - 5),
        .280 + column * .034 + (column >= 2 ? .007 : 0) + (column >= 6 ? .012 : 0) + (column >= 10 ? .008 : 0), y, .028, .12);
    }
    if (index < 36) return namedSlot(port, String(index - 5), .803 + Math.floor((index - 32) / 2) * .044, y, .039, .12);
    return namedSlot(port, String(index - 5), .895 + (index - 36) * .051, .835, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(.020),
    element("module-bay", .015, .80, .034, .17, "", "blank"),
    element("text", .005, .68, .050, .09, "SIGNED FW"),
    element("button", .977, .83, .006, .035, undefined, "reset"),
    element("vent", .765, .60, .010, .30, undefined, "perforated"),
    element("vent", .872, .60, .100, .13, undefined, "perforated")];
  profile.faces.front.components.find((component) => component.kind === "usb").x = .093;
  profile.faces.rear.components = largeGRear();
}

/** Trace the photographed 3800G/3801G three-unit panel, display, four supplies and three removable fans. */
function add3800G(profile, device) {
  inspected(profile, "3800G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .180, .82, .034, .08);
    const y = index % 2 ? .90 : .79;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .230, y, .034, .08);
    if (index < 4) return namedSlot(port, `HA${index - 1}`, .278, y, .030, .08);
    if (index < 20) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, index < 6 ? `WAN${index - 3}` : String(index - 5),
        .380 + column * .0336 + (column >= 4 ? .007 : 0), y, .029, .08);
    }
    if (index < 22) return namedSlot(port, `HA${index - 17}`, .328, y, .039, .08);
    if (index < 26) return namedSlot(port, String(index - 7), .669 + Math.floor((index - 22) / 2) * .045, y, .039, .08);
    return namedSlot(port, String(index - 7), .768 + (index - 26) * .0545, .91, .042, .08);
  });
  profile.faces.front.components = [element("lcd", .014, .035, .194, .49),
    element("vent", .014, .54, .194, .09, undefined, "perforated"),
    ...[.217, .482, .748].map((x) => element("vent", x, .035, .245, .595, undefined, "perforated")),
    element("usb", .163, .929, .034, .036, undefined, "a"),
    element("vent", .118, .725, .023, .23, undefined, "slots"),
    element("vent", .180, .691, .450, .022, undefined, "slots"),
    element("vent", .660, .691, .300, .022, undefined, "slots"),
    element("vent", .747, .75, .220, .090, undefined, "slots"),
    element("module-bay", .012, .86, .058, .115, "", "blank"),
    element("text", .014, .785, .055, .060, "SIGNED FW"),
    element("button", .972, .91, .006, .022, undefined, "reset"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .147, .795 + index * .028, .003, .013),
      element("text", .102, .79 + index * .028, .037, .025, label),
    ])];
  profile.faces.rear.components = [
    ...[.021, .848].flatMap((x, column) => [.028, .365].map((y, row) =>
      element("psu", x, y, .132, .315, `PSU${column ? row ? 3 : 4 : row ? 1 : 2}`, "ac"))),
    ...[.157, .386, .615].map((x, index) => element("fan", x, .09, .227, .90, `FAN${index + 1}`, "removable")),
    element("module-bay", .009, .71, .044, .28, "SSD1", "blank"),
    element("module-bay", .054, .71, .044, .28, "SSD2", "blank")];
  profile.limitations.push("Panel coordinates are traced from the official hardware photograph. The storage sled covers are represented closed, without asserting installed capacity.");
}

/** Reproduce the separately illustrated 4200F, 4400F and 4800F supply populations and three-fan rear assemblies. */
function hyperscaleFRear(units, dc, fourDC = false) {
  const short = units === 3;
  const supplied = short || dc && !fourDC ? 2 : 4;
  const positions = short ? [.388, .687] : [.035, .275, .515, .755];
  const height = short ? .290 : .230;
  const fanY = short ? .077 : .300;
  const fanHeight = short ? .900 : .685;
  const coverY = short ? .117 : .325;
  const coverHeight = short ? .753 : .574;
  return [
    element("handle", .006, .13, .018, .54), element("handle", .977, .13, .018, .54),
    ...positions.map((y, index) => !short && index < 4 - supplied ?
      element("module-bay", .030, y, .124, height, "", "blank") :
      element("psu", .030, y, .124, height, `PSU${positions.length - index}`, dc ? "dc-keyed2" : "ac")),
    ...(short ? [element("module-bay", .030, .058, .124, .323, "", "blank")] :
      [element("module-bay", .261, .088, .655, .148, "", "blank")]),
    element("module-bay", .174, coverY, .086, coverHeight, "", "blank"),
    ...[.184, .224].map((x, index) => element("text", x - .012, coverY - .063, .034, .047, `SSD${index + 1}`)),
    ...[.184, .224].map((x) => element("vent", x, coverY + .08, .024, coverHeight - .16, undefined, "slots")),
    ...[.264, .497, .730].map((x, index) => element("fan", x, fanY, .231, fanHeight, `FAN${index + 1}`, "removable")),
    element("text", .967, .90, .030, .045, "GND"),
  ];
}

/** Trace the low connector strip and upper perforated grilles shared explicitly by the 4200F and 4400F drawings. */
function hyperscaleFControls(model, units) {
  const short = units === 3;
  const stripY = short ? .662 : .740;
  const lightY = short ? .785 : .848;
  const lightStep = short ? .039 : .026;
  return [
    element("text", .042, .087, .143, .070, model),
    element("vent", .029, short ? .25 : .22, .175, short ? .353 : .474, undefined, "perforated"),
    ...[.224, .422, .620, .818].map((x) => element("vent", x, .038, .177, short ? .565 : .656, undefined, "perforated")),
    element("vent", .039, stripY, .933, .043, undefined, "slots"),
    element("usb", short ? .090 : .084, short ? .905 : .924, .032, short ? .033 : .026, undefined, "a"),
    element("vent", .188, short ? .740 : .801, .025, short ? .183 : .147, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .072, lightY + index * lightStep, .004, short ? .016 : .012),
      element("text", .030, lightY - .004 + index * lightStep, .036, short ? .028 : .020, label),
    ]),
  ];
}

/** Trace all twenty SFP28 sockets and the differing QSFP banks of the 4200F and 4400F AC/DC models. */
function add42004400F(profile, device) {
  const short = device.model.startsWith("FortiGate 420");
  const dc = device.model.endsWith("-DC");
  inspected(profile, short ? "4200F" : "4400F", dc ? "3, 5 (front; DC rear)" : "3–4 (front; AC rear)");
  notePhysicalLabels(profile);
  const sfpColumns = short ? [.238, .271, .326, .360, .392, .426, .475, .508, .542, .575] :
    [.233, .266, .323, .356, .390, .423, .477, .510, .543, .576];
  const qsfpColumns = short ? [.634, .676, .753, .796] : [.632, .677, .754, .800, .868, .915];
  const height = short ? .080 : .060;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", short ? .106 : .100, short ? .827 : .866, .032, height);
    const y = index % 2 ? short ? .89 : .914 : short ? .79 : .83;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, short ? .158 : .150, y, .032, height);
    if (index < 22) return namedSlot(port, index < 4 ? `HA${index - 1}` : index < 6 ? `AUX${index - 3}` : String(index - 5),
      sfpColumns[Math.floor((index - 2) / 2)], y, .029, height);
    return namedSlot(port, String(index - 5), qsfpColumns[Math.floor((index - 22) / 2)], y, .038, height);
  });
  profile.faces.front.components = [...hyperscaleFControls(short ? "FortiGate 4200F" : "FortiGate 4400F", short ? 3 : 4),
    ...(short ? [element("vent", .825, .740, .145, .183, undefined, "slots")] : [])];
  profile.faces.rear.components = hyperscaleFRear(short ? 3 : 4, dc);
  profile.limitations.push("The guide's standard PSU population is shown. Storage sled covers remain closed; installed capacity differs between storage variants.");
  if (short) profile.limitations.push("Inventory revision 1 includes twenty SFP28 sockets. Revision-0 endpoints retain their IDs and configuration; an explicit index map keeps saved QSFP and console connections separate from the two added optical slots.");
}

/** Trace the 2026 4800F AC/DC/NEBS guide, including split upper ventilation and the full QSFP-DD bank. */
function add4800F(profile, device) {
  const dc = device.model.includes("-DC");
  inspected(profile, "4800F", dc ? "9, 11 (front; DC rear)" : "9–10 (front; AC rear)");
  notePhysicalLabels(profile);
  profile.hardwareRevision = "QuickStart Guide June 23, 2026; all six AC/DC/NEBS SKUs explicitly listed";
  const sfpColumns = [.218, .251, .301, .334, .368, .401];
  const qsfpColumns = [.455, .501, .555, .602, .654, .700];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .104, .878, .032, .060);
    const y = index % 2 ? .922 : .832;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .153, y, .032, .060);
    if (index < 14) return namedSlot(port, index < 4 ? `HA${index - 1}` : index < 6 ? `AUX${index - 3}` : String(index - 5),
      sfpColumns[Math.floor((index - 2) / 2)], y, .029, .060);
    if (index < 26) return namedSlot(port, String(index - 5), qsfpColumns[Math.floor((index - 14) / 2)], y, .038, .060);
    return namedSlot(port, String(index - 5), .759 + Math.floor((index - 26) / 2) * .055, y, .043, .060);
  });
  profile.faces.front.components = [element("text", .040, .093, .143, .070, "FortiGate 4800F"),
    element("vent", .015, .230, .186, .460, undefined, "perforated"),
    ...[.212, .409, .606].map((x) => element("vent", x, .050, .181, .640, undefined, "perforated")),
    element("vent", .802, .050, .077, .230, undefined, "perforated"),
    element("module-bay", .891, .050, .094, .230, "", "blank"),
    element("vent", .802, .308, .183, .382, undefined, "perforated"),
    element("vent", .027, .735, .950, .040, undefined, "slots"),
    element("vent", .181, .80, .014, .144, undefined, "slots"),
    element("usb", .088, .938, .032, .026, undefined, "a"),
    element("button", .022, .921, .008, .024, undefined, "reset"),
    element("text", .012, .954, .030, .022, "BLE"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .071, .842 + index * .028, .004, .012),
      element("text", .035, .840 + index * .028, .032, .022, label),
    ])];
  profile.faces.rear.components = hyperscaleFRear(4, dc, true);
  profile.limitations.push("The current guide's closed front grille and rear storage cover arrangement is shown. NEBS models have the filter preinstalled; installed storage capacity is not inferred from cover artwork.");
}

/** Apply the explicitly shared front drawings and separately traced terminal-powered DC rears from four model guides. */
function addTerminalDC(profile, device) {
  const model = device.model;
  if (model.startsWith("FortiGate 1100")) {
    add1100E(profile, device);
    inspected(profile, "1100E-qsg", "3–4 (shared front; separate DC rear)");
    profile.faces.rear.components = [
      ...[.034, .219, .403].map((x, index) => element("fan", x, .10, .179, .85, `FAN${index + 1}`, "fixed")),
      element("psu", .692, .497, .133, .483, "PWR1", "dc-terminal2"),
      element("psu", .842, .497, .133, .483, "PWR2", "dc-terminal2")];
  } else if (model.startsWith("FortiGate 300")) {
    add3000F(profile, device);
    inspected(profile, "3000F-qsg", "6–7 (shared front; separate AC/DC rears)");
    for (const component of profile.faces.rear.components) if (component.kind === "psu") component.variant = "dc-terminal2";
    profile.limitations.push("Inventory revision 1 corrects the former extra copper endpoints. The explicit revision map preserves saved optical and console connections without changing IDs or configuration.");
  } else {
    const is1800 = model.startsWith("FortiGate 180");
    if (is1800) add1800F(profile, device);
    else add2600F(profile, device);
    inspected(profile, is1800 ? "1800F-qsg" : "2600F-qsg", is1800 ? "3, 5 (shared front; DC rear)" : "4, 6 (shared front; DC rear)");
    profile.faces.rear.components = [
      ...[.054, .255, .456].map((x, index) => element("fan", x, .105, .170, .80, `FAN${index + 1}`, "fixed")),
      element("psu", .719, .405, .111, .46, "PSU2", "dc-terminal2"),
      element("psu", .833, .405, .111, .46, "PSU1", "dc-terminal2")];
    if (is1800) profile.limitations.push("Inventory revision 1 has one console. The old extra console endpoint remains preserved and unmapped.");
  }
  notePhysicalLabels(profile);
  profile.limitations.push("The model guide explicitly includes the DC SKU and illustrates its two supplies with separate positive, negative and grounding screw terminals.");
}

/** Draw the separately verified standard rear populations of the 300/400/500/600E enclosures. */
function legacyRackERear(generation, dc) {
  const fourFans = generation === 400 || generation === 600;
  return [
    ...Array.from({ length: fourFans ? 4 : 3 }, (_, index) => element("fan", (fourFans ? .089 : .107) + index * .098,
      .10, .088, .80, `FAN${index + 1}`, "fixed")),
    element("module-bay", fourFans ? .699 : .707, .025, .121, .95, "PWR2 OPTIONAL", "blank"),
    element("psu", fourFans ? .842 : .852, .025, .121, .95, "PWR1", dc ? "dc-terminal2" : "ac"),
  ];
}

/** Trace the distinct high-port-count and 10GE-uplink E-series panels using each model's own guide. */
function addLegacyRackE(profile, device) {
  const generation = Number(device.model.match(/ ([3456])0/)[1]) * 100;
  const dense = generation <= 400;
  inspected(profile, `${generation}E`, "3–4 (front; standard rear)");
  notePhysicalLabels(profile);
  const copperColumns = dense ? [.361, .394, .427, .460, .510, .543, .575, .607] : [.580, .613, .662, .695];
  const opticalColumns = dense ? [.655, .689, .723, .757, .798, .832, .865, .899] : [.769, .802, .849, .883];
  const copperEnd = dense ? 18 : 10;
  const opticalEnd = dense ? 34 : 18;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", dense ? .218 : .367, .64, .032, .22);
    const y = index % 2 ? .70 : .39;
    if (index < 2) return namedSlot(port, dense ? index ? "HA" : "MGMT" : index ? "MGMT" : "HA",
      dense ? index ? .307 : .263 : .417, dense ? .64 : y, .032, .22);
    if (index < copperEnd) return namedSlot(port, String(index - 1), copperColumns[Math.floor((index - 2) / 2)], y, .027, .22);
    if (index < opticalEnd) return namedSlot(port, index >= opticalEnd - 2 ? `VW${index - opticalEnd + 3}` :
      index >= opticalEnd - 4 ? `S${index - opticalEnd + 5}` : String(index - 1), opticalColumns[Math.floor((index - copperEnd) / 2)], y, .029, .22);
    return namedSlot(port, `X${index - opticalEnd + 1}`, .942, y, .030, .22);
  });
  profile.faces.front.components = [element("text", .020, .115, .122, .11, device.model.replace(/-DC$/, "")),
    element("vent", .015, dense ? .55 : .56, dense ? .098 : .210, .29, undefined, "perforated"),
    ...(dense ? [element("vent", .160, .10, .165, .18, undefined, "perforated")] : [
      element("vent", .167, .10, .060, .36, undefined, "perforated"),
      element("vent", .304, .10, .082, .18, undefined, "perforated"),
      element("vent", .448, .12, .090, .70, undefined, "perforated")]),
    ...[.44, .68].map((y) => element("usb", dense ? .161 : .304, y, .028, .11, undefined, "a")),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", dense ? .143 : .250, .43 + index * .105, .004, .035),
      element("text", dense ? .112 : .260, .42 + index * .105, .027, .065, label),
    ])];
  profile.faces.rear.components = legacyRackERear(generation, device.model.endsWith("-DC"));
  profile.limitations.push("The guide's standard configuration has one installed power supply and the optional second bay blank. The 300/500E rear has three fans; the separately illustrated 400/600E rear has four.");
}

/** Trace the 200E/201E's WAN bank, storage-only status indicator and fourteen-contact rear RPS inlet. */
function add200E(profile, device) {
  inspected(profile, "200E", "3 (front; rear; separate 201E indicator drawing)");
  notePhysicalLabels(profile);
  const dataColumns = [.509, .541, .577, .610, .644, .687, .720];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .370, .47, .032, .22);
    const y = index % 2 ? .64 : .34;
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .423, y, .032, .22);
    if (index < 4) return namedSlot(port, `WAN${index - 1}`, .475, y, .032, .22);
    if (index < 18) return namedSlot(port, String(index - 3), dataColumns[Math.floor((index - 4) / 2)], y, .029, .22);
    return namedSlot(port, String(index - 3), index < 20 ? .831 : .864, y, .030, .22);
  });
  profile.faces.front.components = [element("text", .025, .17, .132, .11, device.model),
    element("vent", .018, .54, .255, .33, undefined, "perforated"),
    element("vent", .181, .10, .085, .41, undefined, "perforated"),
    element("vent", .895, .09, .085, .80, undefined, "perforated"),
    element("usb", .354, .690, .032, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .320, .46 + index * .087, .004, .027),
      element("text", .327, .45 + index * .087, .025, .060, label),
    ]),
    ...(device.model === "FortiGate 201E" ? [element("led", .290, .721, .004, .027),
      element("text", .276, .62, .030, .070, "HDD")] : [])];
  profile.faces.rear.components = [element("vent", .122, .20, .208, .69, undefined, "perforated"),
    element("vent", .378, .20, .107, .69, undefined, "perforated"),
    { ...element("power", .620, .43, .080, .40, undefined, "dc-multipin"), columns: 7 },
    element("text", .612, .18, .096, .10, "RPS 12V"),
    element("power", .880, .28, .050, .52, undefined, "iec"),
    element("switch", .936, .30, .035, .50, undefined, "power")];
}

/** Trace the cellular 50G/51G's five exposed SMA sockets, separate BLE cap and rear-only Ethernet bank. */
function add50GCellular(profile, device) {
  inspected(profile, "50G-5G", "5–6 (front; rear), cover explicitly lists FG-50G-5G and FG-51G-5G");
  notePhysicalLabels(profile);
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => port.type === "Console" ?
    namedSlot(port, "CONSOLE", .201, .578, .067, .24) :
    namedSlot(port, ["WAN", "A", "3", "2", "1"][index], .653 + index * .065, .578, .060, .24));
  profile.faces.front.components = [
    element("text", .137, .48, .22, .11, "FortiGate 50G-5G"),
    ...[.035, .922].map((x) => element("coax", x, .14, .045, .25)),
    ...[.035, .922].map((x) => element("text", x, .43, .045, .075, "5G")),
    element("coax", .878, .49, .039, .22, undefined, "capped"),
    element("text", .873, .77, .050, .075, "BLE"),
    element("button", .049, .680, .010, .040, undefined, "reset"),
    element("text", .025, .78, .067, .065, "BLE/RESET"),
    element("led", .095, .72, .008, .045),
    element("text", .087, .81, .030, .065, "BLE"),
    element("led", .205, .76, .008, .045),
    element("text", .171, .85, .09, .070, "SIGNED FW"),
    ...[0, 1, 2].map((index) => element("led", .365 + index * .024, .723, .008, .045)),
    element("text", .320, .641, .119, .070, "PWR STATUS HA"),
    ...["SVC", "5G"].flatMap((label, index) => [
      element("led", .460, .572 + index * .151, .008, .045),
      element("text", .450, .496 + index * .151, .030, .070, label),
    ]),
    ...[.572, .723].flatMap((y) => Array.from({ length: 5 }, (_, index) => element("led", .580 + index * .024, y, .008, .045))),
    element("text", .568, .48, .131, .070, "1 2 3 A WAN"),
    element("text", .699, .562, .060, .070, "LINK/ACT"),
    element("text", .699, .713, .060, .070, "SPEED"),
  ];
  profile.faces.rear.components = [
    ...[.013, .477, .941].map((x) => element("coax", x, .075, .045, .25)),
    ...["5G", "GPS", "5G"].map((label, index) => element("text", [.013, .477, .941][index], .338, .045, .075, label)),
    element("vent", .082, .090, .383, .20, undefined, "slots"),
    element("vent", .531, .090, .390, .20, undefined, "slots"),
    element("power", .067, .350, .030, .415, undefined, "dc-keyed2"),
    element("usb", .115, .410, .028, .350, undefined, "a"),
    element("module-bay", .258, .526, .035, .46, "", "blank"),
    element("text", .246, .350, .065, .120, "SIGNED FW"),
    element("vent", .312, .409, .285, .398, undefined, "slots"),
  ];
  profile.limitations.push("Five exposed SMA sockets are shown separately from the BLE antenna cap. The signed-firmware switch is under its illustrated rear access cover; external antenna rods and internal SIM slots are outside the panel view.");
}

/** Trace the single upper intake grille and lower control strip illustrated separately in the large E-series guides. */
function legacyLargeEControls(model) {
  return [element("vent", .009, .018, .982, .465, undefined, "perforated"),
    element("text", .014, .531, .135, .06, model),
    element("usb", .095, .748, .012, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .056, .716 + index * .046, .004, .022),
      element("text", .010, .711 + index * .046, .039, .032, label),
    ])];
}

/** Place the opposite-end vertical supplies and four separately identified fan grilles on inspected two-unit E models. */
function legacyLargeERear(dc, ground = true) {
  return [
    ...[.018, .888].map((x, index) => ({ ...element("psu", x, .035, .096, .67, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    ...[.132, .323, .514, .705].map((x, index) => element("fan", x, .15, .178, .80, `FAN${index + 1}`, "fixed")),
    ...(ground ? [.048, .088].map((x) => element("screw", x, .842, .020, .085)) : []),
  ];
}

/** Trace the 2201E-ACDC and 3300E/3301E drawings, keeping their differently positioned copper banks distinct. */
function add22013300E(profile, device) {
  const newer = device.model.startsWith("FortiGate 220");
  const acdc = device.model.endsWith("-ACDC");
  inspected(profile, newer ? acdc ? "2201E-ACDC" : "2200E-ds" : "3300E",
    newer ? acdc ? "7 front; 8 rear" : "7 front and rear; 8 both model specifications" : "3 front; 4 rear");
  notePhysicalLabels(profile);
  profile.faces.front.components = legacyLargeEControls(device.model.replace("FortiGate ", ""));
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .137, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .189, y, .031, .12);
    if (index < 14) return namedSlot(port, String(index - 1), .242 + Math.floor((index - 2) / 2) * .0334 +
      (index >= 10 ? .013 : 0), y, .030, .12);
    if (index < 18) {
      const position = namedSlot(port, String(index - 1), (newer ? .539 : .462) + Math.floor((index - 14) / 2) * .034,
        y, .030, .12);
      return newer ? position : { ...position, compatibleTypes: ["RJ45_1G"] };
    }
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 1),
      .615 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    const position = namedSlot(port, String(index - 3), .913 + Math.floor((index - 34) / 2) * .047, y, .038, .12);
    return newer ? position : { ...position, compatibleTypes: ["QSFP28_100G"] };
  });
  profile.faces.rear.components = legacyLargeERear(false);
  if (acdc) profile.hardwareRevision = "FG-2201E-ACDC QuickStart Guide, June 10, 2025; explicitly illustrated C16 AC inlets.";
  else if (!newer) profile.limitations.push("Inventory revision 1 adds two missing copper endpoints, identifies data13–16 as 10GE and QSFP31–34 as 40GE. Legacy indices and saved media configuration are mapped without rewriting them.");
}

/** Trace each 3400E/3401E and 3600E/3601E optical bank and its separately pictured AC or DC rear. */
function add34003600E(profile, device) {
  const larger = device.model.includes("360");
  const dc = device.model.endsWith("-DC");
  inspected(profile, larger ? "3600E" : "3400E", "3 front; 4 AC and DC rears");
  notePhysicalLabels(profile);
  const opticalEnd = larger ? 34 : 26;
  profile.faces.front.components = legacyLargeEControls(device.model.replace("FortiGate ", "").replace(/-DC$/, ""));
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < opticalEnd) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, index < 4 ? `HA${index - 1}` : String(index - 3),
        .246 + column * .0336 + Math.floor(column / 4) * .010, y, .030, .12);
    }
    return namedSlot(port, String(index - 3), .846 + Math.floor((index - opticalEnd) / 2) * .052, y, .040, .12);
  });
  profile.faces.rear.components = legacyLargeERear(dc, !larger || dc);
  profile.limitations.push(larger
    ? "Inventory revision 1 restores eight SFP28 and two QSFP28 sockets omitted by the former family inventory. Explicit mappings preserve existing saved optical and console connections."
    : "Inventory revision 1 removes the former extra console entry. The first31 saved physical indices retain their sockets; the second console remains an unmapped endpoint.");
}

/** Trace the two explicitly different 3960E/3980E fronts and the dual fan trays with three vertical rear supplies. */
function add39603980E(profile, device) {
  const larger = device.model.includes("3980");
  const dc = device.model.endsWith("-DC");
  inspected(profile, "3960E", "3 model-specific fronts; 5 AC and DC rears");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .101, .880, .032, .08);
    const y = index % 2 ? .918 : .862;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .152, y, .031, .054);
    if (index < 18) return { ...namedSlot(port, String(index - 1), .195 + Math.floor((index - 2) / 2) * .0335,
      y, .030, .054), compatibleTypes: ["SFP28_25G"] };
    const column = index - 18;
    return namedSlot(port, String(index - 1), larger ? .483 + column * .0448 : .482 + column * .043 + Math.floor(column / 2) * .046,
      .924, .039, .057);
  });
  profile.faces.front.components = [element("vent", .010, .023, .978, .60, undefined, "perforated"),
    element("vent", .240, .620, .748, .132, undefined, "perforated"),
    element("text", .018, .676, .180, .044, device.model.replace("FortiGate ", "").replace(/-DC$/, "")),
    element("usb", .085, .938, .031, .034, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .035, .851 + index * .023, .004, .014),
      element("text", .007, .848 + index * .023, .026, .022, label),
    ]),
    ...(larger ? [element("vent", .454, .818, .460, .066, undefined, "slots")]
      : [.457, .588, .724].map((x) => element("vent", x, .818, .090, .066, undefined, "slots"))),
  ];
  profile.faces.rear.components = [element("handle", .030, .089, .025, .70),
    element("module-bay", .410, .080, .113, .88, "", "blank"),
    ...[.114, .557].flatMap((x) => [
      element("fan", x, .073, .222, .418, "", "fixed"),
      element("fan", x, .499, .222, .418, "", "fixed"),
      element("handle", x + .222, .369, .021, .26),
    ]),
    ...[.076, .341, .607].map((y, index) => ({ ...element("psu", .892, y, .098, .257, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    ...[.905, .955].map((x) => element("screw", x, .911, .020, .054)),
  ];
  profile.limitations.push("Inventory revision 1 replaces the former family port mix with the illustrated sixteen SFP+ and model-specific QSFP28 count. Surplus saved endpoints remain unmapped; surviving endpoints retain explicit index and media compatibility mappings.");
}

/** Preserve prior E-series endpoint indices across corrections without assigning surplus saved sockets to new physical ports. */
function addLegacyEMapping(profile, device) {
  const model = device.model;
  let portIndexMap;
  if (/^FortiGate 330[01]E$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => ![17, 18].includes(port.portIndex))
      .map((port) => [port.portIndex > 18 ? port.portIndex - 2 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate 340[01]E(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex]));
  } else if (/^FortiGate 360[01]E(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 26 ||
      port.portIndex >= 35 && port.portIndex <= 38 || port.type === "Console")
      .map((port) => [port.type === "Console" ? 31 : port.portIndex <= 26 ? port.portIndex : port.portIndex - 8, port.portIndex]));
  } else if (/^FortiGate 39[68]0E(?:-(?:DC|ACDC))?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 26 || port.type === "Console")
      .map((port) => [port.type === "Console" ? 43 : port.portIndex <= 18 ? port.portIndex : port.portIndex + 16, port.portIndex]));
  } else if (/^FortiGate (?:2000E|2500E)$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 14 || port.type === "SFP_PLUS_10G" || port.type === "Console")
      .map((port) => [port.type === "Console" ? 39 : port.portIndex <= 14 ? port.portIndex : port.portIndex - 20, port.portIndex]));
  } else if (model === "FortiGate 400E-Bypass") {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 18 || port.type === "Console")
      .map((port) => [port.portIndex, port.portIndex]));
  }
  if (portIndexMap) profile.legacyLayouts = [{ inventoryRevision: 0, portIndexMap }];
}

/** Trace the independently illustrated 2000E and 2500E fronts, including the latter's fixed LC bypass sockets. */
function add20002500E(profile, device) {
  const bypass = device.model === "FortiGate 2500E";
  inspected(profile, bypass ? "2500E-ds" : "2000E", bypass ? "7 front and rear" : "3 front; 4 rear");
  notePhysicalLabels(profile);
  profile.faces.front.components = [element("text", .012, .085, .15, .10, device.model.replace("FortiGate ", "")),
    element("vent", .178, .080, .798, .40, undefined, "perforated"),
    element("vent", .022, .295, .156, .185, undefined, "perforated"),
    element("usb", .049, .769, .029, .058, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .028, .619 + index * .058, .005, .026),
      element("text", .002, .614 + index * .058, .024, .035, label),
    ]),
    ...(bypass ? [element("led", .907, .680, .006, .032), element("text", .884, .606, .022, .04, "BP")] : []),
  ];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .063, .676, .031, .12);
    const y = index % 2 ? .810 : .660;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .109, y, .031, .12);
    if (index < 34) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, String(index - 1), .155 + column * .0331 + (column >= 8 ? .008 : 0), y, .030, .12);
    }
    if (port.type === "FIBER_LC") return namedSlot(port, String(index - 1), .927, y, .026, .12);
    const column = Math.floor((index - 34) / 2);
    return { ...namedSlot(port, String(index - 1), (bypass ? .697 : .762) + column * .0338 +
      (column >= (bypass ? 4 : 2) ? .008 : 0), y, .030, .12), compatibleTypes: ["SFP28_25G"] };
  });
  profile.faces.rear.components = [
    ...[.055, .279, .506].map((x, index) => element("fan", x, .163, .183, .78, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.716, .848].map((x, index) => element("psu", x, .454, .128, .459, `PWR${index + 1}`, "ac")),
    ...[.620, .860].map((y) => element("screw", .014, y, .023, .085)),
  ];
  profile.limitations.push("Three rear grille openings cover six tandem fans; only the exposed openings are drawn. Inventory revision 1 corrects the former family mix without assigning surplus saved optical endpoints to new copper sockets.");
}

/** Trace the 400E-Bypass's sixteen copper bypass pairs and two installed rear supplies. */
function add400EBypass(profile, device) {
  inspected(profile, "400E-Bypass", "2 front; 3 rear");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .640, .032, .24);
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .177, index ? .630 : .350, .031, .24);
    const column = Math.floor((index - 2) / 2);
    return namedSlot(port, String(index - 1), .238 + column * .0368 + Math.floor(column / 2) * .0212,
      index % 2 ? .630 : .350, .031, .24);
  });
  profile.faces.front.components = [element("text", .012, .11, .151, .11, "400E-BYPASS"),
    element("usb", .074, .505, .012, .285, undefined, "a"),
    element("usb", .095, .505, .012, .285, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .043, .470 + index * .090, .004, .04),
      element("text", .009, .465 + index * .090, .030, .055, label),
    ]),
    ...Array.from({ length: 8 }, (_, index) => element("vent", .201 + index * .0948, .21, .010, .57, undefined, "perforated")),
    element("vent", .957, .21, .021, .57, undefined, "perforated"),
  ];
profile.faces.rear.components = [...[.120, .600].map((y) => element("screw", .046, y, .026, .20)),
    ...[.090, .186, .283, .379].map((x, index) => element("fan", x, .080, .088, .84, `FAN${index + 1}`, "fixed")),
    element("psu", .698, .030, .121, .94, "PWR2", "ac"), element("psu", .838, .030, .121, .94, "PWR1", "ac"),
  ];
  profile.limitations.push("Inventory revision 1 replaces the former optical entries with the documented copper bypass pairs. Existing optical saved endpoints remain unmapped.");
}

/** Draw the 800D's separately numbered WAN bypass partners and its standard single populated power bay. */
function add800D(profile, device) {
  const dc = device.model.endsWith("-DC");
  inspected(profile, "800D", "3 front, AC rear and DC rear");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .238, .540, .033, .25);
    const y = index % 2 ? .565 : .285;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .316, y, .032, .25);
    if (index < 4) return namedSlot(port, String(index - 1), .369 + (index - 2) * .049, .565, .032, .25);
    if (index < 24) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, String(index - 1), .469 + column * .0328 + (column >= 4 ? .014 : 0), y, .030, .25);
    }
    if (index < 26) return namedSlot(port, `WAN${index - 23}`, .369 + (index - 24) * .049, .285, .032, .25);
    return namedSlot(port, String(index - 3), .831 + Math.floor((index - 26) / 2) * .0332, y, .030, .25);
  });
  profile.faces.front.components = [element("text", .020, .130, .135, .14, "800D"),
    element("usb", .173, .363, .031, .10, undefined, "a"), element("usb", .173, .550, .031, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .264, .245 + index * .118, .004, .04),
      element("text", .271, .240 + index * .118, .026, .053, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...[.013, .110, .207, .305, .403].map((x, index) => element("fan", x, .070, .088, .85, `FAN${index + 1}`, "fixed")),
    ...[.567, .617].map((x) => element("screw", x, .530, .023, .23)),
    element("psu", .708, .040, .119, .90, "PWR1", dc ? "dc-recessed3-inlet-right" : "ac-inlet-right"),
    element("module-bay", .850, .045, .121, .90, "PWR2 OPTIONAL", "blank"),
  ];
  profile.limitations.push("The standard illustrated rear has one supply and one optional blank bay. Revision 1 adds WAN1/WAN2 after the existing copper identities; each WAN socket is above its data1/data2 bypass partner.");
}

/** Trace the distinct one- and two-unit mixed-media D fronts and their perforated rear panels. */
function add9001000D(profile, device) {
  const tall = device.model === "FortiGate 1000D";
  inspected(profile, tall ? "1000D" : "900D", "3 front and rear");
  notePhysicalLabels(profile);
  const rowY = tall ? [.656, .801] : [.378, .635];
  const height = tall ? .12 : .24;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", tall ? .194 : .205, tall ? .790 : .635, .032, height);
    if (port.type === "USB_MINI_CONSOLE") return namedSlot(port, "USB MGMT", tall ? .090 : .102, tall ? .865 : .748, .021, tall ? .050 : .085);
    const y = rowY[index % 2];
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, tall ? .247 : .257, y, .032, height);
    if (index < 18) {
      const offset = index - 2;
      return namedSlot(port, String(offset < 8 ? offset + 9 : offset + 17),
        (offset < 8 ? tall ? .449 : .453 : tall ? .834 : .824) + Math.floor(offset % 8 / 2) * .033, y, .031, height);
    }
    if (index < 34) {
      const offset = index - 18;
      return namedSlot(port, String(offset < 8 ? offset + 1 : offset + 9),
        (offset < 8 ? .301 : .681) + Math.floor(offset % 8 / 2) * .033, y, .031, height);
    }
    return namedSlot(port, index === 34 ? "B" : "A", .615, y, .031, height);
  });
  profile.faces.front.components = tall ? [
    element("text", .019, .070, .135, .12, "1000D"),
    element("vent", .172, .048, .807, .405, undefined, "perforated"),
    element("vent", .020, .295, .153, .158, undefined, "perforated"),
    element("usb", .124, .716, .032, .069, undefined, "a"), element("usb", .124, .814, .032, .069, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .056, .665 + index * .061, .005, .029),
      element("text", .028, .659 + index * .061, .025, .036, label),
    ]),
  ] : [element("text", .020, .110, .111, .15, "900D"),
    element("usb", .134, .432, .032, .10, undefined, "a"), element("usb", .134, .620, .032, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .042 + Math.floor(index / 2) * .027, .608 + index % 2 * .115, .004, .04),
      element("text", .048 + Math.floor(index / 2) * .027, .604 + index % 2 * .115, .015, .055, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...(tall ? [.074, .275, .475].map((x) => element("vent", x, .142, .182, .79, undefined, "perforated"))
      : [.060, .293].map((x) => element("vent", x, .218, .211, .64, undefined, "perforated"))),
    ...[.727, .849].map((x, index) => element("psu", x, tall ? .550 : .052, .117, tall ? .43 : .89, `PWR${index + 1}`, "ac-inlet-right")),
  ];
  profile.limitations.push("The rear drawings expose perforated vent fields, without separately visible fan modules. Revision 1 appends the separate USB management endpoint without changing older identities.");
  if (tall) profile.limitations.push("The guide calls the USB management interface USB B; its enlarged drawing shows the five-contact mini-B receptacle.");
}

/** Trace each 3000D/3100D/3200D optical-bank arrangement and the independently pictured AC/DC supply connectors. */
function add300031003200D(profile, device) {
  const model = device.model.replace("FortiGate ", "").replace(/-DC$/, "");
  const dc = device.model.endsWith("-DC");
  const wide = model === "3200D";
  inspected(profile, model, wide ? "5 front; 6 AC and DC rears" : "3 front; 4 AC and DC rears");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", wide ? .094 : .080, .702, .032, .12);
    const y = index % 2 ? .810 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, wide ? .142 : .127, y, .032, .12);
    const column = Math.floor((index - 2) / 2);
    return namedSlot(port, String(index - 1), (wide ? .188 : .446) + column * .0331 + Math.floor(column / 8) * .010,
      y, .030, .12);
  });
  profile.faces.front.components = [element("text", .018, .072, .137, .115, model),
    element("vent", .173, .049, .807, .405, undefined, "perforated"),
    element("vent", .021, .289, .152, .166, undefined, "perforated"),
    element("usb", wide ? .079 : .065, .815, .030, .055, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .026, .650 + index * .061, .004, .023),
      element("text", .004, .643 + index * .061, .019, .032, label),
    ]),
    ...(!wide ? [element("vent", .173, .578, .245, .286, undefined, "perforated")] : []),
    ...(model === "3000D" ? [element("vent", .709, .578, .271, .286, undefined, "perforated")] : []),
  ];
  profile.faces.rear.components = [
    ...[.025, .156].map((x, index) => element("psu", x, .500, .128, .480, `PWR${index + 1}`, dc ? "dc-keyed3-inlet-right" : "ac-inlet-right")),
    ...[.314, .545, .776].map((x, index) => element("fan", x, .173, .182, .78, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.645, .875].map((y) => element("screw", .966, y, .022, .09)),
  ];
  profile.limitations.push("Three exposed rear grille openings cover tandem fan pairs; the supplies are separately drawn for AC and DC variants.");
  if (wide && !dc) profile.limitations.push("The publisher clips the AC rear figure at both edges on PDF page 6. Its underlying vector outline was inspected to verify the complete power bays and chassis grounding studs.");
  if (model === "3100D") profile.limitations.push("Revision 1 corrects forty-eight catalog SFP+ endpoints to the documented thirty-two. Surplus saved endpoints remain unmapped, and the console keeps an explicit old-index mapping.");
}

/** Trace the 3700D's left QSFP row, right SFP banks and opposite-end vertical supplies. */
function add3700D(profile, device) {
  const dc = device.model.endsWith("-DC");
  inspected(profile, "3700D", "3 front, AC rear and DC rear; 4 connector details");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .116, .783, .032, .080);
    if (port.type === "USB_MINI_CONSOLE") return { ...namedSlot(port, "USB MGMT", .040, .885, .020, .040),
      connectorKind: "usb-mini", compatibleTypes: ["Console"] };
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .164, index % 2 ? .859 : .769, .031, .080);
    if (index < 30) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, String(index + 3), .495 + column * .0338 + (column >= 6 ? .015 : 0),
        index % 2 ? .859 : .769, .030, .080);
    }
    return namedSlot(port, String(index - 29), .216 + (index - 30) * .055, .870, .043, .075);
  });
  profile.faces.front.components = [element("vent", .020, .055, .963, .493, undefined, "perforated"),
    element("text", .021, .610, .140, .07, "3700D"), element("usb", .101, .865, .029, .042, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .080, .743 + index * .038, .004, .017),
      element("text", .052, .739 + index * .038, .024, .027, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...[.006, .903].map((x, index) => ({ ...element("psu", x, .434, .091, .419, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    element("handle", .101, .120, .017, .81), element("handle", .882, .120, .017, .81),
    ...[.160, .389, .618].map((x, index) => element("fan", x, .257, .202, .63, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.650, .758].map((y) => element("screw", .852, y, .019, .052)),
  ];
  profile.limitations.push("Revision 1 identifies the former second console entry as the illustrated USB mini-B management socket while preserving its saved index. Three grille openings cover six tandem fans.");
}

/** Preserve D-series saved identities when correcting missing WAN/USB sockets or surplus optical inventory. */
function addLegacyDMapping(profile, device) {
  const model = device.model;
  let portIndexMap;
  if (/^FortiGate 800D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => ![25, 26].includes(port.portIndex))
      .map((port) => [port.portIndex > 26 ? port.portIndex - 2 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate (?:900D|1000D)$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.type !== "USB_MINI_CONSOLE").map((port) => [port.portIndex, port.portIndex]));
  } else if (/^FortiGate 3100D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.type === "Console" ? 51 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate 3700D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex]));
  }
  if (portIndexMap) profile.legacyLayouts = [{ inventoryRevision: 0, portIndexMap }];
}

/** Trace the explicitly shared 6001/6300/6301/6500/6501 panels and their documented DC bay population. */
function add6000F(profile, device) {
  const dc = device.model.endsWith("-DC");
  inspected(profile, "6000F", "7 named models and shared panels; 8 front; 13 connectors; 16 AC rear; 24 DC supplies and upper bay blank");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index < 24) {
      const column = Math.floor(index / 2);
      return namedSlot(port, String(index + 1), .310 + column * .030 + Math.floor(column / 4) * .022,
        index % 2 ? .897 : .794, .027, .076);
    }
    if (index < 28) return namedSlot(port, String(index + 1), .737 + (index - 24) * .0533, .904, .039, .070);
    if (index < 30) return namedSlot(port, `MGMT${index - 27}`, .157, index % 2 ? .897 : .794, .030, .076);
    if (index < 33) return { ...namedSlot(port, ["MGMT3", "HA1", "HA2"][index - 30], index === 30 ? .194 : .267,
      index === 31 ? .794 : .897, .028, .076), connectorKind: "sfp", compatibleTypes: ["RJ45_1G"] };
    return namedSlot(port, "CONSOLE", .115, .838, .031, .078);
  });
  for (const port of profile.faces.front.ports) port.descriptionAnchor = {
    x: port.portIndex === 34 ? .100 : port.x, y: port.portIndex === 34 ? .773 : port.y < .85 ? .728 : .972,
  };
  profile.faces.front.components = [
    element("handle", .012, .055, .020, .535), element("handle", .968, .055, .020, .535),
    element("text", .062, .085, .160, .135, device.model.replace("FortiGate ", "").replace("-DC", "")),
    element("vent", .064, .251, .153, .357, undefined, "perforated"),
    ...[.237, .412, .587, .761].map((x) => element("vent", x, .072, .153, .543, undefined, "perforated")),
    element("vent", .064, .667, .635, .048, undefined, "slots"),
    element("vent", .718, .667, .201, .096, undefined, "perforated"),
    element("usb", .100, .892, .029, .031, undefined, "a"),
    element("button", .065, .916, .005, .020, undefined, "reset"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .085, .785 + index * .040, .005, .020),
      element("text", .065, .783 + index * .040, .018, .025, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...[.024, .350, .674].map((y, index) => element(dc && index === 0 ? "module-bay" : "psu",
      .027, y, .140, .310, `PSU${3 - index}`, dc && index === 0 ? "blank" : dc ? "dc-keyed2" : "ac")),
    element("module-bay", .174, .114, .086, .750, undefined, "populated"),
    element("vent", .184, .277, .026, .470, undefined, "slots"),
    element("vent", .221, .277, .026, .470, undefined, "slots"),
    element("text", .175, .013, .085, .065, "SSD1 / SSD2"),
    element("led", .185, .235, .012, .020), element("led", .222, .235, .012, .020),
    ...[.198, .241].map((x) => element("screw", x, .895, .020, .070)),
    ...[.262, .499, .737].map((x, index) => element("fan", x, .092, .235, .889, `FAN${index + 1}`, "mesh-handle")),
    element("handle", .002, .240, .020, .550), element("handle", .977, .240, .020, .550),
  ];
  profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex])) }];
  profile.limitations.push("The system guide explicitly gives these named SKUs the same front and rear configuration. AC has three installed supplies; DC has two lower supplies and a metal upper blank. The shared rear cover conceals internal log disks, populated only in 6001F/6301F/6501F models.");
  profile.limitations.push("Revision 1 corrects MGMT3/HA1/HA2 from copper to SFP+ without rewriting saved endpoint media or identity. The undocumented second saved console remains unmapped.");
}

/** Draw an exposed single-row removable terminal header using its documented contact count. */
function ruggedTerminal(x, y, width, height, pins) {
  return { ...element("terminal", x, y, width, height, undefined, "pluggable"), pins };
}

/** Trace DIN mounting hardware in the guide's portrait rear view, then rotate it with the manufacturer's landscape front. */
function ruggedDINRear(model) {
  const seriesF = model.includes("70F");
  const cellular = model.includes("5G");
  const dual = model.includes("Dual");
  const panel = seriesF ? { left: .036, right: .630, top: .320, bottom: .750 } :
    cellular ? { left: dual ? .238 : .277, right: dual ? .741 : .862, top: .299, bottom: .646 } :
      { left: .055, right: .730, top: .245, bottom: .680 };
  const points = seriesF ? [[.095, .055], [.578, .109], [.095, .945], [.578, .893], [.080, .500], [.578, .409], [.578, .545]] :
    cellular ? [[dual ? .282 : .325, .119], [dual ? .700 : .815, .119], [.483, .132],
      [dual ? .282 : .325, .880], [dual ? .700 : .815, .880], [.483, .830],
      [dual ? .282 : .325, .429], [dual ? .700 : .815, .429], [dual ? .282 : .325, .572], [dual ? .700 : .815, .572]] :
      [[.119, .147], [.659, .107], [.119, .850], [.659, .890], [.119, .409], [.659, .409], [.119, .590], [.659, .590]];
  const components = [
    element("chassis", panel.left, .012, panel.right - panel.left, .976),
    element("chassis", .018, panel.top, .964, panel.bottom - panel.top),
    element("chassis", .018, panel.top, .964, .039),
    element("chassis", .018, panel.bottom - .042, .964, .039),
    ...points.map(([x, y]) => element("screw", x - .025, y - .016, .05, .032)),
  ];
  return components.map((component) => ({ ...component, x: component.y, y: 1 - component.x - component.width,
    width: component.height, height: component.width }));
}

/** State the DIN orientation and avoid representing side cooling fins or internal media as rear sockets. */
function noteRuggedDIN(profile) {
  profile.limitations.push("The connector view follows the manufacturer's landscape front illustration. Rear mounting geometry is rotated consistently from its portrait DIN drawing and shows the supplied DIN bracket installed. Side cooling fins and covered side storage are outside these panel views; this is an illustration, not a manufacturing scale drawing.");
}

/** Trace the low-profile 60F and cellular variant, with their actual rear DB9 serial and paired power inputs. */
function addRugged60F(profile, device) {
  const cellular = device.model.endsWith("-3G4G");
  inspected(profile, "R60F", cellular ? "5 front; 6 rear and covered SIM sockets" : "3 front; 4 rear");
  notePhysicalLabels(profile);
  profile.chassis = { x: .125, y: .325, width: .75, height: .35 };
  const front = device.ports.filter((port) => port.portIndex !== 10);
  profile.faces.front.ports = front.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .235, cellular ? .599 : .619, .055, .24);
    const x = index < 4 ? .325 + index * .073 : index < 6 ? .644 + (index - 4) * .092 : .828 + (index - 6) * .070;
    return namedSlot(port, index < 4 ? String(index + 1) : index < 6 ? `WAN${index - 3}` : `SFP${index - 5}`,
      x, cellular ? .606 : .642, .055, .22);
  });
  profile.faces.rear.ports = [{ ...namedSlot(device.ports[9], "SERIAL", .366, .490, .113, .21), connectorKind: "db9" }];
  profile.faces.front.components = [
    element("text", cellular ? .393 : .025, .080, .250, .18, device.model.replace("FortiGate ", "")),
    ...["BYPASS", "STATUS", "HA", "PWR"].flatMap((label, index) => [
      element("led", .042, .391 + index * .092, .010, .075),
      element("text", .057, .391 + index * .092, .068, .065, label),
    ]),
    ...(cellular ? [element("chassis", .140, .302, .045, .58), element("screw", .152, .790, .020, .105)] :
      [element("usb", .158, .50, .020, .26, undefined, "a"), element("chassis", .062, .765, .129, .22)]),
    ...(cellular ? [[.060, "DIV"], [.756, "GPS"], [.920, "MAIN"]].flatMap(([x, label]) => [
      element("coax", x - .013, .075, .026, .14), element("text", x - .030, .233, .060, .066, label),
    ]) : []),
    ...(cellular ? ["LTE", "SIM1", "SIM2"].flatMap((label, index) => [
      element("led", .101, .463 + index * .092, .010, .075),
      element("text", .113, .463 + index * .092, .028, .065, label),
    ]) : []),
  ];
  profile.faces.rear.components = [
    ...[.125, .201].map((x) => element("screw", x, .37, .039, .245)),
    ...[.022, .210, .339, .657, .973].map((x) => element("screw", x - .011, .120, .022, .14)),
    element("button", .061, .700, .013, .080, undefined, "reset"),
    element("text", .043, .80, .050, .075, "RESET"),
    ruggedTerminal(.677, .620, .101, .205, 2), ruggedTerminal(.821, .620, .101, .205, 2),
    element("text", .680, .836, .096, .075, "DC2"), element("text", .823, .836, .096, .075, "DC1"),
    element("led", .605, .590, .012, .075), element("led", .605, .724, .012, .075),
    ...(cellular ? [element("chassis", .458, .610, .090, .35),
      ...[.473, .514].map((x) => element("screw", x, .635, .021, .115)),
      element("text", .404, .735, .049, .095, "SIM1/2")] : []),
  ];
  profile.limitations.push("The source distinguishes front RJ45 console from rear male DB9 serial; the second saved Console endpoint retains its ID and uses the DB9 physical drawing. WAN1/WAN2 and SFP1/SFP2 are shared interfaces. The shorter physical body is centered within the pre-existing three-unit allocation, which is not rewritten.");
  if (cellular) profile.limitations.push("The USB and dual SIM sockets are shown with their illustrated protective covers closed; external antenna rods are omitted.");
}

/** Trace the distinct 70F front with six-pin I/O, paired ground studs and optional three cellular antenna sockets. */
function addRugged70F(profile, device) {
  const cellular = device.model.endsWith("-3G4G");
  inspected(profile, "R70F", `${cellular ? 17 : 15} front; 7 shared chassis; 9–10 rear DIN bracket and dimensions`);
  notePhysicalLabels(profile);
  profile.chassis = { x: .225, y: .025, width: .55, height: .95 };
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index < 6) return namedSlot(port, index < 4 ? String(index + 1) : `WAN${index - 3}`,
      [.503, .641, .817][Math.floor(index / 2)], index % 2 ? .433 : .300, .095, .15);
    if (index < 8) return namedSlot(port, `SFP${index - 5}`, .766 + (index - 6) * .131, .827, .10, .10);
    return namedSlot(port, index === 8 ? "COM1" : "COM2", .325, index === 8 ? .300 : .433, .095, .15);
  });
  for (const port of profile.faces.front.ports.filter((item) => item.type !== "SFP_1G")) {
    port.descriptionAnchor = { x: port.x, y: port.y < .35 ? .227 : .514 };
  }
  profile.faces.front.components = [
    element("chassis", .163, .260, .069, .294), element("screw", .180, .268, .035, .052),
    element("button", .060, .445, .035, .055, undefined, "reset"),
    ...["STA", "ALM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .126, .286 + index * .064, .022, .032),
      element("text", .092, .285 + index * .064, .033, .035, label),
    ]),
    ...[.056, .201].map((x) => element("screw", x, .598, .070, .095)),
    ruggedTerminal(.058, .765, .277, .113, 4), ruggedTerminal(.394, .771, .289, .087, 6),
    element("text", .069, .709, .260, .040, "DC1 / DC2  12–125V"),
    element("text", .394, .892, .289, .040, "IN1 REF IN2 NC COM NO"),
    element("text", .375, .578, .320, .100, device.model.replace("FortiGate ", "")),
    element("coax", .798, .575, .080, .105, undefined, "capped"),
    element("text", .795, .694, .083, .040, "BLE"),
    element("led", .635, .539, .022, .032), element("text", .659, .539, .062, .035, "BYP"),
    ...(cellular ? [[.059, .190, "MAIN"], [.685, .103, "GPS"], [.941, .193, "DIV"]].flatMap(([x, y, label]) => [
      element("coax", x - .029, y - .040, .058, .080), element("text", x - .038, y - .095, .076, .040, label),
    ]) : []),
    ...(cellular ? [.311, .484, .553, .924].map((x) => element("led", x, .539, .022, .032)) : []),
  ];
  profile.faces.rear.components = ruggedDINRear(device.model);
  noteRuggedDIN(profile);
  profile.limitations.push("COM1 is the top RJ45 console; COM2 is the lower RJ45 serial data socket. The power header has four contacts, while this F-series digital I/O header has six. USB protection is shown closed.");
}

/** Trace the 70G's high-mounted connector banks, lower nine-pin I/O and exposed firmware selector. */
function addRugged70G(profile, device) {
  inspected(profile, "R70G", "7 front; 4–5 rear DIN bracket, dimensions and nine-pin I/O");
  notePhysicalLabels(profile);
  profile.chassis = { x: .225, y: .085, width: .55, height: .83 };
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index < 6) return namedSlot(port, index < 4 ? String(index + 1) : `WAN${index - 3}`,
      [.497, .677, .809][Math.floor(index / 2)], index % 2 ? .352 : .193, .095, .15);
    if (index < 8) return namedSlot(port, `SFP${index - 5}`, .763 + (index - 6) * .134, .814, .100, .10);
    return namedSlot(port, index === 8 ? "CONSOLE" : "SERIAL", .312, index === 8 ? .193 : .352, .095, .15);
  });
  for (const port of profile.faces.front.ports.filter((item) => item.type !== "SFP_1G")) {
    port.descriptionAnchor = { x: port.x, y: port.y < .25 ? .112 : .438 };
  }
  profile.faces.front.components = [
    element("chassis", .155, .162, .061, .295),
    ...[.172, .459].map((y) => element("screw", .168, y, .036, .051)),
    element("button", .047, .370, .033, .055, undefined, "reset"),
    ...["STA", "ALM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .110, .186 + index * .073, .024, .037),
      element("text", .074, .190 + index * .073, .035, .033, label),
    ]),
    ...[.048, .192].map((x) => element("screw", x, .545, .062, .100)),
    ruggedTerminal(.046, .747, .212, .080, 4), ruggedTerminal(.300, .747, .375, .080, 9),
    element("text", .045, .680, .213, .040, "DC1 / DC2  12–125V"),
    element("text", .300, .861, .375, .040, "IN1 REF IN2 NC1 COM1 NO1 NC2 COM2 NO2"),
    element("text", .316, .539, .310, .135, "Rugged 70G"),
    element("switch", .760, .475, .068, .039, undefined, "firmware-slider"),
    element("text", .657, .550, .166, .055, "SIGNED FW"),
    element("coax", .875, .536, .063, .100, undefined, "capped"),
    element("led", .484, .490, .022, .032), element("text", .507, .490, .052, .035, "BYP"),
  ];
  profile.faces.rear.components = ruggedDINRear(device.model);
  noteRuggedDIN(profile);
  profile.limitations.push("Console and serial are stacked front RJ45 sockets. The digital I/O header has nine contacts; the dual-feed DC header has four. USB protection is shown closed, and the signed-firmware selector is exposed.");
}

/** Trace each cellular G front independently, retaining five versus nine antenna sockets and its own chassis ground hardware. */
function addRuggedGCellular(profile, device) {
  const dual = device.model.endsWith("Dual");
  inspected(profile, dual ? "R70G-dual" : "R50G-cell", "8 front; 5 rear DIN mounting bracket and dimensions");
  notePhysicalLabels(profile);
  profile.chassis = dual ? { x: .225, y: .085, width: .55, height: .83 } : { x: .29, y: .01, width: .42, height: .98 };
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index < 6) return namedSlot(port, index < 4 ? String(index + 1) : `WAN${index - 3}`,
      [.412, .556, .665][Math.floor(index / 2)], index % 2 ? .798 : .677, .093, .10);
    if (index < 8) return namedSlot(port, `SFP${index - 5}`, .790 + (index - 6) * .110, .633, .094, .10);
    return namedSlot(port, index === 8 ? "CONSOLE" : "SERIAL", .270, index === 8 ? .677 : .798, .093, .10);
  });
  for (const port of profile.faces.front.ports.filter((item) => item.type !== "SFP_1G")) {
    port.descriptionAnchor = { x: port.x, y: port.y < .72 ? .589 : .886 };
  }
  const antennas = dual ? [[.106, .152, "ANT2-2"], [.302, .152, "ANT2-1"], [.500, .152, "GPS"],
    [.699, .152, "ANT1-1"], [.896, .152, "ANT1-2"], [.203, .434, "ANT2-3"], [.699, .460, "ANT1-3"],
    [.106, .822, "ANT2-0"], [.896, .806, "ANT1-0"]] :
    [[.106, .152, "ANT1"], [.500, .152, "GPS"], [.896, .152, "ANT3"], [.106, .824, "ANT2"], [.896, .807, "ANT0"]];
  profile.faces.front.components = [
    element("text", .230, .015, .540, .065, dual ? "Rugged 70G-5G-DUAL" : "Rugged 50G-5G"),
    ...antennas.flatMap(([x, y, label]) => [element("coax", x - .024, y - .038, .048, .076),
      element("text", x - .045, y - .080, .090, .028, label)]),
    element("chassis", .268, .233, .106, .206), element("screw", .299, .247, .035, .050),
    element("chassis", .130, .495, .062, .277), element("screw", .146, .516, .032, .049),
    element("chassis", dual ? .593 : .604, .407, .067, .171), element("screw", dual ? .620 : .634, .441, .021, .040),
    ruggedTerminal(.793, .288, .173, .070, 4), ruggedTerminal(.449, .288, .293, .070, 9),
    element("text", .790, .372, .180, .028, dual ? "DC1 / DC2 12–125V" : "DC1 / DC2 12–54V"),
    element("text", .448, .214, .293, .028, "NO2 COM2 NC2 NO1 COM1 NC1 IN2 REF IN1"),
    ...["STA", "HA", "ALM", "PWR"].flatMap((label, index) => [
      element("led", .034, .589 + index * .044, .020, .032),
      element("text", .057, .589 + index * .044, .037, .029, label),
    ]),
    element("button", .080, .610, .025, .040, undefined, "reset"),
    element("coax", .908, .428, .067, .100, undefined, "capped"),
    ...(dual ? [[.107, "5G1"], [.141, "5G2"], [.175, "SIM1"], [.208, "SIM2"], [.242, "GPS"]] :
      [[.107, "5G"], [.174, "SIM1"], [.208, "SIM2"], [.242, "GPS"]]).flatMap(([x, label]) => [
      element("led", x - .007, .326, .014, .023),
      element("text", x - .020, .279, .040, .028, label),
    ]),
    ...(dual ? [element("led", .404, .533, .019, .030), element("text", .385, .478, .080, .031, "BYPASS")] : []),
    ...(dual ? [.783, .895].map((x) => element("screw", x, .884, .065, .10)) :
      [element("screw", .902, .884, .065, .10), element("screw", .861, .907, .031, .055)]),
    ...[.047, .924].map((x) => element("screw", x, .020, .027, .041)),
    ...[.047, .467].map((x) => element("screw", x, .915, .027, .041)),
  ];
  profile.faces.rear.components = ruggedDINRear(device.model);
  noteRuggedDIN(profile);
  profile.limitations.push("The antenna sockets are counted from this specific front drawing; the BLE antenna remains under its cap. USB, SIM and firmware-switch protection is shown closed. Nine I/O contacts and four dual-feed DC contacts are represented separately.");
  if (!dual) {
    profile.legacyLayouts = [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(device.ports.filter((port) => port.portIndex < 10).map((port) => [port.portIndex, port.portIndex])) }];
    profile.limitations.push("Inventory revision 1 appends the missing serial RJ45 endpoint at index 10; saved indices 1–9 and their connection identities are unchanged.");
  }
}

/** Frame one installed 7000E blade without painting decorative metal over its interactive sockets. */
function blade7000EFrame(y, name, processor = false) {
  const labels = processor ? ["STATUS", "ALARM", "POWER"] : ["STATUS", "ALARM", "HA", "POWER"];
  return [element("chassis", .030, y, .940, .003), element("chassis", .030, y + .166, .940, .003),
    element("text", .050, y + .010, .070, .016, name),
    ...[.018, .966].map((x) => element("handle", x, y + .078, .024, .078)),
    ...[.040, .946].map((x) => element("screw", x, y + .023, .012, .016)),
    ...[.038, .842].map((x) => element("chassis", x, y + .154, .120, .010)),
    ...labels.flatMap((label, index) => [
      element("led", .093, y + .075 + index * .020, .006, .009),
      element("text", .047, y + .074 + index * .020, .042, .013, label),
    ]),
    element("button", .133, y + .128, .007, .010, undefined, "reset"),
    element("button", .133, y + .149, .006, .008, undefined, "reset"),
    ...(processor ? [element("vent", .145, y + .007, .777, .143, undefined, "mesh")] :
      [element("usb", .076, y + .111, .010, .041, undefined, "a"),
        element("vent", .143, y + .007, .066, .143, undefined, "mesh")]),
  ];
}

/** Trace the FIM-7901E SFP banks or FIM-7920E QSFP row in its documented installed slot. */
function interface7000E(ports, y, qsfp) {
  const components = blade7000EFrame(y, qsfp ? "FIM-7920E" : "FIM-7901E");
  const sockets = ports.map((port, index) => {
    if (index < 4) return namedSlot(port, `MGMT${index + 1}`, (qsfp ? .249 : .232) + Math.floor(index / 2) * .039,
      y + (index % 2 ? .128 : .075), .028, .038);
    if (index < 6) return namedSlot(port, `M${index - 3}`, qsfp ? .334 : .318,
      y + (index % 2 ? .128 : .075), .030, .038);
    if (qsfp) return namedSlot(port, `C${index - 5}`, .459 + (index - 6) * .115, y + .130, .042, .035);
    const data = index - 6;
    const column = Math.floor(data / 2);
    return namedSlot(port, `A${data + 1}`, .373 + column * .0347 + Math.floor(column / 8) * .012,
      y + (data % 2 ? .128 : .075), .029, .038);
  });
  for (const port of sockets) port.descriptionAnchor = {
    x: port.x, y: y + (qsfp && /^C/.test(port.physicalLabel) ? .087 : port.y < y + .1 ? .038 : .161),
  };
  components.push(element("vent", .213, y + .008, .700, .020, undefined, "mesh"));
  if (qsfp) {
    components.push(element("vent", .370, y + .036, .547, .035, undefined, "mesh"));
    for (const x of [.487, .602, .717, .832]) components.push(element("vent", x, y + .100, .061, .051, undefined, "mesh"));
    for (const x of [.459, .574, .689, .804]) components.push(element("led", x - .003, y + .098, .006, .009));
  }
  return { ports: sockets, components };
}

/** Trace the fixed SMM Ethernet, two selectable consoles, status fields and selection buttons. */
function management70307040E(ports) {
  const components = [element("text", .511, .018, .058, .013, "STATUS"),
    ...[.510, .949].map((x) => element("screw", x, .055, .012, .016)),
    ...Array.from({ length: 4 }, (_, index) => element("led", .551, .035 + index * .012, .006, .008)),
    ...Array.from({ length: 3 }, (_, index) => element("led", .580 + index * .013, .047, .006, .008)),
    ...Array.from({ length: 4 }, (_, index) => element("led", .580 + index * .013, .069, .006, .008)),
    element("text", .572, .025, .046, .012, "FAN / PSU"),
    element("button", .675, .064, .007, .010, undefined, "reset"), element("led", .676, .084, .005, .007),
    element("chassis", .500, .008, .002, .100), element("chassis", .500, .108, .462, .003),
  ];
  for (const x of [.760, .885]) {
    for (let index = 0; index < 4; index++) components.push(element("led", x, .035 + index * .012, .006, .008));
    components.push(element("button", x + .035, .062, .010, .014));
  }
  const sockets = ports.map((port, index) => ({
    ...namedSlot(port, index ? `CONSOLE${index}` : "MGMT", [.646, .711, .836][index], .066, .031, .037),
    descriptionAnchor: { x: [.646, .714, .839][index], y: .099 },
  }));
  return { ports: sockets, components };
}

/** Trace the separately illustrated 7030E and 7040E rear: three dual-fan trays and PWR1/2/4 installed. */
function rear70307040E() {
  return [
    ...[.030, .344, .658].map((x) => element("fan", x, .044, .309, .778, undefined, "mesh-dual")),
    ...[[.030, "PWR4"], [.712, "PWR2"], [.842, "PWR1"]].map(([x, name]) => element("psu", x, .835, .128, .158, name, "ac-compact-c14")),
    element("module-bay", .162, .835, .126, .158, "PWR3", "blank"),
    element("text", .429, .888, .130, .041, "DISCONNECT ALL POWER CORDS"),
    element("screw", .608, .872, .019, .025), element("screw", .608, .929, .019, .025),
    ...[.039, .495, .950].map((x) => element("screw", x, .005, .012, .016)),
    ...[.008, .978].flatMap((x) => [.140, .343, .546, .749, .954].map((y) => element("screw", x, y, .012, .016))),
  ];
}

/** Collect a FIM's typed groups without assuming that catalog zone order equals the front-panel order. */
function installed7000EPorts(ports, number) {
  return ["MGMT", "M", "A", "C"].flatMap((suffix) => ports.filter((port) => port.group === `FIM${number}-${suffix}`));
}

/** Trace two 6U chassis using the exact populated configurations printed in their own system guides. */
function add70307040E(profile, device) {
  const model = device.model.slice("FortiGate ".length);
  const twoFIMs = model === "7040E";
  inspected(profile, model, twoFIMs ? "6 front, 9 rear; 7 module inventory; 44 SMM" : "6 front, 8 rear; 39 SMM; FIM-7901E guide 5–7");
  const configuration = twoFIMs ? "Two FIM-7920E in slots 1/2 and two FPM-7630E in slots 3/4, with PWR1/2/4 AC supplies installed" :
    "SFP10G version with one FIM-7901E in slot 1, sealed slot 2, two FPM-7620E in slots 3/4, and PWR1/2/4 AC supplies installed";
  profile.chassis = { x: 0, y: 0, width: 1, height: 1 };
  profile.evidence = { scope: "model", models: [device.model], configuration,
    front: `${GUIDES[model]}#page=6`, rear: `${GUIDES[model]}#page=${twoFIMs ? 9 : 8}`,
    supplemental: [`${GUIDES.FIM7901E}#page=5`, `${GUIDES["7030E"]}#page=23`] };
  const smmPorts = device.ports.filter((port) => ["SMM-MGMT", "CONSOLE"].includes(port.group));
  profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: { 1: smmPorts[0].portIndex, 3: smmPorts[1].portIndex, 4: smmPorts[2].portIndex },
    portLabels: { 1: "MGMT1", 3: "CONSOLE1", 4: "CONSOLE2" } }];
  profile.catalogDiscrepancies = ["New instances use the documented 6U height and all connectors in the selected installed module configuration. Historical 12U allocations are preserved.",
    "The old generic MGMT1 and two consoles map to the fixed SMM; old MGMT2 has no unique physical equivalent and remains an unmapped saved endpoint."];
  profile.limitations = [`Selected configuration: ${configuration}. Other FIM/FPM populations and DC supplies require their corresponding configuration.`,
    "The sealed 7030E slot-2 panel and the populated 7040E slot-2 interface are distinct. Each rear tray contains two visible rotors, and the optional PWR3 bay is covered."];
  const smm = management70307040E(smmPorts);
  const fim1 = interface7000E(installed7000EPorts(device.ports, 1), .291, twoFIMs);
  const fim2 = twoFIMs ? interface7000E(installed7000EPorts(device.ports, 2), .472, true) : { ports: [], components: [
    element("module-bay", .026, .472, .948, .174, "SEALED PANEL", "blank"),
    ...[.046, .285, .510, .735].flatMap((x) => [.490, .621].map((y) => element("vent", x, y, .213, .012, undefined, "mesh"))),
  ] };
  profile.faces.front = { ports: [...smm.ports, ...fim1.ports, ...fim2.ports], components: [
    element("text", .067, .023, .159, .068, device.model),
    ...smm.components, ...blade7000EFrame(.115, twoFIMs ? "FPM-7630E" : "FPM-7620E", true),
    ...fim1.components, ...fim2.components, ...blade7000EFrame(.655, twoFIMs ? "FPM-7630E" : "FPM-7620E", true),
    ...[.075, .291, .516, .744].map((x) => element("vent", x, .864, .182, .083, undefined, "mesh")),
    { ...element("service-jack", .940, .892, .018, .024), role: "esd" },
    element("text", .928, .922, .042, .016, "ESD"),
    ...[.013, .050, .266, .493, .723, .977].flatMap((x) => [.850, .970].map((y) => element("screw", x, y, .012, .016))),
  ] };
  profile.faces.rear = { ports: [], components: rear70307040E() };
}

/** Place a separately traced module in its documented chassis slot without changing port identity. */
function position7000FPanel(panel, x, y, width, height) {
  return {
    ports: panel.ports.map((port) => ({ ...port, x: x + port.x * width, y: y + port.y * height,
      width: port.width * width, height: port.height * height,
      descriptionAnchor: { x: x + port.descriptionAnchor.x * width, y: y + port.descriptionAnchor.y * height } })),
    components: panel.components.map((component) => ({ ...component, x: x + component.x * width,
      y: y + component.y * height, width: component.width * width, height: component.height * height })),
  };
}

/** Trace the FIM-7921F/7941F or FPM-7620F module frame, ejectors, controls and perforated regions. */
function frame7000FModule(name, processor) {
  const components = [element("text", .026, .018, .105, .090, name),
    element("chassis", .010, .010, .002, .93), element("chassis", .988, .010, .002, .93),
    element("chassis", .010, .010, .98, .006), element("chassis", .010, .94, .98, .006),
    ...[.010, .942].map((x) => element("handle", x, .550, .043, .36)),
    ...[.005, .975].map((x) => element("switch", x, .520, .020, .200, undefined, "firmware-slider")),
    ...[.005, .975].map((x) => element("screw", x, .80, .021, .105)),
    ...[.028, .880].map((x) => element("chassis", x, .940, .102, .018)),
    element("vent", .120, .010, .82, .145, undefined, "mesh"),
  ];
  for (const [index, text] of (processor ? ["STATUS", "ALARM", "PWR"] : ["STATUS", "ALARM", "HA", "PWR"]).entries()) {
    components.push(element("text", .039, .50 + index * .095, .035, .061, text),
      { ...element("led", .076, .515 + index * .095, .007, .041, undefined, "bar"), color: index === 1 ? "#df483b" : "#42d98b" });
  }
  components.push(element("button", .066, .840, .007, .040, undefined, "reset"), element("button", .066, .777, .007, .040, undefined, "reset"));
  return components;
}

/** Trace each interface module's distinct data, HA, Ethernet management and console sockets. */
function interface7000F(ports, number, newer) {
  const components = frame7000FModule(newer ? "FIM-7941F" : "FIM-7921F", false);
  components.push(element("usb", .105, .780, .033, .105),
    element("vent", .180, .173, .067, .72, undefined, "mesh"),
    element("vent", .555, .173, .025, .72, undefined, "mesh"),
    element("vent", .878, .173, .015, .72, undefined, "mesh"),
    ...[.902, .932].map((x, index) => ({ ...element("drive-carrier", x, .20, .024, .66), role: `SSD${index + 1}` })));
  const sockets = [];
  for (const port of ports.filter((item) => item.group.startsWith(`FIM${number}-`))) {
    const group = port.group.slice(`FIM${number}-`.length);
    const peers = ports.filter((item) => item.group === port.group);
    const index = peers.indexOf(port);
    let x, y, label, width = .041, height = .24, caption;
    if (group === "DATA") {
      x = [.279, .327, .375, .423, .471, .519, .611, .659, .707][Math.floor(index / 2)];
      y = index % 2 ? .735 : .43; label = String(index + 1); caption = index % 2 ? .945 : .22;
    } else if (group === "DD" || group === "M") {
      x = [.757, .809][index]; y = group === "DD" ? .43 : .735;
      label = group === "DD" ? String(index + 19) : `M${index + 1}`; caption = group === "DD" ? .22 : .945;
    } else if (group === "SFP-M") {
      x = .859; y = index ? .735 : .43; label = `M${index + 3}`; width = .032; caption = index ? .945 : .22;
    } else if (group === "MGMT") {
      x = .158; y = index ? .72 : .445; label = `MGMT${index + 1}`; width = .031; height = .19; caption = index ? .945 : .22;
    } else {
      x = .105; y = .58; label = "CONSOLE"; width = .031; height = .18; caption = .365;
    }
    sockets.push({ ...namedSlot(port, label, x, y, width, height), descriptionAnchor: { x, y: caption } });
  }
  return { ports: sockets, components };
}

/** Trace FPM network cages while retaining its unsupported console and covered manufacturer socket as hardware. */
function processor7000F(ports, number) {
  const components = frame7000FModule("FPM-7620F", true);
  components.push({ ...element("rj45", .150, .48, .037, .34), role: "unsupported-console" },
    element("text", .147, .350, .043, .080, "CONSOLE"),
    { ...element("chassis", .198, .46, .039, .38), role: "manufacturer-cover" },
    element("text", .198, .45, .039, .40, "Manufacturer only"),
    element("vent", .101, .173, .040, .68, undefined, "mesh"),
    element("vent", .241, .173, .366, .68, undefined, "mesh"),
    element("vent", .607, .173, .158, .24, undefined, "mesh"));
  const sockets = [];
  for (const port of ports.filter((item) => item.group.startsWith(`FPM${number}-`))) {
    const data = port.group.endsWith("-DATA");
    const index = ports.filter((item) => item.group === port.group).indexOf(port);
    const x = data ? .799 + Math.floor(index / 2) * .037 : .651 + index * .058;
    const y = data ? (index % 2 ? .720 : .385) : .720;
    sockets.push({ ...namedSlot(port, String(index + (data ? 3 : 1)), x, y, data ? .031 : .045, data ? .26 : .22),
      descriptionAnchor: { x, y: data && !(index % 2) ? .17 : .97 } });
  }
  return { ports: sockets, components };
}

/** Trace an SMM with the correct fan, PSU and console-selection indicator counts for its chassis. */
function management7000F(ports, number, large) {
  const components = [element("chassis", .01, .025, .98, .015), element("chassis", .01, .95, .98, .015),
    ...[.010, .955].map((x) => element("screw", x, .57, .045, .10)),
    element("text", .065, .070, .10, .06, "FAN"), element("text", .065, .235, .10, .06, "PSU"),
    element("button", .656, .738, .025, .065), element("button", .656, .846, .025, .065)];
  for (const [index, label] of ["STATUS", "ALARM", "TEMP", "POWER"].entries()) {
    components.push(element("text", .069, .530 + index * .075, .099, .047, label),
      { ...element("led", .170, .534 + index * .075, .028, .038, undefined, "bar"), color: "#42d98b" });
  }
  for (const [count, y] of [[large ? 6 : 3, .07], [large ? 8 : 6, .25]]) {
    const columns = count === 8 ? 4 : 3;
    for (let index = 0; index < count; index++) components.push({
      ...element("led", .22 + (index % columns) * .055, y + Math.floor(index / columns) * .065, .028, .038, undefined, "bar"), color: "#42d98b" });
  }
  for (const x of [.50, .745]) for (let index = 0; index < (large ? 12 : 8); index++) {
    components.push({ ...element("led", x + Math.floor(index / 4) * (large ? .066 : .132), .07 + index % 4 * .065,
      .027, .033, undefined, "bar"), color: "#42d98b", role: `smm${number}-selection` });
  }
  const assigned = [ports.find((port) => port.group === `SMM${number}-MGMT`),
    ...ports.filter((port) => port.group === `SMM${number}-CONSOLE`)];
  return { components, ports: assigned.map((port, index) => ({
    ...namedSlot(port, index ? `CONSOLE${index}` : "MGMT", [.29, .558, .805][index], .697, .150, .245),
    descriptionAnchor: { x: [.29, .565, .813][index], y: .952 },
  })) };
}

/** Trace the two chassis' separate rear drawings, including tray numbering and earthing studs. */
function rear7000FChassis(large) {
  const trays = [];
  for (let column = 0; column < 3; column++) {
    if (large) for (let row = 0; row < 2; row++) {
      trays.push(element("fan", .030 + column * .313, .045 + row * .423, .310, .423, undefined,
        row ? "mesh-dual-end-bottom" : "mesh-dual-end-top"),
      element("text", .090 + column * .313, row ? .894 : .027, .190, .016, `FAN ${3 - column + row * 3}`));
    } else trays.push(element("fan", .030 + column * .313, .055, .310, .825, undefined, "mesh-triple-end"),
      element("text", .090 + column * .313, .889, .190, .018, `FAN ${3 - column}`));
  }
  return [...trays, element("text", .06, .930, .220, .03, "READ MANUAL BEFORE REPLACING FAN TRAY"),
    ...[.775, .818].map((x) => element("screw", x, .973, .024, .015)),
    ...[.01, .975].flatMap((x) => [.030, .235, .435, .635, .985].map((y) => element("screw", x, y, .012, .009))),
    ...[.05, .500, .953].flatMap((x) => [.013, .985].map((y) => element("screw", x, y, .013, .009)))];
}

/** Resolve the documented shipped base configuration for each named 7081F/7121F AC or DC SKU. */
function add7000FChassis(profile, device) {
  const large = device.model.startsWith("FortiGate 7121F");
  const newer = device.model.includes("-2");
  const dc = device.model.endsWith("-DC");
  const guide = large ? "7121F" : "7081F";
  const population = large ? 2 : 1;
  inspected(profile, guide, large ? "9 front, 13 rear, 10–12 modules, 16 generation/SKUs, 25/27 PSU, 60 SMM; ordering 13" :
    "8 front, 12 rear, 9–11 modules, 14 shipped blanks, 21/24 PSU, 51 SMM; ordering 13");
  profile.chassis = { x: 0, y: 0, width: 1, height: 1 };
  const configuration = `${large ? "Generation 1; " : ""}${population} FIM-${newer ? "7941F" : "7921F"} in slot${large ? "s 1/2" : " 1"}, ` +
    `${population} FPM-7620F in slot${large ? "s 3/4" : " 3"}, two SMMs, ${large ? 8 : 6} ${dc ? "DC" : "AC"} PSUs, and ${large ? 8 : 6} covered unused module slots`;
  profile.evidence = { scope: "model", models: [device.model], configuration,
    front: `${GUIDES[guide]}#page=${large ? 9 : 8}`, rear: `${GUIDES[guide]}#page=${large ? 13 : 12}`,
    supplemental: [`${GUIDES["7000F-ds"]}#page=13`, `${GUIDES[guide]}#page=${large ? 16 : 14}`, `${GUIDES.FPM7620F}#page=4`] };
  const management = [1, 2].map((number) => device.ports.find((port) => port.group === `SMM${number}-MGMT`));
  profile.legacyLayouts = [{ inventoryRevision: 0, portIndexMap: { 1: management[0].portIndex, 2: management[1].portIndex },
    portLabels: { 1: "MGMT1", 2: "MGMT2" } }];
  profile.catalogDiscrepancies = ["The old inventory contained only two management and two generic console endpoints. Revision 1 adds the documented base modules. Old management endpoints map to SMM1/2; old consoles remain unmapped because their SMM/socket identity was unspecified.",
    "The ordering table calls FPM optical ports QSFP28; the module system guide explicitly identifies ports 1/2 as 400GE QSFP-DD, which is used here."];
  profile.limitations = [`Selected shipped base configuration: ${configuration}. Additional FIM/FPM modules require their own inventories.`,
    "FPM-7620F's physically illustrated console is explicitly unsupported in the module guide changelog; it is noninteractive hardware. Its manufacturer-only management socket remains covered.",
    large ? "The -2 suffix selects FIM-7941F; it does not denote the separately named GEN2 chassis. This profile uses the generation-1 PSU panels." :
      "The AC appliance uses an Anderson Saf-D-Grid inlet, not the C20 connector at the other end of the supplied cable."];
  const smms = [1, 2].map((number) => position7000FPanel(management7000F(device.ports, number, large),
    (large ? .405 : .414) + (number - 1) * .230, large ? .012 : .016, .226, large ? .057 : .076));
  const rows = large ? [[11,.075,.062],[9,.139,.062],[7,.203,.062],[5,.267,.062],[3,.331,.062],
    [1,.395,.081],[2,.479,.081],[4,.563,.062],[6,.627,.062],[8,.691,.062],[10,.755,.062],[12,.819,.062]] :
    [[7,.097,.082],[5,.183,.082],[3,.269,.082],[1,.355,.108],[2,.467,.108],[4,.579,.082],[6,.665,.082],[8,.751,.082]];
  const modules = rows.map(([number, y, height]) => {
    const installed = number <= 2 ? number <= population : number === 3 || (large && number === 4);
    if (!installed) return { ports: [], components: [{ ...element("module-bay", .034, y, .932, height, `SLOT ${number} BLANK`, "blank"), role: "unused-module" }] };
    return position7000FPanel(number <= 2 ? interface7000F(device.ports, number, newer) : processor7000F(device.ports, number), .034, y, .932, height);
  });
  const supplies = Array.from({ length: large ? 8 : 6 }, (_, index) => ({
    ...element("psu", (large ? .078 : .189) + index * (large ? .110 : .109), large ? .905 : .870,
      large ? .096 : .085, large ? .076 : .112, undefined, dc ? "dc-keyed2-portrait" : large ? "ac-c16-portrait" : "ac-saf-d-grid"),
    role: `PSU${index + 1}`,
  }));
  profile.faces.front = { ports: [...smms, ...modules].flatMap((panel) => panel.ports), components: [
    element("text", .068, .022, .170, large ? .021 : .032, device.model),
    element("vent", .302, .018, .070, large ? .048 : .062, undefined, "mesh"),
    element("vent", .870, .018, .070, large ? .048 : .062, undefined, "mesh"),
    ...smms.flatMap((panel) => panel.components), ...modules.flatMap((panel) => panel.components), ...supplies,
    ...supplies.map((supply, index) => element("text", supply.x, large ? .982 : .984, supply.width, .009, String(index + 1))),
    { ...element("service-jack", .944, large ? .890 : .862, .022, .014), role: "esd" },
    ...[large ? .930 : .906, large ? .953 : .936].map((y) => element("screw", .947, y, .020, .013)),
    element("text", .025, large ? .915 : .879, large ? .045 : .130, .036, "DISCONNECT ALL POWER SOURCES"),
    ...[.015, .050, .285, .515, .745, .977].flatMap((x) => [large ? .893 : .850, .988].map((y) => element("screw", x, y, .012, .008))),
  ] };
  profile.faces.rear = { ports: [], components: rear7000FChassis(large) };
}
